import { useEffect, useState } from 'react';
import { ImageURISource } from 'react-native';
import { ImagePickerAsset } from 'expo-image-picker';
import { User } from '@life-admin/shared';
import { api, apiBaseUrl } from './api';
import { tokenStorage } from './storage';

// Mirrors the server's multer limits (server/src/middleware/avatarUpload.ts)
// and the web client's pre-flight checks — reject locally with the same copy
// instead of paying for a doomed upload.
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/**
 * Best-effort MIME type for a picked asset: picker metadata first, then the
 * file extension. Returns null when neither identifies the image (e.g. a
 * raw HEIC that skipped the picker's re-encode).
 */
function assetMimeType(asset: ImagePickerAsset): string | null {
  if (asset.mimeType) return asset.mimeType;
  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? null;
}

/**
 * Client-side validation matching the server's rules (JPEG/PNG, ≤ 2 MB).
 * Returns a user-facing error message, or null when the asset is uploadable.
 * `fileSize` can be absent on some Android pickers — then the server's own
 * limit is the backstop, with the same wording.
 */
export function avatarAssetError(asset: ImagePickerAsset): string | null {
  const type = assetMimeType(asset);
  if (!type || !(ACCEPTED_MIME_TYPES as readonly string[]).includes(type)) {
    return 'Unsupported file type. Choose a JPG or PNG.';
  }
  if (asset.fileSize != null && asset.fileSize > MAX_BYTES) {
    return 'That image is too large. JPG or PNG, up to 2 MB.';
  }
  return null;
}

/** Upload a picked image as the account avatar. Returns the refreshed user. */
export const uploadAvatar = async (asset: ImagePickerAsset) => {
  const type = assetMimeType(asset) ?? 'image/jpeg';
  const name = asset.fileName ?? (type === 'image/png' ? 'avatar.png' : 'avatar.jpg');
  const form = new FormData();
  // React Native FormData takes a { uri, name, type } descriptor instead of a
  // web File/Blob — the native networking layer streams the file at `uri`.
  // The server's multer field is `file` (see avatarUpload.ts).
  form.append('file', { uri: asset.uri, name, type } as unknown as Blob);
  return api.post<{ user: User }>('/account/avatar', form, {
    // Override the instance's application/json default. RN's networking layer
    // replaces this with the full multipart header including the boundary.
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/** Remove the account avatar. Returns the refreshed user (initials fallback). */
export const deleteAvatar = async () => {
  return api.delete<{ user: User }>('/account/avatar');
};

/**
 * Image source for the current user's avatar. GET /account/avatar requires
 * auth and <Image> requests bypass the axios interceptor, so the Bearer token
 * from secure storage rides along as a source header. `version` is the user's
 * `avatarUpdatedAt` — baked into the URL as ?v= so every new upload is a new
 * cache key (this is also the mitigation for Android's flaky handling of
 * cached image requests with auth headers).
 *
 * Returns null while the token loads or when there is no avatar (`version`
 * null/undefined) — callers show the initials tile then.
 */
export function useAvatarSource(version: string | null | undefined): ImageURISource | null {
  const [source, setSource] = useState<ImageURISource | null>(null);

  useEffect(() => {
    if (!version) {
      setSource(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await tokenStorage.get();
      if (cancelled) return;
      if (!token) {
        setSource(null);
        return;
      }
      setSource({
        uri: `${apiBaseUrl}/account/avatar?v=${encodeURIComponent(version)}`,
        headers: { Authorization: `Bearer ${token}` },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  return source;
}
