// ─────────────────────────────────────────────────────────────────────────────
// IosSection — "Now in your pocket" band announcing the iPhone app.
//
// The scroll-depth entry point to /mobile (the nav link and hero pill in
// Landing.tsx are the other two). Deliberately on the light paper palette
// rather than a preview of /mobile's dark surface: dropping a black band into the
// middle of the landing page competes with the genuinely inverted "cost of
// forgetting" band two sections below it.
//
// Rendered inside Landing.tsx's framed grid, between two <Rule /> dividers.
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { APP_NAME } from '@/lib/constants';

const POINTS = [
  'Snap a receipt and let AI file the renewal',
  'Push reminders ahead of every charge',
  'Face ID quick-unlock, always in sync with the web',
];

export default function IosSection() {
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;

  return (
    <section id="ios" className="overflow-hidden bg-muted/30 px-4 py-20">
      <div className="container mx-auto max-w-5xl">
        <div className="grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr] md:gap-14">
          {/* ── Left: copy ──────────────────────────────────────────────── */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-orange">
              Coming soon
            </p>
            <h2 className="mt-4 text-3xl font-extrabold leading-[1.1] md:text-4xl">
              Your paper trail,
              <br />
              now in your pocket
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              {APP_NAME} for iPhone is purpose-designed for the quick jobs that keep your paper trail
              current — a powerful sidekick to the web app you already use.
            </p>

            <ul className="mt-7 flex flex-col gap-3">
              {POINTS.map((point, i) => (
                <motion.li
                  key={point}
                  className="flex items-start gap-3 text-[15px] text-foreground/80"
                  initial={reduced ? {} : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ delay: 0.12 + i * 0.07, duration: 0.45, ease: 'easeOut' }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-orange"
                  />
                  {point}
                </motion.li>
              ))}
            </ul>

            <motion.div
              className="mt-9"
              initial={reduced ? {} : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: 0.34, duration: 0.5, ease: 'easeOut' }}
            >
              <Link
                to="/mobile"
                onClick={() => window.scrollTo(0, 0)}
                className="group inline-flex h-11 items-center gap-2 rounded-md bg-primary px-8 text-sm
                  font-medium text-primary-foreground transition-[background-color,transform]
                  duration-150 ease-out hover:bg-primary-hover active:scale-[0.97]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2"
              >
                See {APP_NAME} for iPhone
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </motion.div>
          </motion.div>

          {/* ── Right: the Overview screen ──────────────────────────────── */}
          <motion.div
            className="flex justify-center md:justify-end"
            initial={reduced ? {} : { opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              animate={reduced ? {} : { y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ willChange: reduced ? undefined : 'transform' }}
            >
              <img
                src="/ios/home.webp"
                alt={`The ${APP_NAME} Overview screen on iPhone, listing upcoming renewals`}
                width={280}
                height={526}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="block h-auto w-[min(280px,62vw)] select-none"
                style={{ filter: 'drop-shadow(0 34px 60px rgba(40,33,20,0.34))' }}
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
