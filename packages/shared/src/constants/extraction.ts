// Copy for the receipt-extraction loading state, shared so the web overlay
// (client/src/components/ExtractionLoadingOverlay.tsx) and its mobile port
// (mobile/components/ExtractionLoadingOverlay.tsx) stay in step.
//
// The backend extract call is a single non-streaming Claude request, so the
// field rows below don't track real per-field progress — they check off on a
// looping timer purely to make the wait feel alive and on-brand.

/** Rows in the field-reveal checklist, in reveal order. */
export const EXTRACTION_FIELDS = [
  'Merchant',
  'Category',
  'Amount',
  'Cycle',
  'Renewal date',
] as const;

/** Heading lines cycled through as the reveal progresses. */
export const EXTRACTION_STATUS_LINES = [
  'Reading your receipt…',
  'Pulling out the details…',
  'Almost there…',
] as const;

/** Single static heading shown to reduced-motion users (no cycling). */
export const EXTRACTION_STATUS_REDUCED = 'Extracting details…';

/** Reassurance line under the faux barcode. */
export const EXTRACTION_FOOTNOTE = 'This usually takes a few seconds.';
