import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { avatarUrl, uploadAvatar, deleteAvatar } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { getInitials } from './initials';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — matches the server limit

const sizes = {
  md: { tile: 'h-[60px] w-[60px] text-[24px]', badge: 'h-[22px] w-[22px]', badgeIcon: 'h-3 w-3' },
  lg: { tile: 'h-[72px] w-[72px] text-[28px]', badge: 'h-[26px] w-[26px]', badgeIcon: 'h-3.5 w-3.5' },
} as const;

interface AvatarTileProps {
  size?: keyof typeof sizes;
  /** Show the "Remove photo" affordance under the tile when an avatar exists. */
  allowRemove?: boolean;
  className?: string;
}

/**
 * Ink initials tile with the orange camera badge — the design's only photo
 * control (LIF-187). The badge opens the file picker; uploads and removals go
 * through the account avatar endpoints and refresh the user.
 */
export function AvatarTile({ size = 'lg', allowRemove = false, className }: AvatarTileProps) {
  const { user, updateUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState(false);
  const s = sizes[size];

  const version = user?.avatarUpdatedAt ?? null;
  const showImage = Boolean(version) && !imgError;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Unsupported file type. Choose a JPG or PNG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('That image is too large. JPG or PNG, up to 2 MB.');
      return;
    }
    setBusy(true);
    try {
      const res = await uploadAvatar(file);
      setImgError(false);
      updateUser(res.data.user);
      toast.success('Photo updated.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to upload photo. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      const res = await deleteAvatar();
      updateUser(res.data.user);
      toast.success('Photo removed.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to remove photo. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex shrink-0 flex-col items-center gap-1.5', className)}>
      <div className="relative">
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-[2px] bg-primary font-extrabold text-primary-foreground',
            s.tile
          )}
        >
          {showImage && version ? (
            <img
              key={version}
              src={avatarUrl(version)}
              alt="Your profile photo"
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            getInitials(user)
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Change photo"
          className={cn(
            'absolute -bottom-1.5 -right-1.5 flex items-center justify-center rounded-[2px] border-2 border-white bg-brand-orange text-[#FAFAF8] disabled:opacity-60 dark:border-card',
            s.badge
          )}
        >
          <Camera className={s.badgeIcon} strokeWidth={2} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            // Allow re-selecting the same file after a failed/removed upload.
            e.target.value = '';
          }}
        />
      </div>
      {allowRemove && showImage && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          Remove photo
        </button>
      )}
    </div>
  );
}
