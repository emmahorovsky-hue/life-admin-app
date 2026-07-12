import { createElement, useState } from 'react';
import { cn } from '@/lib/utils';
import { categoryIconFor, logoUrlForName } from '@/lib/subscriptionLogo';

interface SubscriptionLogoProps {
  name: string;
  category: string;
  /** Rendered width/height in px. */
  size?: number;
  className?: string;
}

/**
 * A rounded brand-logo tile for a subscription. Shows the brand's logo (from
 * logo.dev, derived from the name) when available, and falls back to the
 * category icon when there's no logo URL or the image fails to load.
 */
export function SubscriptionLogo({
  name,
  category,
  size = 36,
  className,
}: SubscriptionLogoProps) {
  const url = logoUrlForName(name);
  const [failed, setFailed] = useState(false);

  // Reset the error state when the name changes so a row reused for a different
  // subscription re-attempts its own logo. Adjusted during render so the retry
  // happens in the same paint as the new name.
  const [prevName, setPrevName] = useState(name);
  if (name !== prevName) {
    setPrevName(name);
    setFailed(false);
  }

  const box = cn(
    'shrink-0 rounded-md overflow-hidden flex items-center justify-center',
    className
  );
  const style = { width: size, height: size };

  if (url && !failed) {
    // Brand logos are transparent PNGs, so they sit on a plain white chip with
    // a subtle border (the same in light and dark mode). Using bg-muted here
    // tinted colored logos on the beige surface and hid dark logos in dark mode.
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className={cn(box, 'bg-white object-contain ring-1 ring-border')}
        style={style}
      />
    );
  }

  // categoryIconFor returns a stable, module-level lucide component — not one
  // created per render — so render it via createElement rather than assigning it
  // to a local (which reads as defining a component during render).
  return (
    <span className={cn(box, 'bg-muted text-muted-foreground')} style={style}>
      {createElement(categoryIconFor(category), {
        size: Math.round(size * 0.55),
        'aria-hidden': true,
      })}
    </span>
  );
}
