import Anthropic from '@anthropic-ai/sdk';
import { CATEGORY_IDS, BILLING_CYCLES } from '../constants/subscriptions';
import { reportServerError } from '../utils/reportError';

// Graceful skip when no key is configured — mirrors emailService's RESEND_API_KEY handling.
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Haiku 4.5 is vision-capable and the cheapest model that handles receipt/invoice OCR well.
// Override with AI_MODEL to trade cost for accuracy. Recommended production override:
// claude-sonnet-5 ($3/$15 per MTok vs Haiku's $1/$5) — high-resolution vision (2576px vs
// 1568px long edge) reads small print on receipts markedly better, and it supports the
// strict tool schema below. claude-opus-4-8 is the step above if Sonnet still misreads.
const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';

// Authoritative enums live in constants/subscriptions.ts; re-exported here for the extraction schema
// and any consumers (LIF-68 endpoint) that already import these names.
export const VALID_CATEGORIES = CATEGORY_IDS;
export const VALID_BILLING_CYCLES = BILLING_CYCLES;

// Image media types Claude's vision input accepts. PDFs go through the document block instead.
const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;
const PDF_MIME_TYPE = 'application/pdf';

export const ALLOWED_UPLOAD_MIME_TYPES = [
  PDF_MIME_TYPE,
  ...ALLOWED_IMAGE_MIME_TYPES,
] as const;

export interface SubscriptionCandidate {
  name: string;
  cost: number | null;
  currency: string | null;
  billingCycle: string;
  renewalDate: string | null; // YYYY-MM-DD
  category: string;
  notes: string | null;
  isSubscription: boolean;
  confidence: 'high' | 'medium' | 'low';
  uncertainFields: string[];
}

export interface ExtractionResult {
  candidates: SubscriptionCandidate[];
  source: 'ai' | 'none';
  /**
   * When source is 'none', why extraction didn't produce a candidate — so the
   * caller can distinguish an ops misconfiguration ('not_configured') from a
   * transient/runtime failure ('error') in logs and response codes.
   */
  reason?: 'not_configured' | 'error';
}

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'record_subscription',
  description:
    'Record the subscription details extracted from an uploaded receipt or invoice.',
  // strict mode: every property must be listed in `required` and additionalProperties must be false.
  // Optional values are expressed as nullable types rather than omitted keys.
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'The service/merchant name, normalized (e.g. "NFLX*NETFLIX.COM" -> "Netflix").',
      },
      cost: {
        type: ['number', 'null'],
        description:
          'The amount actually charged for the subscription period: the final charged total ' +
          'including tax (the "Total" / "Amount due" / "Amount paid" line). Never the pre-tax ' +
          'subtotal, a tax/VAT line on its own, a per-item or per-seat price, or a discount line — ' +
          'when a receipt shows subtotal, tax, and total, pick the total. If both a per-period and ' +
          'a full-term amount appear (e.g. monthly price on an annual invoice), pick the amount that ' +
          'matches billingCycle. Read number formats from locale context: European "1.234,56" means ' +
          '1234.56, and "1,234.56" also means 1234.56 — a comma followed by exactly two digits at the ' +
          'end is a decimal separator. Output a plain JSON number (dot decimal, no thousands ' +
          'separators or currency symbols). If the charged amount cannot be determined confidently, ' +
          'use null and add "cost" to uncertainFields.',
      },
      currency: {
        type: ['string', 'null'],
        description:
          'ISO 4217 currency code, e.g. "USD", "EUR", "SGD". Map unambiguous symbols to codes ' +
          '("€" -> "EUR", "£" -> "GBP", "zł" -> "PLN"). "$" alone is ambiguous (USD/CAD/AUD/SGD...) — ' +
          'use other evidence like the merchant country or tax type; if still unclear, use null and ' +
          'add "currency" to uncertainFields.',
      },
      billingCycle: {
        type: 'string',
        enum: [...VALID_BILLING_CYCLES],
        description: 'Best-guess billing cycle. Use "monthly" if unclear.',
      },
      renewalDate: {
        type: ['string', 'null'],
        description: 'Next renewal/charge date as YYYY-MM-DD, or null if not present.',
      },
      category: {
        type: 'string',
        enum: [...VALID_CATEGORIES],
        description: 'The closest matching category. Use "other" if none fit.',
      },
      notes: {
        type: ['string', 'null'],
        description: 'Any extra useful detail (plan tier, account, etc.), or null.',
      },
      isSubscription: {
        type: 'boolean',
        description:
          'true if this is a recurring subscription; false if it looks like a one-off purchase.',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Overall confidence in the extracted fields.',
      },
      uncertainFields: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Names of fields the model was unsure about (e.g. ["cost","renewalDate"]), so the UI can flag them for review.',
      },
    },
    required: [
      'name',
      'cost',
      'currency',
      'billingCycle',
      'renewalDate',
      'category',
      'notes',
      'isSubscription',
      'confidence',
      'uncertainFields',
    ],
    additionalProperties: false,
  },
  strict: true,
};

