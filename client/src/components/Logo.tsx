import { APP_NAME } from '@/lib/constants';

export type LogoVariant = 'wordmark' | 'wordmark-inverse' | 'mark';

interface LogoProps {
  /**
   * `wordmark` — horizontal "Paypr" lockup for light surfaces (default).
   * `wordmark-inverse` — same lockup for dark surfaces.
   * `mark` — the standalone "P." tile (favicon / avatar).
   */
  variant?: LogoVariant;
  /** Rendered height in px. Width scales to preserve the source aspect ratio. */
  height?: number;
  className?: string;
}

// Source assets live in client/public. Wordmarks are 1627×512; the mark is square.
const SOURCES: Record<LogoVariant, { src: string; aspect: number }> = {
  wordmark: { src: '/paypr-wordmark.png', aspect: 1627 / 512 },
  'wordmark-inverse': { src: '/paypr-wordmark-inverse.png', aspect: 1627 / 512 },
  mark: { src: '/favicon.svg', aspect: 1 },
};

/**
 * The single source of truth for the Paypr logo. Replaces the ad-hoc text
 * wordmarks (previously styled with three different font weights) so the brand
 * renders identically across the app shell, auth screens, and landing page.
 */
export function Logo({ variant = 'wordmark', height = 28, className }: LogoProps) {
  const { src, aspect } = SOURCES[variant];
  const width = Math.round(height * aspect);
  return (
    <img
      src={src}
      alt={APP_NAME}
      width={width}
      height={height}
      draggable={false}
      className={className}
      style={{ height, width }}
    />
  );
}
