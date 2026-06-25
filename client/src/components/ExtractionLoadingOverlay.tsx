// ─────────────────────────────────────────────────────────────────────────────
// ExtractionLoadingOverlay — full-screen branded "we're reading your receipt" state
//
// Shown while subscriptionApi.extract() is in flight (see UploadReceiptDialog).
// The backend call is a single non-streaming Claude request, so there's no real
// per-field progress — the field rows check off on a looping timer purely to make
// the wait feel alive and on-brand. Reuses the field-reveal motif from
// ExtractionSection.tsx (the landing page that sells this feature).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { APP_NAME } from '@/lib/constants';

const FIELDS = ['Merchant', 'Category', 'Amount', 'Cycle', 'Renewal date'];

const STATUS_LINES = [
  'Reading your receipt…',
  'Pulling out the details…',
  'Almost there…',
];

// ms each field row stays "pending" before its check lights up
const STEP_MS = 650;

interface ExtractionLoadingOverlayProps {
  open: boolean;
}

export default function ExtractionLoadingOverlay({
  open,
}: ExtractionLoadingOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;

  // How many field rows are currently "checked". Counts 0..FIELDS.length then
  // loops back to 0 so the reveal keeps cycling for as long as the overlay is up.
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!open || reduced) return;
    setRevealed(0);
    const id = setInterval(() => {
      setRevealed((n) => (n >= FIELDS.length ? 0 : n + 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [open, reduced]);

  if (!open) return null;

  // Status line follows the reveal progress through the three phases.
  const statusIndex = Math.min(
    STATUS_LINES.length - 1,
    Math.floor((revealed / FIELDS.length) * STATUS_LINES.length)
  );
  const status = reduced ? 'Extracting details…' : STATUS_LINES[statusIndex];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      aria-label="Extracting subscription details from your receipt"
    >
      <motion.div
        className="fixed inset-0 bg-background/90 backdrop-blur-sm"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      />

      <motion.div
        className="relative z-[60] w-full max-w-sm bg-card border border-border rounded-sm px-7 py-8"
        style={{
          boxShadow:
            '0 2px 4px rgba(40,33,20,0.08), 0 20px 48px rgba(40,33,20,0.16)',
        }}
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Heading + cycling status */}
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-orange">
          {APP_NAME} · AI
        </p>
        <div className="mt-1 h-6 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.h2
              key={status}
              className="font-mono text-base font-bold tracking-tight text-foreground"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {status}
            </motion.h2>
          </AnimatePresence>
        </div>

        <div className="border-perf my-5" />

        {/* Field-reveal list */}
        <div className="flex flex-col gap-3">
          {FIELDS.map((label, i) => {
            const checked = reduced || i < revealed;
            return (
              <div key={label} className="flex items-center gap-3.5">
                {checked ? (
                  <motion.span
                    className="flex items-center justify-center w-[22px] h-[22px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'hsl(var(--brand-orange))' }}
                    initial={reduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3.2} />
                  </motion.span>
                ) : (
                  <span className="w-[22px] h-[22px] rounded-full flex-shrink-0 border-2 border-dashed border-border" />
                )}
                <span
                  className={`font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                    checked ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
                <span
                  className={`flex-1 self-center border-b border-dotted ${
                    checked ? 'border-transparent' : 'border-border'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Faux barcode — echoes the landing receipt aesthetic */}
        <div
          className="mt-6 h-5"
          style={{
            background:
              'repeating-linear-gradient(90deg, hsl(var(--foreground) / 0.55) 0 2px, transparent 2px 4px)',
          }}
        />
        <p className="mt-3 font-mono text-[10px] text-muted-foreground text-center">
          This usually takes a few seconds.
        </p>
      </motion.div>
    </div>
  );
}
