import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { buttonVariants } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';
import { Logo } from '@/components/Logo';
import {
  RefreshCw, FileText, Users, Shield, Globe, Home,
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

const RENEWAL_ITEMS = [
  { name: 'Netflix', amount: '$15.99' },
  { name: 'Gym membership', amount: '$35.00' },
  { name: 'Domain .io', amount: '$12.00' },
  { name: 'Home insurance', amount: '$89.00' },
];

// Renewal Radar timeline — sample data; in production these are the user's tracked items.
const RADAR_ITEMS = [
  { name: 'Netflix', days: 3 },
  { name: 'Gym membership', days: 12 },
  { name: 'iCloud+', days: 21 },
  { name: 'Domain .io', days: 28 },
  { name: 'Home insurance', days: 45 },
  { name: 'AppleCare', days: 67 },
  { name: 'Office lease', days: 84 },
];

// Receipt ticker lines — sample data for the "Always on file" cell.
const RECEIPT_LINES = [
  { name: 'NETFLIX', amount: '15.99' },
  { name: 'SPOTIFY', amount: '11.99' },
  { name: 'GYM', amount: '35.00' },
  { name: 'DOMAIN .IO', amount: '12.00' },
  { name: 'ICLOUD+', amount: '2.99' },
  { name: 'HOME INSURANCE', amount: '89.00' },
  { name: 'APPLECARE', amount: '9.99' },
  { name: 'PHONE PLAN', amount: '24.00' },
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

// ─── Renewal Radar bento sub-components ─────────────────────────────────────────

// Tiny orange crosshair used by the magnetic registration marks.
function Crosshair() {
  return (
    <span className="relative block h-[13px] w-[13px]">
      <span className="absolute left-1/2 top-0 h-[13px] w-px -translate-x-1/2" style={{ background: 'hsl(var(--brand-orange) / 0.6)' }} />
      <span className="absolute left-0 top-1/2 h-px w-[13px] -translate-y-1/2" style={{ background: 'hsl(var(--brand-orange) / 0.6)' }} />
    </span>
  );
}

// Two crosshairs pinned to the frame's vertical seam (top & bottom). While the
// cursor is inside the frame each mark is pulled toward it (decorative). Refs +
// direct DOM writes — no React state per frame. Disabled on coarse pointers /
// reduced motion. Parent (the frame) must be `relative` and pass its ref.
function MagneticMarks({ frameRef, enabled }: { frameRef: React.RefObject<HTMLDivElement>; enabled: boolean }) {
  const topRef = useRef<HTMLSpanElement>(null);
  const bottomRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setActive(false);
      return;
    }
    setActive(!window.matchMedia('(pointer: coarse)').matches);
  }, [enabled]);

  useEffect(() => {
    if (!active) return;
    const frame = frameRef.current;
    if (!frame) return;
    const marks = [topRef.current, bottomRef.current].filter(Boolean) as HTMLElement[];

    const onMove = (e: MouseEvent) => {
      for (const mark of marks) {
        const r = mark.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < 130) {
          const pull = (1 - dist / 130) * 0.45;
          mark.style.transform = `translate(${dx * pull}px, ${dy * pull}px)`;
        } else {
          mark.style.transform = 'translate(0, 0)';
        }
      }
    };
    const onLeave = () => {
      for (const mark of marks) mark.style.transform = 'translate(0, 0)';
    };

    frame.addEventListener('mousemove', onMove);
    frame.addEventListener('mouseleave', onLeave);
    return () => {
      frame.removeEventListener('mousemove', onMove);
      frame.removeEventListener('mouseleave', onLeave);
    };
  }, [active, frameRef]);

  if (!active) return null;

  return (
    <span aria-hidden="true" className="pointer-events-none">
      <span
        ref={topRef}
        className="absolute z-[5] block transition-transform duration-[120ms] ease-out"
        style={{ left: '60%', top: -6.5, marginLeft: -6.5 }}
      >
        <Crosshair />
      </span>
      <span
        ref={bottomRef}
        className="absolute z-[5] block transition-transform duration-[120ms] ease-out"
        style={{ left: '60%', bottom: -6.5, marginLeft: -6.5 }}
      >
        <Crosshair />
      </span>
    </span>
  );
}

