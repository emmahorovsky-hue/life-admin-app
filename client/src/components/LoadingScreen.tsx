import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PAYPR_P_GLYPH, PAYPR_ORANGE_DOT } from '@/components/PayprMark';

interface LoadingScreenProps {
  /** Fill the viewport (default) vs. an in-content centered block for page-level use. */
  fullScreen?: boolean;
  /** Accessible label, also rendered sr-only for screen readers. */
  label?: string;
  /** Rendered mark size in px (square). */
  size?: number;
  className?: string;
}

/**
 * Branded loading state — the Paypr "P." mark (no background) with its orange
 * dot gently pulsing. Replaces the ad-hoc "Loading..." text across the app
 * shell, route-level Suspense fallback, and page fetches.
 */
export function LoadingScreen({
  fullScreen = true,
  label = 'Loading',
  size = 48,
  className,
}: LoadingScreenProps) {
  const reduced = useReducedMotion() ?? false;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        'flex items-center justify-center',
        fullScreen ? 'min-h-screen' : 'py-12',
        className
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        aria-hidden="true"
        focusable="false"
      >
        <path fillRule="evenodd" fill="hsl(var(--foreground))" d={PAYPR_P_GLYPH} />
        <motion.path
          fill="hsl(var(--brand-orange))"
          d={PAYPR_ORANGE_DOT}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          animate={reduced ? undefined : { scale: [1, 1.45, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
