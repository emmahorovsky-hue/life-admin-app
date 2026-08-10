import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { Rule } from '@/components/FrameMarks';
import { FRAME_HAIRLINE_COLOR } from '@/lib/frameTone';
import {
  type PhoneFamily,
  PADDED,
  TIGHT,
  DEVICE_HERO,
  DEVICE_BIG,
  DEVICE_CARD,
  DEVICE_SUBCARD,
  DEVICE_PANEL,
  phoneBox,
} from '@/lib/phoneAssets';
import { APP_NAME } from '@/lib/constants';

/**
 * The iPhone launch page (`/ios`) — a dark, centred-editorial marketing surface
 * introducing the native app alongside the web product.
 *
 * Unlike the rest of the app this page does NOT follow the semantic colour
 * tokens: `--background`/`--card`/`--foreground` describe the light "paper"
 * palette the product is built on, and this page is a deliberate dark counter-
 * surface. The palette below is therefore literal. `--brand-orange` is the one
 * exception — it is the same accent on both surfaces, so it stays a token
 * (`text-brand-orange`) and tracks the brand if it ever moves. `/ios` is listed
 * in `lib/themeRoutes.ts`, so the token always resolves to its light value
 * (#E53D00) here regardless of the visitor's theme preference.
 *
 * Structure follows Landing.tsx rather than the handoff prototype: the content
 * sits in a railed 1200px frame with `<Rule>` hairlines and registration marks
 * between sections, and corners are the system's near-square RADIUS. The
 * prototype's 16/20px rounded panels are Linear's vocabulary, not Paypr's, and
 * put the two marketing pages in visibly different design languages.
 */

// ─── Palette ─────────────────────────────────────────────────────────────────

const INK = '#0C0B0A'; // warm near-black page bg
const PANEL = '#161311'; // card surface on ink
const SNOW = '#FAFAF8'; // light text / light surfaces
const HAIRLINE = 'rgba(250,250,248,0.08)';
const TEXT_MUTED = 'rgba(250,250,248,0.6)';
const TEXT_FAINT = 'rgba(250,250,248,0.55)';

/**
 * The house corner: `--radius` is 0.125rem — "near-square receipt corners" —
 * and Landing's tiles use the same 2px. One constant so cards, badges, the QR
 * tile and the CTAs can't drift apart.
 */
const RADIUS = '2px';

// Orange radial glow sitting behind the hero and the closing CTA.
const glow = (alpha: number) =>
  `radial-gradient(ellipse at center, rgba(229,61,0,${alpha}) 0%, transparent 66%)`;

// ─── Launch switches ─────────────────────────────────────────────────────────

/**
 * Set to the App Store listing on launch day. While it is `null` the badge is
 * inert and reads "COMING SOON"; setting it turns the badge into a real link
 * and flips the sub-label to "DOWNLOAD ON THE". Nothing else needs to change.
 *
 * The QR in `public/ios/qr-paypr-ios.svg` encodes https://paypr.live/ios (this
 * page) rather than the store, so it keeps working before and after launch —
 * scanning it on a phone lands here and finds whatever this badge points at.
 * Regenerate it with:
 *   qrencode -t SVG -m 2 -s 8 -l M -o qr-paypr-ios.svg "https://paypr.live/ios"
 */
const APP_STORE_URL: string | null = null;

// ─── Shared motion ───────────────────────────────────────────────────────────

// Marketing reveals — longer than the <300ms UI budget on purpose, and seen
// once per visit. `once: true` so nothing re-animates on scroll-back.
const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      initial={reduced ? {} : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay, duration: 0.55, ease: REVEAL_EASE }}
    >
      {children}
    </motion.div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

/**
 * A device screenshot. The source assets carry their own bezel and
 * transparency, so the shadow is a `drop-shadow` on the alpha channel rather
 * than a box shadow on the element. `width`/`height` are always set — these are
 * the tallest things on the page and reserving their box keeps the scroll from
 * jumping as they decode.
 */