// Inverted (black) radar cell. A single `day` (0–90) drives the playhead,
// progress fill, per-item dots, the live "next up" readout, and both count tiles.
function RenewalRadar() {
  const [day, setDay] = useState(6);

  const sorted = [...RADAR_ITEMS].sort((a, b) => a.days - b.days);
  const passed = sorted.filter((it) => it.days <= day);
  const ahead = sorted.filter((it) => it.days > day);
  const next = ahead[0] ?? null;
  const playheadPct = (day / 90) * 100;

  return (
    <div className="md:col-span-3 bg-foreground p-6 md:p-8 border-b md:border-b-0 md:border-r border-background/15">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-background/50">Renewal radar</p>
          <h3 className="font-sans text-[22px] font-extrabold tracking-[-0.02em] text-background mt-1 leading-tight">
            Scrub the next 90 days
          </h3>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-background/50">Next up</p>
          {next ? (
            <>
              <p className="text-[15px] font-bold text-background mt-1">{next.name}</p>
              <p className="font-mono text-[12px] text-brand-orange">in {next.days - day} days</p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-bold text-background mt-1">All clear</p>
              <p className="font-mono text-[12px] text-brand-orange">nothing ahead</p>
            </>
          )}
        </div>
      </div>

      {/* Track */}
      <div className="relative mt-[26px] h-[52px]">
        {/* baseline */}
        <div className="absolute left-0 right-0 top-[26px] h-px" style={{ background: 'hsl(var(--background) / 0.16)' }} />
        {/* progress fill */}
        <div className="absolute top-[21px] left-0 h-[11px]" style={{ width: `${playheadPct}%`, background: 'hsl(var(--brand-orange) / 0.16)' }} />
        {/* dots */}
        {sorted.map((it) => {
          const isNext = next ? it.name === next.name : false;
          const isPast = it.days <= day;
          const base = { left: `${(it.days / 90) * 100}%`, top: '26px' } as const;
          const style = isNext
            ? { ...base, width: 14, height: 14, marginLeft: -7, marginTop: -7, background: 'hsl(var(--brand-orange))', border: '2px solid hsl(var(--background))', boxShadow: '0 0 0 4px hsl(var(--brand-orange) / 0.25)', zIndex: 3 }
            : isPast
            ? { ...base, width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, background: 'hsl(var(--background) / 0.35)', border: '2px solid hsl(var(--background))' }
            : { ...base, width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, background: 'hsl(var(--foreground))', border: '2px solid hsl(var(--background) / 0.7)' };
          return (
            <span
              key={it.name}
              title={`${it.name} · day ${it.days}`}
              className="absolute rounded-full transition-all duration-150"
              style={style}
            />
          );
        })}
        {/* playhead */}
        <div
          className="absolute w-[2px] h-[24px]"
          style={{ left: `${playheadPct}%`, top: '14px', marginLeft: -1, background: 'hsl(var(--brand-orange))', boxShadow: '0 0 10px hsl(var(--brand-orange) / 0.7)' }}
        />
      </div>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={90}
        value={day}
        onChange={(e) => setDay(Number(e.target.value))}
        aria-label="Scrub the next 90 days"
        className="radar-scrubber mt-2"
      />
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-background/50 mt-1">
        <span>Today</span>
        <span className="text-background">Day {day}</span>
        <span>+90</span>
      </div>

      {/* Count tiles */}
      <div className="flex gap-2.5 mt-[22px]">
        <div className="flex-1 border border-background/15 rounded-[2px] px-3.5 py-3">
          <p className="text-[26px] font-extrabold leading-none text-background">{passed.length}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-background/50 mt-1.5">Renewed by day {day}</p>
        </div>
        <div className="flex-1 border border-background/15 rounded-[2px] px-3.5 py-3">
          <p className="text-[26px] font-extrabold leading-none text-brand-orange">{ahead.length}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-background/50 mt-1.5">Still ahead</p>
        </div>
      </div>
    </div>
  );
}

// Small receipt glyph for the "Always on file" header tile.
function ReceiptGlyph() {
  return (
    <span className="relative block h-4 w-[13px] rounded-[1px] border-2 border-foreground">
      <span className="absolute left-[2px] right-[2px] top-[2px] h-[1.5px]" style={{ background: 'hsl(var(--brand-orange))' }} />
      <span className="absolute left-[2px] right-[2px] top-[6px] h-[1.5px] bg-foreground" />
    </span>
  );
}

