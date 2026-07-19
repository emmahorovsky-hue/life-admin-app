import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import { useToast } from './ui';
import { colors, fonts } from '../lib/theme';

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
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  pick: () => Promise<PickOutcome>;
}

const SCAN_OPTIONS: Option[] = [
  { icon: 'camera-outline', label: 'Take a photo', pick: pickFromCamera },
  { icon: 'images-outline', label: 'Choose from gallery', pick: pickFromGallery },
  { icon: 'document-text-outline', label: 'Upload a document', pick: pickDocument },
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
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const [busy, setBusy] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.present(),
    }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
      ),
      [],
    );

    const handleManual = useCallback(() => {
      sheetRef.current?.dismiss();
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

        sheetRef.current?.dismiss();
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
        <BottomSheetModal
          ref={sheetRef}
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={{ backgroundColor: colors.border }}
        >
          <BottomSheetView
            accessibilityLabel="Add a subscription"
            style={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.lg }]}
          >
            <Text style={styles.sheetTitle}>Add a subscription</Text>
            <Text style={styles.sheetSubtitle}>
              Scan a receipt and we&apos;ll fill in the details for you to review.
            </Text>

            {SCAN_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                accessibilityRole="button"
                onPress={() => void runScan(opt.pick)}
                style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              >
                <Ionicons name={opt.icon} size={20} color={colors.foreground} />
                <Text style={styles.menuLabel}>{opt.label}</Text>
              </Pressable>
            ))}

            <View style={styles.divider} />

            <Pressable
              accessibilityRole="button"
              onPress={handleManual}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
            >
              <Ionicons name="create-outline" size={20} color={colors.mutedForeground} />
              <Text style={[styles.menuLabel, styles.menuLabelMuted]}>Enter manually</Text>
            </Pressable>
          </BottomSheetView>
        </BottomSheetModal>

        {/* In-tree overlay (not a native Modal, which fights the bottom sheets).
            Rendered last so it sits above the screen; pointerEvents blocks taps
            while extracting. */}
        {busy && (
          <View style={styles.overlay} pointerEvents="auto">
            <View style={styles.overlayCard}>
              <ActivityIndicator size="large" color={colors.brandOrange} />
              <Text style={styles.overlayText}>Reading your receipt…</Text>
            </View>
          </View>
        )}
      </>
    );
  },
);

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.card, borderRadius: radius.base },
  sheetContent: { paddingTop: spacing.sm, paddingHorizontal: spacing.sm },
  sheetTitle: {
    fontFamily: fonts.sans.extrabold,
    fontSize: 18,
    color: colors.foreground,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  sheetSubtitle: {
    fontFamily: fonts.sans.regular,
    fontSize: 13,
    color: colors.mutedForeground,
    paddingHorizontal: spacing.lg,
    marginTop: 4,
    marginBottom: spacing.sm,
  },

  menuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.base,
  },
  menuRowPressed: { backgroundColor: colors.secondary },
  menuLabel: { fontFamily: fonts.sans.semibold, fontSize: 16, color: colors.foreground },
  menuLabelMuted: { color: colors.mutedForeground },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.lg,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayCard: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.base,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    minWidth: 200,
  },
  overlayText: { fontFamily: fonts.sans.semibold, fontSize: 14, color: colors.foreground },
});