function PhoneShot({
  src,
  alt,
  family,
  deviceHeight,
  shadow,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  family: PhoneFamily;
  /** Height of the phone itself in px — not of the image box around it. */
  deviceHeight: number;
  shadow: string;
  priority?: boolean;
  className?: string;
}) {
  const { width, height, padTop, padBottom, vwCap } = phoneBox(family, deviceHeight);

  return (
    <img
      src={src}
      alt={alt}
      width={Math.round(width)}
      height={Math.round(height)}
      draggable={false}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
      style={{
        width: `min(${width.toFixed(1)}px, ${vwCap.toFixed(1)}vw)`,
        height: 'auto',
        display: 'block',
        marginTop: `${-padTop.toFixed(1)}px`,
        marginBottom: `${-padBottom.toFixed(1)}px`,
        filter: shadow,
      }}
    />
  );
}

const SHADOW_HERO = 'drop-shadow(0 50px 90px rgba(0,0,0,0.6))';
const SHADOW_BIG = 'drop-shadow(0 44px 80px rgba(0,0,0,0.55))';
const SHADOW_CARD = 'drop-shadow(0 24px 44px rgba(0,0,0,0.5))';
const SHADOW_PANEL = 'drop-shadow(0 30px 55px rgba(0,0,0,0.5))';

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.7c0-2 1.6-3 1.7-3.05-.93-1.36-2.38-1.55-2.9-1.57-1.23-.12-2.4.72-3.02.72-.62 0-1.58-.7-2.6-.68-1.34.02-2.57.78-3.26 1.97-1.39 2.42-.36 6 1 7.96.66.96 1.45 2.04 2.48 2 1-.04 1.38-.64 2.58-.64 1.2 0 1.54.64 2.6.62 1.07-.02 1.75-.98 2.4-1.94.76-1.11 1.07-2.18 1.09-2.24-.02-.01-2.09-.8-2.11-3.17zM14.4 6.6c.55-.66.92-1.58.82-2.5-.79.03-1.75.53-2.31 1.19-.5.58-.94 1.52-.82 2.41.88.07 1.77-.45 2.31-1.1z" />
    </svg>
  );
}

/**
 * App Store badge. Renders as a link once `APP_STORE_URL` is set and as plain
 * text until then — a badge that looks pressable but goes nowhere is worse than
 * one that plainly announces itself as not-yet.
 */
function AppStoreBadge() {
  const live = APP_STORE_URL !== null;
  const inner = (
    <>
      <AppleGlyph />
      <span className="text-left leading-none">
        <span className="block font-mono text-[9px] tracking-[0.06em]" style={{ color: '#585552' }}>
          {live ? 'DOWNLOAD ON THE' : 'COMING SOON'}
        </span>
        <span className="mt-[2px] block text-[16px] font-bold">App Store</span>
      </span>
    </>
  );

  const shape =
    'inline-flex h-[52px] items-center gap-2.5 px-5 transition-transform duration-150 ease-out';

  if (!live) {
    return (
      <span
        className={shape}
        style={{ backgroundColor: SNOW, color: '#161616', borderRadius: RADIUS }}
        // Not a control: it states availability rather than offering an action.
        aria-label={`${APP_NAME} for iPhone is coming soon to the App Store`}
      >
        {inner}
      </span>
    );
  }
  return (
    <a
      href={APP_STORE_URL}
      className={`${shape} active:scale-[0.97]`}
      style={{ backgroundColor: SNOW, color: '#161616', borderRadius: RADIUS }}
    >
      {inner}
    </a>
  );
}

/**
 * The scan-and-download row shared by the hero and the closing CTA. The hero
 * carries the secondary web CTA; the closing block does not (by then the
 * visitor has read the page and the badge is the point).
 */
