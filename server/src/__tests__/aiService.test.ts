import { CATEGORY_IDS, BILLING_CYCLES } from '../constants/subscriptions';

// Mock the Anthropic SDK. The factory may only reference out-of-scope vars whose
// names start with `mock`, so the shared spy is `mockMessagesCreate`. `mockCtor`
// records the constructor args (e.g. apiKey) for assertions.
const mockMessagesCreate = jest.fn();
const mockCtor = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class {
    messages = { create: mockMessagesCreate };
    constructor(opts: unknown) {
      mockCtor(opts);
    }
  },
}));

// aiService reads ANTHROPIC_API_KEY / AI_MODEL at import time, so each test that
// cares about them resets the module registry and re-imports under fresh env.
async function loadAiService(): Promise<typeof import('../services/aiService')> {
  jest.resetModules();
  return import('../services/aiService');
}

// A well-formed tool_use response from Claude, parameterised by the tool input.
function toolUseResponse(input: Record<string, unknown>) {
  return {
    content: [{ type: 'tool_use', name: 'record_subscription', input }],
  };
}

const VALID_INPUT = {
  name: 'Netflix',
  cost: 15.99,
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '2026-07-01',
  category: 'streaming',
  notes: 'Premium plan',
  isSubscription: true,
  confidence: 'high',
  uncertainFields: [],
};

