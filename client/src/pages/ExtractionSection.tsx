// ─────────────────────────────────────────────────────────────────────────────
// ExtractionSection — "See what we pull out" annotated-scan band (landing option 04)
//
// Marketing copy for the AI receipt/invoice extraction feature. The real
// extraction lives in subscriptionApi.extract(); this section just sells it.
// Rendered inside Landing.tsx's framed grid, between two <Rule /> dividers.
// ─────────────────────────────────────────────────────────────────────────────

import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const EXTRACTED_FIELDS = [
  { label: 'Merchant', value: 'Nordic Gym Co.' },
  { label: 'Category', value: 'Membership' },
  { label: 'Amount', value: '$35.00' },
  { label: 'Cycle', value: 'Monthly' },
  { label: 'Renewal date', value: '02 Jul 2026' },
];

export default function ExtractionSection() {
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;

  return (
    <section id="extraction" className="py-20 px-4 overflow-hidden">
      <div className="container mx-auto max-w-5xl">
        <div className="grid md:grid-cols-[0.85fr_1.15fr] gap-12 md:gap-14 items-center">

          {/* ── Left: receipt with sweeping scan line ───────────────────── */}
          <div className="relative flex justify-center">
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 24, rotate: -1.5 }}
              whileInView={{ opacity: 1, y: 0, rotate: -1.5 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-[300px] max-w-full bg-white rounded-sm border border-black/[0.06] px-6 py-7 overflow-hidden"
              style={{
                boxShadow:
                  '0 2px 4px rgba(40,33,20,0.08), 0 20px 48px rgba(40,33,20,0.16)',
              }}
            >
              {/* scan line */}
              {!reduced && (
                <motion.div
                  className="absolute left-0 right-0 h-[2px] z-10"
                  style={{
                    backgroundColor: 'hsl(var(--brand-orange))',
                    boxShadow: '0 0 12px 1px hsl(var(--brand-orange) / 0.6)',
                  }}
                  initial={{ top: '0%', opacity: 0 }}
                  animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
                />
              )}

              <p className="font-mono text-[13px] font-bold tracking-wider text-foreground">
                NORDIC GYM CO.
              </p>
              <p className="font-mono text-[9px] text-muted-foreground mt-1">
                Membership · monthly
              </p>

              <div className="border-perf my-4" />

              <div className="font-mono text-[10px] text-muted-foreground leading-loose">
                {[
                  ['Member', 'A. Lindqvist'],
                  ['Plan', 'Premium'],
                  ['Renews', '02 Jul 2026'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className="text-foreground">{v}</span>
                  </div>
                ))}
              </div>

              <div className="border-perf my-4" />

              <div className="flex justify-between items-baseline">
                <span className="font-mono text-[11px] text-muted-foreground">TOTAL</span>
                <span className="font-mono text-xl font-bold text-foreground">$35.00</span>
              </div>

              {/* faux barcode */}
              <div
                className="mt-4 h-6"
                style={{
                  background:
                    'repeating-linear-gradient(90deg, hsl(var(--foreground)) 0 2px, transparent 2px 4px)',
                }}
              />
            </motion.div>
          </div>

          {/* ── Right: annotated extracted fields ───────────────────────── */}
          <div>
            <motion.p
              className="font-mono text-xs uppercase tracking-[0.24em] text-brand-orange mb-3.5"
              initial={reduced ? {} : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              Auto-extracted
            </motion.p>

            <motion.h2
              className="text-3xl md:text-4xl font-extrabold leading-[1.08] tracking-tight mb-7"
              initial={reduced ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              We read every line so you don&apos;t have to.
            </motion.h2>

            <div className="flex flex-col gap-3.5">
              {EXTRACTED_FIELDS.map((f, i) => (
                <motion.div
                  key={f.label}
                  className="flex items-center gap-4 bg-card border border-border rounded-sm px-[18px] py-3.5"
                  initial={reduced ? {} : { opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: 0.2 + i * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <motion.span
                    className="flex items-center justify-center w-[22px] h-[22px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'hsl(var(--brand-orange))' }}
                    initial={reduced ? {} : { scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ delay: 0.35 + i * 0.12, type: 'spring', stiffness: 500, damping: 18 }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3.2} />
                  </motion.span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground w-[130px] flex-shrink-0">
                    {f.label}
                  </span>
                  <span className="text-[17px] font-bold text-foreground">{f.value}</span>
                </motion.div>
              ))}
            </div>

            <p className="text-sm text-muted-foreground mt-7 max-w-md leading-relaxed">
              Upload any receipt, invoice or renewal notice — PDF or photo — and
              Paypr fills in every field for you. You just glance and confirm.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