// Receipt cell — header + a window with an infinite upward CSS marquee. The line
// list is rendered twice so the -50% roll loops seamlessly. Reduced motion is
// handled by the global prefers-reduced-motion rule in index.css.
function ReceiptTicker({ speed = 'calm' }: { speed?: 'calm' | 'brisk' }) {
  const rollClass = speed === 'brisk' ? 'animate-roll-brisk' : 'animate-roll-calm';
  return (
    <div className="md:col-span-2 bg-background p-6 md:p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[2px] bg-accent">
          <ReceiptGlyph />
        </div>
        <div>
          <h3 className="text-[17px] font-bold leading-tight text-foreground">Always on file</h3>
          <p className="text-[13px] text-muted-foreground">Every charge, printed &amp; kept.</p>
        </div>
      </div>

      {/* Receipt window */}
      <div className="relative mt-5 min-h-[230px] flex-1 overflow-hidden rounded-[2px] border border-foreground/15 bg-white">
        {/* perforated top edge */}
        <div
          className="absolute left-0 right-0 top-0 z-20 h-[10px]"
          style={{
            background: 'repeating-linear-gradient(90deg,hsl(var(--background)) 0 6px,transparent 6px 12px)',
            borderBottom: '1px dashed hsl(var(--foreground) / 0.18)',
          }}
        />
        {/* fade masks */}
        <div className="pointer-events-none absolute left-0 right-0 top-[10px] z-10 h-8" style={{ background: 'linear-gradient(#fff, transparent)' }} />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-8" style={{ background: 'linear-gradient(transparent, #fff)' }} />
        {/* rolling lines (rendered twice for a seamless loop) */}
        <div className={`absolute left-0 right-0 top-[14px] ${rollClass}`}>
          {[...RECEIPT_LINES, ...RECEIPT_LINES].map((line, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2 font-mono text-[11px]">
              <span className="whitespace-nowrap text-foreground">{line.name}</span>
              <span className="leader-dots mb-[3px] flex-1 self-center" />
              <span className="whitespace-nowrap text-muted-foreground">{line.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 2×2 registration-dot grid for the bottom strip's orange tile.
function RegistrationDots() {
  return (
    <span className="grid grid-cols-2 gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className="block h-1.5 w-1.5 rounded-full bg-background" />
      ))}
    </span>
  );
}

// Count-up "caught before renewal" figure; reuses useCountUp + useInView.
function CaughtStat({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const count = useCountUp(203, inView, reduced);
  return (
    <span ref={ref} className="tabular-nums text-foreground">
      $<span className="text-brand-orange">{count}</span>
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

  // Frame element for the Features bento's cursor-magnetic registration marks.
  const featuresFrameRef = useRef<HTMLDivElement>(null);

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
          <Link to="/" aria-label={`${APP_NAME} home`}>
            <Logo height={26} />
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

      {/* ── Features — "Renewal Radar" interactive bento ─────────────────── */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Header — two-line headline with orange highlight */}
          <motion.div
            className="mb-10 md:mb-14"
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <h2 className="text-3xl md:text-4xl font-extrabold leading-[1.1]">
              Nothing slips<br />
              <span className="relative inline-block">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-1 -z-10 h-2 bg-brand-orange/90"
                />
                through
              </span>
            </h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Every renewal, contract and warranty on one timeline — surfaced before it costs you.
            </p>
          </motion.div>

          {/* Framed bento — interactive renewal radar + receipt ticker */}
          <motion.div
            ref={featuresFrameRef}
            className="relative border border-foreground/15"
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <FrameCorners />
            <MagneticMarks frameRef={featuresFrameRef} enabled={!reduced} />

            {/* Top row — radar (3fr) + receipt ticker (2fr) */}
            <div className="grid md:grid-cols-5">
              <RenewalRadar />
              <ReceiptTicker />
            </div>

            {/* Bottom row — panoramic strip with count-up stat */}
            <div className="flex flex-col gap-6 border-t border-foreground/15 p-6 md:flex-row md:items-center md:gap-7 md:p-8">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[2px] bg-brand-orange">
                <RegistrationDots />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-foreground">One organised view</h3>
                <p className="mt-1 max-w-[52ch] text-[13px] text-muted-foreground">
                  All your commitments — subscriptions, contracts, warranties, leases —
                  filtered by category and sorted by date.
                </p>
              </div>
              <div className="md:border-l md:border-foreground/15 md:pl-7 md:text-right">
                <p className="text-[40px] font-black leading-none tracking-[-0.03em]">
                  <CaughtStat reduced={reduced} />
                </p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Caught before renewal
                </p>
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
            {APP_NAME} keeps every renewal, contract, and warranty on one timeline - so
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Logo height={18} />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://logo.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Logos by Logo.dev
            </a>
            <Link to="/terms" onClick={() => window.scrollTo(0, 0)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" onClick={() => window.scrollTo(0, 0)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </motion.footer>

        <Rule />
      </div>
    </div>
  );
}
