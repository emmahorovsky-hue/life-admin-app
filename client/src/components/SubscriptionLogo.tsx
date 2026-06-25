import { useEffect, useState } from 'react';
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
  // subscription re-attempts its own logo.
  useEffect(() => setFailed(false), [name]);

  const box = cn(
    'shrink-0 rounded-md overflow-hidden flex items-center justify-center',
    className
  );
  const style = { width: size, height: size };

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
        className={cn(box, 'bg-muted object-contain')}
        style={style}
      />
    );
  }

  const Icon = categoryIconFor(category);
  return (
    <span className={cn(box, 'bg-muted text-muted-foreground')} style={style}>
      <Icon size={Math.round(size * 0.55)} aria-hidden="true" />
    </span>
  );
}
