import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { extractSubscription, isSupportedMimeType } from '../services/aiService';

// Opt-in, manual smoke test for the receipt-extraction prompt + model. Feeds a
// real receipt/invoice file through extractSubscription against the live API and
// prints the candidates — validating the end-to-end path the mocked unit tests
// can't. Requires a real ANTHROPIC_API_KEY; intentionally not part of `npm test`.
//
//   npm run smoke:extract -- path/to/receipt.pdf
//
// Skipped (exit 0) when no key is configured so CI / contributors without a key
// aren't blocked.

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[smoke] ANTHROPIC_API_KEY not set — skipping real-key smoke test.');
    return;
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npm run smoke:extract -- <path-to-receipt>');
    process.exitCode = 1;
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType || !isSupportedMimeType(mimeType)) {
    console.error(`Unsupported file extension "${ext}". Use a PDF, PNG, JPEG, WebP, or GIF.`);
    process.exitCode = 1;
    return;
  }

  const buffer = fs.readFileSync(filePath);
  console.log(`[smoke] Extracting from ${filePath} (${mimeType}, ${buffer.length} bytes)…`);

  const result = await extractSubscription(buffer, mimeType);
  console.log(`[smoke] source=${result.source}`);
  console.log(JSON.stringify(result.candidates, null, 2));

  if (result.source === 'none') {
    console.error('[smoke] Extraction returned no candidates (API error or no tool_use).');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[smoke] Extraction smoke test failed:', err);
  process.exitCode = 1;
});
