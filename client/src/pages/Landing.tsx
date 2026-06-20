import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { buttonVariants } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import {
  RefreshCw, FileText, Users, Shield, Globe, Home,
  Calendar, Bell, LayoutGrid,
} from 'lucide-react';
import {
  motion,
  useScroll,
  useSpring,
  useInView,
  useReducedMotion,
} from 'framer-motion';
import { useRef, useEffect, useState } from 'react';
import ExtractionSection from './ExtractionSection';

// ─── Data ────────────────────────────────────────────────────────────────────

const TRACKED_ITEMS = [
  { icon: RefreshCw, label: 'Subscriptions', description: 'Netflix, Spotify, SaaS tools' },
  { icon: FileText, label: 'Contracts', description: 'Service agreements, phone plans' },
  { icon: Users, label: 'Memberships', description: 'Gym, clubs, associations' },
  { icon: Shield, label: 'Warranties', description: 'Appliances, electronics, vehicles' },
  { icon: Globe, label: 'Domain Names', description: 'Never let a domain lapse' },
  { icon: Home, label: 'Leases', description: 'Rent, storage, parking' },
];

const FEATURES = [
  {
    icon: Calendar,
    title: 'Upcoming timeline',
    description: 'See everything due in the next 7, 30, and 90 days at a glance. No surprises.',
  },
  {
    icon: Bell,
    title: 'Renewal alerts',
    description: 'Know before it renews. Plan cancellations and budget for upcoming charges in advance.',
  },
  {
    icon: LayoutGrid,
    title: 'One organised view',
    description: 'All your commitments in one place. Filter by category, sort by date, and finally feel in control.',
  },
];

const RENEWAL_ITEMS = [
  { name: 'Netflix', amount: '$15.99' },
  { name: 'Gym membership', amount: '$35.00' },
  { name: 'Domain .io', amount: '$12.00' },
  { name: 'Home insurance', amount: '$89.00' },
];