const SYSTEM_PROMPT =
  'You extract subscription details from an uploaded receipt or invoice image/PDF. ' +
  'Call the record_subscription tool exactly once with your best extraction. ' +
  'Normalize the merchant name. ' +
  'For cost, report the amount actually charged — the final total including tax — never a subtotal, ' +
  'a tax line, or a per-item price. Watch for European number formats where the comma is the decimal ' +
  'separator (e.g. "1.234,56" is 1234.56). ' +
  'If a value is not present in the document, set it to null and add the field name to uncertainFields. ' +
  'If you are not confident in a value you did extract (hard-to-read print, several plausible amounts), ' +
  'still provide your best guess but add that field name to uncertainFields and lower confidence. ' +
  'If the document is a one-off purchase rather than a recurring subscription, set isSubscription to false.';

/** True if the mime type is one we can send to Claude (PDF document or supported image). */
export function isSupportedMimeType(mimeType: string): boolean {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Build the user content block for the uploaded file.
 * Images use an `image` block; PDFs use a `document` block.
 */
function buildFileBlock(
  fileBuffer: Buffer,
  mimeType: string
): Anthropic.ContentBlockParam {
  const data = fileBuffer.toString('base64');

  if (mimeType === PDF_MIME_TYPE) {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data },
    };
  }

  if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
        data,
      },
    };
  }

  throw new Error(`Unsupported mime type for extraction: ${mimeType}`);
}

/**
 * Extract subscription details from an uploaded receipt/invoice using Claude's vision/document input.
 * Returns candidates for the user to review and confirm — never creates anything.
 * When no API key is configured (or extraction fails), returns { source: 'none', candidates: [] }
 * so the caller can fall back to manual entry.
 */
export async function extractSubscription(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  // Validate the mime type up-front so an unsupported upload throws to the caller (→ 400)
  // instead of being swallowed by the try/catch below and looking like a failed extraction.
  if (!isSupportedMimeType(mimeType)) {
    throw new Error(`Unsupported mime type for extraction: ${mimeType}`);
  }

  if (!anthropic) {
    console.log('[AI Service] ANTHROPIC_API_KEY not configured. Skipping extraction.');
    return { source: 'none', reason: 'not_configured', candidates: [] };
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'record_subscription' },
      messages: [
        {
          role: 'user',
          content: [
            buildFileBlock(fileBuffer, mimeType),
            {
              type: 'text',
              text: 'Extract the subscription details from this receipt/invoice.',
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUse) {
      console.warn('[AI Service] No tool_use block in extraction response.');
      return { source: 'none', reason: 'error', candidates: [] };
    }

    const candidate = normalizeCandidate(toolUse.input);
    return { candidates: [candidate], source: 'ai' };
  } catch (error) {
    reportServerError('[AI Service] Extraction failed', error);
    return { source: 'none', reason: 'error', candidates: [] };
  }
}

/**
 * Coerce the model's tool input into a safe SubscriptionCandidate, clamping enums to valid values.
 *
 * Amount guards (LIF-76): a cost that isn't a finite, non-negative number is nulled rather than
 * passed through, and whenever cost ends up null, "cost" is added to uncertainFields so the review
 * dialog always flags a missing amount even if the model forgot to. Currency is trimmed/uppercased
 * and must look like an ISO 4217 code (3 letters), otherwise it is nulled.
 */
export function normalizeCandidate(input: unknown): SubscriptionCandidate {
  const raw = (input ?? {}) as Record<string, unknown>;

  const category = VALID_CATEGORIES.includes(raw.category as never)
    ? (raw.category as string)
    : 'other';
  const billingCycle = VALID_BILLING_CYCLES.includes(raw.billingCycle as never)
    ? (raw.billingCycle as string)
    : 'monthly';
  const confidence =
    raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low'
      ? raw.confidence
      : 'low';

  const cost =
    typeof raw.cost === 'number' && Number.isFinite(raw.cost) && raw.cost >= 0
      ? raw.cost
      : null;

  const trimmedCurrency =
    typeof raw.currency === 'string' ? raw.currency.trim().toUpperCase() : null;
  const currency =
    trimmedCurrency !== null && /^[A-Z]{3}$/.test(trimmedCurrency) ? trimmedCurrency : null;

  const uncertainFields = Array.isArray(raw.uncertainFields)
    ? raw.uncertainFields.filter((f): f is string => typeof f === 'string')
    : [];
  if (cost === null && !uncertainFields.includes('cost')) {
    uncertainFields.push('cost');
  }

  return {
    name: typeof raw.name === 'string' ? raw.name : '',
    cost,
    currency,
    billingCycle,
    renewalDate: typeof raw.renewalDate === 'string' ? raw.renewalDate : null,
    category,
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    isSubscription: raw.isSubscription !== false, // default to true unless explicitly false
    confidence,
    uncertainFields,
  };
}
