import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import axios from 'axios';
import { radius, spacing, type SubscriptionCandidate } from '@life-admin/shared';
import {
  pickDocument,
  pickFromCamera,
  pickFromGallery,
  type PickOutcome,
} from '../lib/receiptScan';
import { subscriptionApi } from '../lib/subscriptions';
import { getApiErrorMessage } from '../lib/utils';
import { ExtractionLoadingOverlay } from './ExtractionLoadingOverlay';
import { AppText, FormSheet, useToast, type FormSheetHandle } from './ui';
import {
  IconCamera,
  IconGallery,
  IconReceipt,
  IconEdit,
  type PayprIconComponent,
} from './icons';
import { colors } from '../lib/theme';

export interface ReceiptScanChooserHandle {
  /** Open the "add a subscription" chooser. */
  open: () => void;
}

interface Props {
  /** Chosen "Enter manually" — open the empty add form. */
  onManual: () => void;
  /** Extraction succeeded — open the add form pre-filled with the candidate. */
  onExtracted: (candidate: SubscriptionCandidate) => void;
}

interface Option {
  icon: PayprIconComponent;
  label: string;
  pick: () => Promise<PickOutcome>;
}

const SCAN_OPTIONS: Option[] = [
  { icon: IconCamera, label: 'Take a photo', pick: pickFromCamera },
  { icon: IconGallery, label: 'Choose from gallery', pick: pickFromGallery },
  { icon: IconReceipt, label: 'Upload a document', pick: pickDocument },
];

/**
 * The single entry point for adding a subscription. A bottom-sheet chooser with
 * three receipt-scan sources plus "Enter manually". A scan source captures/picks
 * a file, uploads it to POST /api/subscriptions/extract, and hands the first
 * candidate back to the caller to review in the add form. Any failure falls back
 * to manual entry so the user is never stuck — except a rate-limit, which just
 * asks them to wait.
 */
export const ReceiptScanChooser = forwardRef<ReceiptScanChooserHandle, Props>(
  function ReceiptScanChooser({ onManual, onExtracted }, ref) {
    const toast = useToast();
    const sheetRef = useRef<FormSheetHandle>(null);
    const [busy, setBusy] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.open(),
    }));

    const handleManual = useCallback(() => {
      sheetRef.current?.close();
      onManual();
    }, [onManual]);

    const runScan = useCallback(
      async (pick: () => Promise<PickOutcome>) => {
        const outcome = await pick();
        if (outcome.status === 'canceled') return;
        if (outcome.status === 'error') {
          toast.error(outcome.message);
          return;
        }

        sheetRef.current?.close();
        setBusy(true);
        // Always clear the loading overlay BEFORE presenting the form sheet or
        // showing a toast — presenting a bottom sheet while the overlay is still
        // mounted leaves the sheet's gestures dead (can't scroll or dismiss).
        try {
          const result = await subscriptionApi.extract(outcome.asset);
          setBusy(false);
          if (result.source === 'none' || result.candidates.length === 0) {
            toast.error("We couldn't read a subscription from that — enter the details manually.");
            onManual();
            return;
          }
          onExtracted(result.candidates[0]);
        } catch (err) {
          setBusy(false);
          // 429 means the per-user extract limit was hit — don't drop them into a
          // blank form, just ask them to wait. Anything else (503 unavailable,
          // network, etc.) falls back to manual entry.
          const status = axios.isAxiosError(err) ? err.response?.status : undefined;
          if (status === 429) {
            toast.error(
              getApiErrorMessage(err, 'Too many scans. Please wait a few minutes and try again.'),
            );
          } else {
            toast.error(
              getApiErrorMessage(err, 'AI scanning is unavailable right now — add it manually.'),
            );
            onManual();
          }
        }
      },
      [toast, onManual, onExtracted],
    );

    return (
      <>
        <FormSheet
          ref={sheetRef}
          title="Add a subscription"
          subtitle="Scan a receipt and we'll fill in the details for you to review."
          accessibilityLabel="Add a subscription"
        >
          {SCAN_OPTIONS.map(({ icon: Icon, label, pick }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => void runScan(pick)}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <Icon size={20} color={colors.foreground} />
              <AppText variant="headline" weight={600} style={styles.menuLabel}>{label}</AppText>
            </Pressable>
          ))}

          <View style={styles.divider} />

          <Pressable
            accessibilityRole="button"
            onPress={handleManual}
            style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
          >
            <IconEdit size={20} color={colors.mutedForeground} />
            <AppText variant="headline" weight={600} style={[styles.menuLabel, styles.menuLabelMuted]}>Enter manually</AppText>
          </Pressable>
        </FormSheet>

        {/* Branded extraction overlay (LIF-209). In-tree, not a native Modal —
            a Modal fights the bottom sheets and leaves gestures dead (LIF-208).
            Rendered last so it sits above the screen; it blocks taps while busy. */}
        <ExtractionLoadingOverlay visible={busy} />
      </>
    );
  },
);

const styles = StyleSheet.create({
  // Rows sit on the sheet's own body inset, but their pressed highlight bleeds
  // past it — hence the negative margin cancelled by an equal padding. This is
  // what lets the title keep the standard inset every other sheet's title has,
  // instead of the sheet overriding its body padding to suit the rows.
  menuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.base,
  },
  menuRowPressed: { backgroundColor: colors.secondary },
  menuLabel: { color: colors.foreground },
  menuLabelMuted: { color: colors.mutedForeground },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});