const TIMELINE_ITEMS = [
  { name: 'Netflix', days: 3, urgent: true },
  { name: 'Gym membership', days: 12, urgent: false },
  { name: 'Domain .io', days: 28, urgent: false },
  { name: 'Insurance', days: 45, urgent: false },
];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useCountUp(target: number, inView: boolean, reduced: boolean): number {
  const [count, setCount] = useState(reduced ? target : 0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced || target === 0) {
      setCount(target);
      return;
    }
    const start = performance.now();
    const duration = 1200;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView, target, reduced]);

  return count;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DashboardMockup({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      animate={reduced ? {} : { y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="w-[340px] max-w-[86vw] rounded-xl border bg-card overflow-hidden"
      style={{
        boxShadow: '0 30px 70px -20px rgba(73,60,74,0.45), 0 8px 24px -8px rgba(0,0,0,0.12)',
        willChange: reduced ? undefined : 'transform',
      }}
    >
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <span className="text-sm font-bold tracking-tight">Upcoming renewals</span>
        <span className="text-xs text-muted-foreground font-mono">next 30 days</span>
      </div>
      <div className="divide-y">
        {RENEWAL_ITEMS.map((item, i) => (
          <motion.div
            key={item.name}
            initial={reduced ? {} : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.85 + i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="px-5 py-4 flex items-center justify-between gap-3"
          >
            <span className="text-sm font-medium truncate">{item.name}</span>
            <span
              className="text-xs font-mono px-2.5 py-1 rounded-sm flex-shrink-0"
              style={
                i === 0
                  ? { backgroundColor: 'hsl(var(--brand-orange))', color: 'white' }
                  : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
              }
            >
              {item.amount}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function AnimatedTimeline({ reduced }: { reduced: boolean }) {
  return (
    <div className="mt-6 relative flex-1">
      <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />
      {TIMELINE_ITEMS.map((item, i) => (
        <motion.div
          key={item.name}
          initial={reduced ? {} : { opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ delay: 0.25 + i * 0.14, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 py-2.5 relative"
        >
          <div className="relative z-10 flex-shrink-0 w-4 flex justify-center">
            {item.urgent ? (
              <span className="relative flex h-3.5 w-3.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                  style={{ backgroundColor: 'hsl(var(--brand-orange))' }}
                />
                <span
                  className="relative inline-flex rounded-full h-3.5 w-3.5"
                  style={{ backgroundColor: 'hsl(var(--brand-orange))' }}
                />
              </span>
            ) : (
              <span className="flex h-3 w-3 rounded-full border-2 bg-background" style={{ borderColor: 'hsl(var(--border))' }} />
            )}
          </div>
          <span className="text-sm flex-1 font-medium">{item.name}</span>
          <span
            className="text-xs font-mono"
            style={{ color: item.urgent ? 'hsl(var(--brand-orange))' : 'hsl(var(--muted-foreground))' }}
          >
            {item.days} days
          </span>
        </motion.div>
      ))}
    </div>
  );
}

// Counts up to a target $ figure once the band scrolls into view.
function CostStat({ target, reduced }: { target: number; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const count = useCountUp(target, inView, reduced);

  return (
    <span ref={ref} className="tabular-nums" style={{ color: 'hsl(var(--brand-orange))' }}>
      ${count}+
    </span>
  );
}

// Small crosshair "+" mark, Vercel-style, sits where rails meet a divider.
function Plus() {
  return (
    <span className="pointer-events-none relative block h-3 w-3">
      <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-foreground/20" />
      <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-foreground/20" />
    </span>
  );
}

// Divider between sections. The hairline runs full-bleed past the rails
// (w-screen, centred on the frame), with a "+" mark where it crosses each rail.
function Rule() {
  return (
    <div className="relative z-30 h-px w-full" aria-hidden="true">
      <div className="absolute left-1/2 top-0 h-px w-screen -translate-x-1/2 bg-border/50" />
      <span className="absolute -left-[6px] -top-[6px]"><Plus /></span>
      <span className="absolute -right-[6px] -top-[6px]"><Plus /></span>
    </div>
  );
}

// Registration "+" marks pinned to the four corners of a framed block,
// Vercel/feature146-style. Parent must be `relative`.
function FrameCorners() {
  return (
    <span aria-hidden="true" className="pointer-events-none">
      <span className="absolute -left-[6px] -top-[6px]"><Plus /></span>
      <span className="absolute -right-[6px] -top-[6px]"><Plus /></span>
      <span className="absolute -left-[6px] -bottom-[6px]"><Plus /></span>
      <span className="absolute -right-[6px] -bottom-[6px]"><Plus /></span>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Landing() {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // Public marketing page — render immediately rather than waiting on the auth check.
  // Once auth resolves, logged-in visitors get redirected to the dashboard.
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const headline = ['Your', 'entire', 'paper', 'trail.'];

  return (
    <div className="min-h-screen bg-background font-sans overflow-x-hidden">
      {/* Scroll progress bar */}
      {!reduced && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-[3px] origin-left z-[60]"
          style={{ scaleX, backgroundColor: 'hsl(var(--brand-orange))' }}
        />
      )}

      {/* Navbar */}
      <motion.header
        initial={reduced ? {} : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-foreground">
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'default' })}>
              Sign In
            </Link>
            <Link to="/register" className={buttonVariants({ size: 'default' })}>
              Get Started Free
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── Framed grid (Vercel-style rails + crosshairs) ─────────────────── */}
      <div className="relative mx-auto w-full max-w-[1200px] border-x border-border/50">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100vh-65px)] flex items-center py-20 px-4 overflow-hidden">
        {/* Background gradient orbs */}
        {!reduced && (
          <>
            <motion.div
              className="absolute pointer-events-none"
              style={{
                top: '-5%', right: '-8%',
                width: '52vw', height: '52vw',
                maxWidth: 640, maxHeight: 640,
                background: 'radial-gradient(circle, hsl(16 100% 45% / 0.16) 0%, transparent 68%)',
                filter: 'blur(48px)',
                // Promote to its own GPU layer so the expensive blur is rasterized
                // once into a texture; the infinite x/y then only moves that layer
                // instead of re-painting the blur every frame.
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
              animate={{ x: [0, 24, 0], y: [0, -18, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute pointer-events-none"
              style={{
                bottom: '-8%', left: '-6%',
                width: '44vw', height: '44vw',
                maxWidth: 520, maxHeight: 520,
                background: 'radial-gradient(circle, hsl(35 26% 80% / 0.7) 0%, transparent 68%)',
                filter: 'blur(64px)',
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
              animate={{ x: [0, -18, 0], y: [0, 22, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            />
          </>
        )}

        <div className="container mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center relative z-10">
          {/* Left: copy */}
          <div>
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[1.05] mb-7">
              {headline.map((word, i) => (
                <motion.span
                  key={word + i}
                  className={`inline-block mr-[0.22em] last:mr-0 ${word === 'trail.' ? 'text-brand-orange' : ''}`}
                  initial={reduced ? {} : { opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed"
              initial={reduced ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.52, duration: 0.55, ease: 'easeOut' }}
            >
              Every subscription, contract, invoice and renewal - organised into one living timeline.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3"
              initial={reduced ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.68, duration: 0.5, ease: 'easeOut' }}
            >
              <motion.div
                whileHover={reduced ? {} : { scale: 1.03 }}
                whileTap={reduced ? {} : { scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Link to="/register" className={buttonVariants({ size: 'lg' })}>
                  Get Started Free
                </Link>
              </motion.div>
              <motion.div
                whileHover={reduced ? {} : { scale: 1.03 }}
                whileTap={reduced ? {} : { scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Link to="/login" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
                  Sign In
                </Link>
              </motion.div>
            </motion.div>
          </div>

          {/* Right: illustration panel with floating subscriptions card */}
          <motion.div
            initial={reduced ? {} : { opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: 0.28, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg mx-auto lg:mx-0 lg:ml-auto"
          >
            {/* Desk illustration panel */}
            <div className="relative overflow-hidden aspect-square">
              <img
                src="/hero-desk.webp"
                alt="An illustrated desk of notebooks, papers and a planner"
                draggable={false}
                width={512}
                height={512}
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover select-none"
              />
            </div>

            {/* Subscriptions card overlapping the panel's right edge */}
            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 lg:left-auto lg:right-0 lg:translate-x-0">
              <DashboardMockup reduced={reduced} />
            </div>
          </motion.div>
        </div>
      </section>

      <Rule />

      {/* ── What you track ───────────────────────────────────────────────── */}
      <section id="what-you-track" className="py-20 bg-muted/30 overflow-hidden">
        <div className="container mx-auto max-w-4xl px-4">
          <motion.div
            className="text-center mb-4"
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Everything with a deadline, in one place
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              If it renews, expires, or auto-charges - {APP_NAME} tracks it.
            </p>
          </motion.div>
        </div>

        {/* Paper rail — horizontal scroll */}
        <div
          role="region"
          aria-label={`Things ${APP_NAME} tracks`}
          tabIndex={0}
          className="flex gap-7 overflow-x-auto snap-x snap-mandatory pt-10 pb-12
            px-8 sm:px-16 scroll-pl-8 sm:scroll-pl-16
            [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {TRACKED_ITEMS.map(({ icon: Icon, label, description }, i) => {
            const tilt = [-2.5, 1.5, -1, 2, -1.5, 1.2][i % 6];
            const tint = ['#fbf8f1', '#fdfbf6', '#f9f6ee', '#fcf9f2', '#faf7ef', '#fdfaf4'][i % 6];
            return (
              <motion.article
                key={label}
                initial={reduced ? {} : { opacity: 0, y: 60, rotate: tilt * 1.6 }}
                whileInView={{ opacity: 1, y: 0, rotate: tilt }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                whileHover={reduced ? {} : { rotate: 0, y: -10, scale: 1.03, transition: { duration: 0.25 } }}
                style={{
                  backgroundColor: tint,
                  boxShadow:
                    '0 1px 2px rgba(40,33,20,0.06), 0 6px 12px rgba(40,33,20,0.08), 0 16px 32px rgba(40,33,20,0.12)',
                }}
                className="relative shrink-0 snap-start w-[260px] sm:w-[280px] h-[360px] rounded-[3px]
                  border border-black/[0.06] overflow-hidden cursor-default"
              >
                {/* ruled lines */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, hsl(212 55% 55% / 0.10) 31px, hsl(212 55% 55% / 0.10) 32px)',
                    backgroundPosition: '0 96px',
                  }}
                />
                {/* left margin rule */}
                <div
                  aria-hidden
                  className="absolute top-0 bottom-0 left-8"
                  style={{ width: 1, background: 'hsl(2 65% 58% / 0.30)' }}
                />
                {/* rubber stamp */}
                <motion.div
                  aria-hidden
                  whileHover={reduced ? {} : { scale: 1.08 }}
                  className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center"
                  style={{
                    transform: 'rotate(-7deg)',
                    border: '2px dashed hsl(var(--brand-orange) / 0.45)',
                    borderRadius: '9999px',
                    backgroundColor: 'hsl(var(--brand-orange) / 0.06)',
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: 'hsl(var(--brand-orange) / 0.85)' }} />
                </motion.div>

                {/* content */}
                <div className="relative h-full pl-10 pr-6 pt-7 pb-6 flex flex-col">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground/40">
                    {APP_NAME} · Tracked
                  </p>
                  <h3 className="font-sans text-[1.7rem] leading-tight font-bold text-foreground/90 mt-10 mb-3">
                    {label}
                  </h3>
                  <p className="font-sans text-[0.95rem] leading-relaxed text-foreground/65">
                    {description}
                  </p>

                  <div className="mt-auto">
                    <div className="h-px bg-foreground/15 mb-2" />
                    <p className="font-mono text-[10px] text-foreground/40">
                      No. {String(i + 1).padStart(2, '0')} · filed with {APP_NAME}
                    </p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      <Rule />

      <ExtractionSection />

      <Rule />

      {/* ── Features — editorial framed bento (feature146-style) ─────────── */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Split header — heading left, supporting copy right */}
          <motion.div
            className="grid md:grid-cols-2 gap-6 md:gap-12 items-end mb-10 md:mb-14"
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold leading-[1.1]">
                Built around<br />what matters
              </h2>
            </div>
            <p className="text-muted-foreground md:text-right md:pb-1">
              No spreadsheets. No guessing. Just clarity — every commitment filed,
              dated, and surfaced before it costs you.
            </p>
          </motion.div>

          {/* Framed bento — hairline-divided cells with corner registration marks */}
          <motion.div
            className="relative border border-foreground/15"
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <FrameCorners />

            {/* Top row — wide timeline cell + narrow alerts cell */}
            <div className="grid md:grid-cols-5">
              <div className="md:col-span-3 p-6 md:p-8 flex flex-col border-b md:border-b-0 md:border-r border-foreground/15">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-accent flex-shrink-0 mb-4">
                  <Calendar className="w-5 h-5 text-brand-orange" />
                </div>
                <h3 className="font-semibold mb-1">{FEATURES[0].title}</h3>
                <p className="text-sm text-muted-foreground">{FEATURES[0].description}</p>
                <AnimatedTimeline reduced={reduced} />
              </div>

              <div className="md:col-span-2 p-6 md:p-8 flex flex-col">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-accent flex-shrink-0 mb-4">
                  <Bell className="w-5 h-5 text-brand-orange" />
                </div>
                <h3 className="font-semibold mb-1">{FEATURES[1].title}</h3>
                <p className="text-sm text-muted-foreground">{FEATURES[1].description}</p>
              </div>
            </div>

            {/* Bottom row — panoramic full-width cell */}
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-8 border-t border-foreground/15">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-accent flex-shrink-0">
                <LayoutGrid className="w-5 h-5 text-brand-orange" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{FEATURES[2].title}</h3>
                <p className="text-sm text-muted-foreground max-w-2xl">{FEATURES[2].description}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Rule />

      {/* ── Problem stat band ────────────────────────────────────────────── */}
      {/* NOTE: the "$200+/year" figure is illustrative marketing copy, hedged
          with "can quietly add up to". Swap in a sourced statistic (and cite
          it) before launch if you want a hard, defensible number. */}
      <section className="py-20 px-4" style={{ backgroundColor: 'hsl(var(--foreground))' }}>
        <div className="container mx-auto max-w-3xl text-center">
          <motion.p
            className="text-xs font-mono uppercase tracking-widest mb-6"
            style={{ color: 'hsl(var(--background) / 0.5)' }}
            initial={reduced ? {} : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            The cost of forgetting
          </motion.p>

          <motion.p
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1]"
            style={{ color: 'hsl(var(--background))' }}
            initial={reduced ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <CostStat target={200} reduced={reduced} /> a year
          </motion.p>

          <motion.p
            className="text-base md:text-lg max-w-xl mx-auto mt-6 leading-relaxed"
            style={{ color: 'hsl(var(--background) / 0.6)' }}
            initial={reduced ? {} : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.16, duration: 0.5, ease: 'easeOut' }}
          >
            is what forgotten subscriptions and auto-renewals can quietly add up to.
            Paypr keeps every renewal, contract, and warranty on one timeline - so
            nothing slips through.
          </motion.p>
        </div>
      </section>

      <Rule />

      {/* ── CTA banner ───────────────────────────────────────────────────── */}
      <section className="relative py-24 px-4 text-center overflow-hidden bg-muted/30">
        <div className="container mx-auto max-w-2xl relative z-10">
          <motion.h2
            className="text-4xl md:text-6xl font-black leading-[1.05] mb-5 text-foreground"
            initial={reduced ? {} : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            Stop guessing.<br />Start <span className="text-brand-orange">knowing.</span>
          </motion.h2>

          <motion.p
            className="mb-10 text-muted-foreground"
            initial={reduced ? {} : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.12, duration: 0.5, ease: 'easeOut' }}
          >
            Free to use. No credit card required.
          </motion.p>

          <motion.div
            initial={reduced ? {} : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.22, duration: 0.5, ease: 'easeOut' }}
            whileHover={reduced ? {} : { scale: 1.05 }}
            whileTap={reduced ? {} : { scale: 0.97 }}
            style={{ display: 'inline-block' }}
          >
            <Link to="/register" className={buttonVariants({ size: 'lg' })}>
              Get Started Free
            </Link>
          </motion.div>
        </div>
      </section>

      <Rule />

      {/* Footer */}
      <motion.footer
        className="py-8 px-4"
        initial={reduced ? {} : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}
          </p>
          <div className="flex gap-4">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </motion.footer>

        <Rule />
      </div>
    </div>
  );
}
