import { Camera } from 'lucide-react';
import type { User } from '@life-admin/shared';
import { cn } from '@/lib/utils';
import { getInitials } from './initials';

const sizes = {
  md: { tile: 'h-[60px] w-[60px] text-[24px]', badge: 'h-[22px] w-[22px]', badgeIcon: 'h-3 w-3' },
  lg: { tile: 'h-[72px] w-[72px] text-[28px]', badge: 'h-[26px] w-[26px]', badgeIcon: 'h-3.5 w-3.5' },
} as const;

interface AvatarTileProps {
  user: Pick<User, 'name' | 'surname' | 'email'> | null;
  size?: keyof typeof sizes;
  className?: string;
}

/**
 * Ink initials tile with the orange camera badge — the design's only photo
 * control. The badge is decorative until the avatar-upload flow ships
 * (LIF-187), which turns it into the file-picker trigger.
 */
export function AvatarTile({ user, size = 'lg', className }: AvatarTileProps) {
  const s = sizes[size];
  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-[2px] bg-primary font-extrabold text-primary-foreground',
          s.tile
        )}
      >
        {getInitials(user)}
      </div>
      <span
        aria-hidden="true"
        className={cn(
          'absolute -bottom-1.5 -right-1.5 flex items-center justify-center rounded-[2px] bg-brand-orange text-[#FAFAF8] border-2 border-white dark:border-card',
          s.badge
        )}
      >
        <Camera className={s.badgeIcon} strokeWidth={2} />
      </span>
    </div>
  );
}
