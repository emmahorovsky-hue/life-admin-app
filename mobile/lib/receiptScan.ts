import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  BILLING_CYCLES,
  categories,
  currencies,
  type SubscriptionCandidate,
  type SubscriptionFormValues,
} from '@life-admin/shared';
import type { UploadAsset } from './subscriptions';

// Mirrors the server's receiptUpload limits (server/src/middleware/receiptUpload.ts
// + aiService ALLOWED_UPLOAD_MIME_TYPES): PDF or a supported image, up to 10 MB.
// Reject locally with the same copy instead of paying for a doomed upload.
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** The result of asking the user to pick/capture a file. */
export type PickOutcome =
  | { status: 'ok'; asset: UploadAsset }
  | { status: 'canceled' }
  | { status: 'error'; message: string };

/** Best-effort MIME type from an explicit value, then the file extension. */
function mimeFromNameOrUri(value: string | null | undefined): string | null {
  if (!value) return null;
  const ext = value.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? null;
}

/** Validate mime + size (server rules) and package into an UploadAsset. */
function finalize(uri: string, name: string, type: string, size: number | null): PickOutcome {
  if (!(ALLOWED_MIME as readonly string[]).includes(type)) {
    return { status: 'error', message: 'Unsupported file. Use a PDF, PNG, JPEG, or WebP.' };
  }
  if (size != null && size > MAX_BYTES) {
    return { status: 'error', message: 'That file is too large. Max 10 MB.' };
  }
  return { status: 'ok', asset: { uri, name, type } };
}

/** Normalize an expo-image-picker result (camera or library). */
function fromImagePicker(result: ImagePicker.ImagePickerResult): PickOutcome {
  if (result.canceled) return { status: 'canceled' };
  const asset = result.assets[0];
  const type = asset.mimeType ?? mimeFromNameOrUri(asset.fileName ?? asset.uri) ?? 'image/jpeg';
  const name = asset.fileName ?? (type === 'image/png' ? 'receipt.png' : 'receipt.jpg');
  return finalize(asset.uri, name, type, asset.fileSize ?? null);
}

/** Capture a receipt with the camera. Handles the permission prompt. */
export async function pickFromCamera(): Promise<PickOutcome> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    return {
      status: 'error',
      message: 'Camera access is off. Enable it in Settings to scan a receipt.',
    };
  }
  try {
    // quality < 1 re-encodes to JPEG, which keeps raw HEIC out of the upload.
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    return fromImagePicker(result);
  } catch {
    return { status: 'error', message: 'Could not open the camera.' };
  }
}

/** Pick a receipt image from the photo library. */
export async function pickFromGallery(): Promise<PickOutcome> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    return fromImagePicker(result);
  } catch {
    return { status: 'error', message: 'Could not open the photo library.' };
  }
}

/** Pick a PDF or image document. */
export async function pickDocument(): Promise<PickOutcome> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: [...ALLOWED_MIME],
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    return { status: 'error', message: 'Could not open your documents.' };
  }
  if (result.canceled) return { status: 'canceled' };
  const asset = result.assets[0];
  const type = asset.mimeType ?? mimeFromNameOrUri(asset.name) ?? '';
  return finalize(asset.uri, asset.name, type, asset.size ?? null);
}

export interface CandidatePrefill {
  values: Partial<SubscriptionFormValues>;
  costText: string;
  uncertainFields: string[];
}

/**
 * Map an extracted SubscriptionCandidate onto the add-form's values, clamping
 * anything the form can't represent to a safe default (the server may return a
 * currency/category outside the mobile form's fixed sets). A null cost stays
 * blank so the user fills it — the form requires cost > 0 to save.
 */
export function candidateToFormPrefill(c: SubscriptionCandidate): CandidatePrefill {
  const currency = c.currency && currencies.includes(c.currency) ? c.currency : 'SGD';
  const billingCycle = (BILLING_CYCLES as readonly string[]).includes(c.billingCycle)
    ? c.billingCycle
    : 'monthly';
  const category = categories.some((cat) => cat.id === c.category) ? c.category : 'other';
  const renewalDate = c.renewalDate ?? new Date().toISOString().slice(0, 10);

  return {
    values: {
      name: c.name ?? '',
      cost: c.cost ?? 0,
      currency,
      billingCycle,
      renewalDate,
      category,
      notes: c.notes ?? '',
    },
    costText: c.cost != null ? String(c.cost) : '',
    uncertainFields: c.uncertainFields ?? [],
  };
}
