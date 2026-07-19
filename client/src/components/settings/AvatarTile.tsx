import { useEffect, useRef, useState } from 'react';
import { Camera, Pencil, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { avatarUrl, uploadAvatar, deleteAvatar } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { getInitials } from '@life-admin/shared';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — matches the server limit

const sizes = {
  md: { tile: 'h-[60px] w-[60px] text-[24px]', badge: 'h-[22px] w-[22px]', badgeIcon: 'h-3 w-3' },
  lg: { tile: 'h-[72px] w-[72px] text-[28px]', badge: 'h-[26px] w-[26px]', badgeIcon: 'h-3.5 w-3.5' },
} as const;

interface AvatarTileProps {
  size?: keyof typeof sizes;
  className?: string;
}

/**
 * Ink initials tile with the orange photo badge — the design's only photo
 * control (LIF-187). With no photo the badge is a camera that opens the file
 * picker directly. Once the user has their own photo the badge becomes a pencil
 * that opens a small menu (Upload new photo / Remove photo — LIF-192). Uploads
 * and removals go through the account avatar endpoints and refresh the user.
 */
export function AvatarTile({ size = 'lg', className }: AvatarTileProps) {
  const { user, updateUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const s = sizes[size];

  const version = user?.avatarUpdatedAt ?? null;
  const showImage = Boolean(version) && !imgError;

  // Close the edit menu on outside pointer or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const openPicker = () => {
    setMenuOpen(false);
    inputRef.current?.click();
  };

  const handleBadgeClick = () => {
    // Pristine tile → straight to the picker; own photo → the edit menu.
    if (showImage) setMenuOpen((v) => !v);
    else openPicker();
  };

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
    setMenuOpen(false);
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
    <div className={cn('relative shrink-0', className)} ref={menuRef}>
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
        onClick={handleBadgeClick}
        disabled={busy}
        aria-label={showImage ? 'Edit photo' : 'Add photo'}
        aria-haspopup={showImage ? 'menu' : undefined}
        aria-expanded={showImage ? menuOpen : undefined}
        className={cn(
          'absolute -bottom-1.5 -right-1.5 flex items-center justify-center rounded-[2px] border-2 border-white bg-brand-orange text-[#FAFAF8] disabled:opacity-60 dark:border-card',
          s.badge
        )}
      >
        {showImage ? (
          <Pencil className={s.badgeIcon} strokeWidth={2} />
        ) : (
          <Camera className={s.badgeIcon} strokeWidth={2} />
        )}
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

      {showImage && menuOpen && (
        <div
          role="menu"
          aria-label="Photo options"
          className="absolute left-1/2 top-full z-40 mt-2 w-44 -translate-x-1/2 overflow-hidden rounded-[2px] border border-foreground bg-card py-1 shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={openPicker}
            disabled={busy}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
          >
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
            Upload new photo
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleRemove}
            disabled={busy}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            Remove photo
          </button>
        </div>
      )}
    </div>
  );
}
