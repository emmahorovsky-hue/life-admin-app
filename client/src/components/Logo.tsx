import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

export type LogoVariant = 'auto' | 'wordmark' | 'wordmark-inverse' | 'mark';

interface LogoProps {
  /**
   * `auto` — the wordmark that adapts to the surface: dark ink on light, the
   *   inverse (white) lockup under `.dark` (default).
   * `wordmark` — force the dark-ink lockup (light surfaces).
   * `wordmark-inverse` — force the white lockup (dark surfaces).
   * `mark` — the standalone "P." tile (favicon / avatar).
   */
  variant?: LogoVariant;
  /** Rendered height in px. Width scales to preserve the source aspect ratio. */
  height?: number;
  className?: string;
}

// Source assets live in client/public. Wordmarks are 1627×512; the mark is square.
const SOURCES: Record<Exclude<LogoVariant, 'auto'>, { src: string; aspect: number }> = {
  wordmark: { src: '/paypr-wordmark.png', aspect: 1627 / 512 },
  'wordmark-inverse': { src: '/paypr-wordmark-inverse.png', aspect: 1627 / 512 },
  mark: { src: '/favicon.svg', aspect: 1 },
};

function WordmarkImg({
  variant,
  height,
  className,
}: {
  variant: Exclude<LogoVariant, 'auto'>;
  height: number;
  className?: string;
}) {
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

/**
 * The single source of truth for the Paypr logo. Replaces the ad-hoc text
 * wordmarks (previously styled with three different font weights) so the brand
 * renders identically across the app shell, auth screens, and landing page.
 */
export function Logo({ variant = 'auto', height = 28, className }: LogoProps) {
  if (variant === 'auto') {
    // Render both lockups and let the theme class pick — dark ink on light
    // surfaces, the white inverse under `.dark`. No JS/theme hook needed, so it
    // stays correct through the pre-paint FOUC guard.
    return (
      <>
        <WordmarkImg variant="wordmark" height={height} className={cn('dark:hidden', className)} />
        <WordmarkImg
          variant="wordmark-inverse"
          height={height}
          className={cn('hidden dark:block', className)}
        />
      </>
    );
  }
  return <WordmarkImg variant={variant} height={height} className={className} />;
}