function ScanRow({ withWebCta = false }: { withWebCta?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-[22px] gap-y-6">
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-[74px] w-[74px] items-center justify-center p-[7px]"
          style={{ backgroundColor: SNOW, borderRadius: RADIUS }}
        >
          <img
            src="/ios/qr-paypr-ios.svg"
            alt={`QR code linking to the ${APP_NAME} for iPhone page`}
            width={60}
            height={60}
            className="h-[60px] w-[60px]"
            loading="lazy"
            decoding="async"
          />
        </div>
        <p className="m-0 text-left font-mono text-[11px] leading-[1.4]" style={{ color: TEXT_FAINT }}>
          Scan to
          <br />
          download
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <AppStoreBadge />
        {withWebCta && (
          <Link
            to="/register"
            className="inline-flex h-[52px] items-center px-[22px] text-sm font-semibold
              transition-[transform,background-color] duration-150 ease-out
              hover:bg-[rgba(250,250,248,0.06)] active:scale-[0.97]"
            style={{
              border: '1.5px solid rgba(250,250,248,0.28)',
              color: SNOW,
              borderRadius: RADIUS,
            }}
          >
            Start on the web
          </Link>
        )}
      </div>
    </div>
  );
}

/** Dark panel card. `eyebrow` is the small orange mono label on the intro pair. */
function FeatureCard({
  eyebrow,
  title,
  body,
  titleClass,
  children,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  titleClass: string;
  children: ReactNode;
}) {
  return (
    <div
      // h-full so a card fills the grid row rather than its own content: the
      // two cards in a pair carry different amounts of copy, and without it
      // their bottom edges (and the phones pinned to them) don't line up.
      className="flex h-full flex-col overflow-hidden px-7 pb-7 pt-9 sm:px-10 sm:pb-10 sm:pt-10"
      style={{ backgroundColor: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: RADIUS }}
    >
      {eyebrow && (
        <p className="m-0 mb-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-brand-orange">
          {eyebrow}
        </p>
      )}
      <h3 className={`m-0 mb-2.5 font-extrabold ${titleClass}`}>{title}</h3>
      <p
        className="m-0 mb-2 max-w-[34ch] text-[15px] leading-[1.55]"
        style={{ color: TEXT_MUTED }}
      >
        {body}
      </p>
      {/* Pinned to the bottom, standing on the card's bottom inset rather than
          bleeding past it. PhoneShot's box is the device, so this reads as the
          same gap under either asset family. */}
      <div className="mt-auto flex justify-center pt-6">{children}</div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function IosLanding() {
  const { user } = useAuth();
  const reduced = useReducedMotion() ?? false;

  // Deliberately no redirect for signed-in visitors (unlike `/`): existing web
  // users are the most likely audience for a "there's an app now" page.
  return (
    <div className="min-h-screen overflow-x-clip font-sans" style={{ backgroundColor: INK, color: SNOW }}>
      {/* Railed frame, matching Landing's: the hairline rails run the height of
          the page and every <Rule> plants a registration mark where it crosses
          them. Rules must stay direct children of this element. */}
      <div
        className="relative mx-auto w-full max-w-[1200px] border-x"
        style={{ borderColor: FRAME_HAIRLINE_COLOR.inverse }}
      >
        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-5 py-5 sm:px-10">
          <Link to="/" aria-label={`${APP_NAME} home`}>
            <Logo variant="wordmark-inverse" height={24} />
          </Link>
          <nav className="flex items-center gap-4 text-sm sm:gap-[26px]">
            <Link
              to="/"
              className="hidden transition-colors hover:text-brand-orange sm:inline"
              style={{ color: TEXT_MUTED }}
            >
              Web app
            </Link>
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex h-[34px] items-center px-4 text-[13px] font-semibold
                  transition-transform duration-150 ease-out active:scale-[0.97]"
                style={{ backgroundColor: SNOW, color: '#161616', borderRadius: RADIUS }}
              >
                Open {APP_NAME}
              </Link>
            ) : (
              <>
                <Link to="/login" className="transition-colors hover:text-brand-orange" style={{ color: SNOW }}>
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex h-[34px] items-center px-4 text-[13px] font-semibold
                    transition-transform duration-150 ease-out active:scale-[0.97]"
                  style={{ backgroundColor: SNOW, color: '#161616', borderRadius: RADIUS }}
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </header>

        <Rule tone="inverse" />

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 pb-20 pt-16 text-center sm:px-10 sm:pt-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[34%] h-[640px] w-[900px] max-w-none -translate-x-1/2"
            style={{ background: glow(0.3), filter: 'blur(60px)' }}
          />
          <div className="relative z-[2]">
            <motion.p
              className="m-0 mb-6 font-mono text-[12px] uppercase tracking-[0.24em]"
              style={{ color: TEXT_FAINT }}
              initial={reduced ? {} : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              Introducing {APP_NAME} for iPhone
            </motion.p>
            <motion.h1
              className="mx-auto max-w-[16ch] font-black"
              style={{
                fontSize: 'clamp(2.375rem, 6.2vw, 4.125rem)',
                letterSpacing: '-0.035em',
                lineHeight: 0.98,
              }}
              initial={reduced ? {} : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.6, ease: REVEAL_EASE }}
            >
              The pocket companion to your paper trail
            </motion.h1>
            <motion.p
              className="mx-auto mt-6 max-w-[40ch] text-[19px] leading-[1.5]"
              style={{ color: TEXT_MUTED }}
              initial={reduced ? {} : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.5, ease: 'easeOut' }}
            >
              Every renewal in compact form. Coming soon for iPhone, always in sync with the web.
            </motion.p>
            <motion.div
              className="mt-9"
              initial={reduced ? {} : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.5, ease: 'easeOut' }}
            >
              <ScanRow withWebCta />
            </motion.div>
          </div>
          {/* Two layers on purpose: the outer one runs the one-off entrance, the
              inner one the endless hover. Folding both into a single repeating
              keyframe array would replay the entrance on every 6s cycle. */}
          <motion.div
            className="relative z-[2] mt-11 flex justify-center"
            initial={reduced ? {} : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.6, ease: REVEAL_EASE }}
          >
            <motion.div
              animate={reduced ? {} : { y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ willChange: reduced ? undefined : 'transform' }}
            >
              <PhoneShot
                src="/ios/home.webp"
                alt={`The ${APP_NAME} Overview screen on iPhone, listing upcoming renewals`}
                family={PADDED}
                deviceHeight={DEVICE_HERO}
                shadow={SHADOW_HERO}
                priority
              />
            </motion.div>
          </motion.div>
        </section>

        <Rule tone="inverse" />

        {/* ── Intro statement + 2-up cards ────────────────────────────────── */}
        <section className="px-5 py-[72px] sm:px-10 lg:px-14">
          <Reveal>
            <p
              className="mx-auto max-w-[52ch] text-center text-[20px] font-semibold leading-[1.45] tracking-[-0.01em] sm:text-[24px]"
              style={{ color: 'rgba(250,250,248,0.85)' }}
            >
              Built for the moments away from your desk. {APP_NAME} for iPhone is purpose-designed for
              the quick jobs that keep your paper trail current — a powerful sidekick, always in your
              pocket.
            </p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-7 md:grid-cols-2">
            <Reveal className="h-full">
              <FeatureCard
                eyebrow="On the spot"
                title="Snap any receipt"
                body={`Photograph a receipt or invoice and ${APP_NAME} reads every line, then files the renewal for you.`}
                titleClass="text-[22px] sm:text-[26px] tracking-[-0.02em]"
              >
                <PhoneShot
                  src="/ios/uploading.webp"
                  alt={`${APP_NAME} reading the details off a photographed receipt`}
                  family={PADDED}
                  deviceHeight={DEVICE_CARD}
                  shadow={SHADOW_CARD}
                />
              </FeatureCard>
            </Reveal>
            <Reveal delay={0.08} className="h-full">
              <FeatureCard
                eyebrow="Right on time"
                title="A nudge before it charges"
                body="Push reminders land days ahead of every renewal, timed to each billing cycle."
                titleClass="text-[22px] sm:text-[26px] tracking-[-0.02em]"
              >
                <PhoneShot
                  src="/ios/push.webp"
                  alt={`A ${APP_NAME} renewal reminder on the iPhone lock screen`}
                  family={PADDED}
                  deviceHeight={DEVICE_CARD}
                  shadow={SHADOW_CARD}
                />
              </FeatureCard>
            </Reveal>
          </div>
        </section>

        <Rule tone="inverse" />

        {/* ── Section A — the timeline ────────────────────────────────────── */}
        <section className="px-5 py-[88px] sm:px-10 lg:px-14 lg:py-[110px]">
          <Reveal>
            {/* The `ch` cap belongs to the sub-paragraph, not the block. The
                prototype put it on the wrapper, which squeezed the 44px heading
                into three cramped lines (`ch` there resolves against the
                inherited 16px, not the heading's own size). */}
            <div className="text-center">
              <h2
                className="m-0 mb-[18px] max-w-[18ch] font-extrabold mx-auto"
                style={{
                  fontSize: 'clamp(1.875rem, 4.2vw, 2.75rem)',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.05,
                }}
              >
                Stay on top of every renewal
              </h2>
              <p
                className="m-0 mx-auto max-w-[38ch] text-[17px] leading-[1.55]"
                style={{ color: TEXT_MUTED }}
              >
                The timeline keeps what&rsquo;s due next in front of you. Tap to review, edit in place,
                or mute what you don&rsquo;t want to hear about.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="mt-12 flex justify-center">
            <PhoneShot
              src="/ios/timeline.webp"
              alt={`The ${APP_NAME} timeline on iPhone, showing what is due next`}
              family={TIGHT}
              deviceHeight={DEVICE_BIG}
              shadow={SHADOW_BIG}
            />
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-7 md:grid-cols-2">
            <Reveal className="h-full">
              <FeatureCard
                title="Tap into any charge"
                body="Open a subscription to see cost, cycle, next renewal and your own notes at a glance."
                titleClass="text-[20px] sm:text-[22px] tracking-[-0.01em]"
              >
                <PhoneShot
                  src="/ios/details-sub.webp"
                  alt={`A ${APP_NAME} subscription's detail sheet on iPhone`}
                  family={PADDED}
                  deviceHeight={DEVICE_SUBCARD}
                  shadow={SHADOW_CARD}
                />
              </FeatureCard>
            </Reveal>
            <Reveal delay={0.08} className="h-full">
              <FeatureCard
                title="Tune every reminder"
                body="Email, push, or both — with timing that adapts to weekly, monthly and annual cycles."
                titleClass="text-[20px] sm:text-[22px] tracking-[-0.01em]"
              >
                {/* Same DEVICE_SUBCARD as its neighbour — a tight-family asset,
                    so it resolves to a narrower image box around the same phone. */}
                <PhoneShot
                  src="/ios/notifications.webp"
                  alt={`${APP_NAME} notification settings on iPhone`}
                  family={TIGHT}
                  deviceHeight={DEVICE_SUBCARD}
                  shadow={SHADOW_CARD}
                />
              </FeatureCard>
            </Reveal>
          </div>
        </section>

        <Rule tone="inverse" />

        {/* ── Section B — cross-device ────────────────────────────────────── */}
        <section className="px-5 py-[88px] sm:px-10 lg:px-14 lg:py-[110px]">
          <Reveal>
            <div className="text-center">
              <h2
                className="m-0 mb-[18px] font-extrabold"
                style={{
                  fontSize: 'clamp(1.875rem, 4.2vw, 2.75rem)',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.05,
                }}
              >
                Add it anywhere.
                <br />
                It&rsquo;s everywhere.
              </h2>
              <p
                className="m-0 mx-auto max-w-[40ch] text-[17px] leading-[1.55]"
                style={{ color: TEXT_MUTED }}
              >
                Everything you add on the phone is waiting on the web — one account, one paper trail,
                every screen in sync.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="mt-12 flex justify-center">
            <PhoneShot
              src="/ios/subscriptions.webp"
              alt={`The ${APP_NAME} subscriptions grid on iPhone`}
              family={PADDED}
              deviceHeight={DEVICE_BIG}
              shadow={SHADOW_BIG}
            />
          </Reveal>
        </section>

        <Rule tone="inverse" />

        {/* ── Notifications split ─────────────────────────────────────────── */}
        <section className="px-5 py-[88px] sm:px-10 lg:px-14 lg:py-[110px]">
          <Reveal>
            <div
              // Even inset all round: the phone stands on the panel's bottom
              // padding rather than bleeding off its edge, matching the cards.
              className="grid grid-cols-1 items-center gap-8 overflow-hidden px-7 py-10
                sm:px-14 sm:py-14 md:grid-cols-[1fr_0.8fr] md:gap-12"
              style={{ backgroundColor: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: RADIUS }}
            >
              <div>
                <h2
                  className="m-0 mb-7 font-extrabold"
                  style={{
                    fontSize: 'clamp(1.75rem, 3.8vw, 2.5rem)',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.06,
                  }}
                >
                  Available 24/7.
                  <br />
                  Or just 9&ndash;5.
                </h2>
                <div className="flex flex-col gap-[22px]">
                  <div>
                    <p className="m-0 mb-1 text-[16px] font-bold">Realtime reminders</p>
                    <p
                      className="m-0 max-w-[42ch] text-[14.5px] leading-[1.55]"
                      style={{ color: 'rgba(250,250,248,0.58)' }}
                    >
                      Stay ahead of every renewal and take action the moment something needs you —
                      wherever you are.
                    </p>
                  </div>
                  <div>
                    <p className="m-0 mb-1 text-[16px] font-bold">On your schedule</p>
                    <p
                      className="m-0 max-w-[42ch] text-[14.5px] leading-[1.55]"
                      style={{ color: 'rgba(250,250,248,0.58)' }}
                    >
                      Pick email, push, or both, and mute individual subscriptions when you don&rsquo;t
                      want the heads-up.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center self-end">
                <PhoneShot
                  src="/ios/notifications.webp"
                  alt={`${APP_NAME} notification settings on iPhone`}
                  family={TIGHT}
                  deviceHeight={DEVICE_PANEL}
                  shadow={SHADOW_PANEL}
                />
              </div>
            </div>
          </Reveal>
        </section>

        <Rule tone="inverse" />

        {/* ── Closing CTA ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 py-24 text-center sm:px-10 lg:py-[120px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[20%] h-[520px] w-[760px] max-w-none -translate-x-1/2"
            style={{ background: glow(0.26), filter: 'blur(60px)' }}
          />
          <Reveal className="relative z-[2]">
            <h2
              className="mx-auto mb-8 max-w-[16ch] font-black"
              style={{
                fontSize: 'clamp(2.125rem, 5.2vw, 3.5rem)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              Ready wherever you are
            </h2>
            <ScanRow />
          </Reveal>
        </section>

        <Rule tone="inverse" />

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-4 px-5 py-8 sm:px-14">
          <div className="flex items-center gap-2.5 text-[13px]" style={{ color: 'rgba(250,250,248,0.5)' }}>
            <Logo variant="wordmark-inverse" height={16} />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[13px]">
            <Link
              to="/terms"
              onClick={() => window.scrollTo(0, 0)}
              className="transition-colors hover:text-brand-orange"
              style={{ color: TEXT_MUTED }}
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              onClick={() => window.scrollTo(0, 0)}
              className="transition-colors hover:text-brand-orange"
              style={{ color: TEXT_MUTED }}
            >
              Privacy
            </Link>
            <Link
              to="/support"
              onClick={() => window.scrollTo(0, 0)}
              className="transition-colors hover:text-brand-orange"
              style={{ color: TEXT_MUTED }}
            >
              Support
            </Link>
          </div>
        </footer>

        <Rule tone="inverse" />
      </div>
    </div>
  );
}