describe('aiService', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalModel = process.env.AI_MODEL;

  beforeEach(() => {
    mockMessagesCreate.mockReset();
    mockCtor.mockReset();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_MODEL;
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
    process.env.AI_MODEL = originalModel;
  });

  describe('extractSubscription with a key configured', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    });

    it('parses a tool_use block into a candidate of the expected shape', async () => {
      mockMessagesCreate.mockResolvedValue(toolUseResponse(VALID_INPUT));
      const { extractSubscription } = await loadAiService();

      const result = await extractSubscription(Buffer.from('pdf'), 'application/pdf');

      expect(result.source).toBe('ai');
      expect(result.candidates).toHaveLength(1);
      const candidate = result.candidates[0];
      expect(candidate).toEqual(VALID_INPUT);
      expect(CATEGORY_IDS).toContain(candidate.category);
      expect(BILLING_CYCLES).toContain(candidate.billingCycle);
    });

    it('clamps an out-of-range category and billingCycle to the valid set', async () => {
      mockMessagesCreate.mockResolvedValue(
        toolUseResponse({ ...VALID_INPUT, category: 'bogus', billingCycle: 'fortnightly' })
      );
      const { extractSubscription } = await loadAiService();

      const [candidate] = (
        await extractSubscription(Buffer.from('pdf'), 'application/pdf')
      ).candidates;

      expect(candidate.category).toBe('other');
      expect(candidate.billingCycle).toBe('monthly');
    });

    it('defaults to the claude-haiku-4-5 model', async () => {
      mockMessagesCreate.mockResolvedValue(toolUseResponse(VALID_INPUT));
      const { extractSubscription } = await loadAiService();

      await extractSubscription(Buffer.from('pdf'), 'application/pdf');

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-haiku-4-5' })
      );
    });

    it('honours the AI_MODEL override', async () => {
      process.env.AI_MODEL = 'claude-sonnet-4-6';
      mockMessagesCreate.mockResolvedValue(toolUseResponse(VALID_INPUT));
      const { extractSubscription } = await loadAiService();

      await extractSubscription(Buffer.from('pdf'), 'application/pdf');

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-6' })
      );
    });

    it('forces the record_subscription tool and sends an image block for images', async () => {
      mockMessagesCreate.mockResolvedValue(toolUseResponse(VALID_INPUT));
      const { extractSubscription } = await loadAiService();

      await extractSubscription(Buffer.from('png'), 'image/png');

      const args = mockMessagesCreate.mock.calls[0][0];
      expect(args.tool_choice).toEqual({ type: 'tool', name: 'record_subscription' });
      expect(args.messages[0].content[0]).toMatchObject({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png' },
      });
    });

    it('sends amount guidance in the tool schema and system prompt (LIF-76)', async () => {
      mockMessagesCreate.mockResolvedValue(toolUseResponse(VALID_INPUT));
      const { extractSubscription } = await loadAiService();

      await extractSubscription(Buffer.from('pdf'), 'application/pdf');

      const args = mockMessagesCreate.mock.calls[0][0];
      const costDescription = args.tools[0].input_schema.properties.cost.description;
      // The cost field must steer the model to the charged total, away from
      // subtotals/tax/per-item prices, and cover European decimal formats.
      expect(costDescription).toMatch(/total including tax/i);
      expect(costDescription).toMatch(/subtotal/i);
      expect(costDescription).toContain('1.234,56');
      expect(args.system).toMatch(/total including tax/i);
      expect(args.system).toContain('1.234,56');
    });

    it('returns source "none" with reason "error" when the model omits a tool_use block', async () => {
      mockMessagesCreate.mockResolvedValue({ content: [{ type: 'text', text: 'sorry' }] });
      const { extractSubscription } = await loadAiService();

      const result = await extractSubscription(Buffer.from('pdf'), 'application/pdf');

      expect(result).toEqual({ source: 'none', reason: 'error', candidates: [] });
    });

    it('returns source "none" with reason "error" when the SDK call throws', async () => {
      mockMessagesCreate.mockRejectedValue(new Error('rate limited'));
      const { extractSubscription } = await loadAiService();

      const result = await extractSubscription(Buffer.from('pdf'), 'application/pdf');

      expect(result).toEqual({ source: 'none', reason: 'error', candidates: [] });
    });

    it('throws on an unsupported mime type without calling the SDK', async () => {
      const { extractSubscription } = await loadAiService();

      await expect(
        extractSubscription(Buffer.from('x'), 'text/plain')
      ).rejects.toThrow(/Unsupported mime type/);
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });
  });

  describe('extractSubscription with no key configured', () => {
    it('returns source "none" with reason "not_configured" without constructing the client or calling the SDK', async () => {
      const { extractSubscription } = await loadAiService();

      const result = await extractSubscription(Buffer.from('pdf'), 'application/pdf');

      expect(result).toEqual({ source: 'none', reason: 'not_configured', candidates: [] });
      expect(mockCtor).not.toHaveBeenCalled();
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });
  });

  describe('normalizeCandidate', () => {
    it('clamps unknown enums and coerces missing/wrong-typed fields to safe defaults', async () => {
      const { normalizeCandidate } = await loadAiService();

      const candidate = normalizeCandidate({
        name: 42, // wrong type -> ''
        cost: 'free', // wrong type -> null
        category: 'nope', // invalid -> other
        billingCycle: 'daily', // invalid -> monthly
        confidence: 'wild', // invalid -> low
        uncertainFields: ['cost', 7], // non-strings dropped
      });

      expect(candidate).toEqual({
        name: '',
        cost: null,
        currency: null,
        billingCycle: 'monthly',
        renewalDate: null,
        category: 'other',
        notes: null,
        isSubscription: true, // defaults true unless explicitly false
        confidence: 'low',
        uncertainFields: ['cost'],
      });
    });

    it('preserves valid enums and an explicit isSubscription=false', async () => {
      const { normalizeCandidate } = await loadAiService();

      const candidate = normalizeCandidate({
        ...VALID_INPUT,
        isSubscription: false,
        category: 'music',
        billingCycle: 'annual',
      });

      expect(candidate.category).toBe('music');
      expect(candidate.billingCycle).toBe('annual');
      expect(candidate.isSubscription).toBe(false);
    });

    describe('cost guards (LIF-76)', () => {
      it('passes through a valid positive cost untouched', async () => {
        const { normalizeCandidate } = await loadAiService();
        const candidate = normalizeCandidate({ ...VALID_INPUT, cost: 1234.56 });
        expect(candidate.cost).toBe(1234.56);
        expect(candidate.uncertainFields).toEqual([]);
      });

      it('keeps a zero cost (free trial) without flagging it', async () => {
        const { normalizeCandidate } = await loadAiService();
        const candidate = normalizeCandidate({ ...VALID_INPUT, cost: 0 });
        expect(candidate.cost).toBe(0);
        expect(candidate.uncertainFields).toEqual([]);
      });

      it('nulls a negative cost and flags it as uncertain', async () => {
        const { normalizeCandidate } = await loadAiService();
        const candidate = normalizeCandidate({ ...VALID_INPUT, cost: -15.99 });
        expect(candidate.cost).toBeNull();
        expect(candidate.uncertainFields).toContain('cost');
      });

      it('nulls a non-finite cost (NaN / Infinity) and flags it', async () => {
        const { normalizeCandidate } = await loadAiService();
        expect(normalizeCandidate({ ...VALID_INPUT, cost: NaN }).cost).toBeNull();
        const candidate = normalizeCandidate({ ...VALID_INPUT, cost: Infinity });
        expect(candidate.cost).toBeNull();
        expect(candidate.uncertainFields).toContain('cost');
      });

      it('adds "cost" to uncertainFields when the model returns null without flagging it', async () => {
        const { normalizeCandidate } = await loadAiService();
        const candidate = normalizeCandidate({ ...VALID_INPUT, cost: null, uncertainFields: [] });
        expect(candidate.cost).toBeNull();
        expect(candidate.uncertainFields).toEqual(['cost']);
      });

      it('does not duplicate "cost" when the model already flagged it', async () => {
        const { normalizeCandidate } = await loadAiService();
        const candidate = normalizeCandidate({
          ...VALID_INPUT,
          cost: null,
          uncertainFields: ['cost', 'renewalDate'],
        });
        expect(candidate.uncertainFields).toEqual(['cost', 'renewalDate']);
      });
    });

    describe('currency guards (LIF-76)', () => {
      it('uppercases and trims a valid ISO 4217 code', async () => {
        const { normalizeCandidate } = await loadAiService();
        expect(normalizeCandidate({ ...VALID_INPUT, currency: ' eur ' }).currency).toBe('EUR');
      });

      it('nulls a currency symbol or non-ISO string', async () => {
        const { normalizeCandidate } = await loadAiService();
        expect(normalizeCandidate({ ...VALID_INPUT, currency: '€' }).currency).toBeNull();
        expect(normalizeCandidate({ ...VALID_INPUT, currency: 'DOLLARS' }).currency).toBeNull();
      });
    });
  });
});
