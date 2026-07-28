import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { format, differenceInCalendarDays } from 'date-fns';
import {
  Subscription,
  billingCycles,
  categories,
  formatCurrency,
  getSubscriptionStatus,
  normalizeToMonthlyCost,
  parseRenewalDate,
  relativeDaysSigned,
} from '@life-admin/shared';
import { SubscriptionLogo } from './SubscriptionLogo';
import { AppText, Button } from './ui';
import { colors } from '../lib/theme';

export interface SubscriptionDetailSheetHandle {
  /** Open the read-only detail sheet for a subscription. */
  open: (subscription: Subscription) => void;
  /** Dismiss the sheet. */
  close: () => void;
}

interface Props {
  /** The Edit action was tapped. The parent handles the handoff to the edit form. */
  onEdit: (subscription: Subscription) => void;
  /** Fired once the sheet has fully dismissed — used to sequence the edit handoff. */
  onDismiss?: () => void;
}

const cycleLabel = (id: string) => billingCycles.find((c) => c.id === id)?.name ?? id;
const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

/**
 * Read-only details for a single subscription, shown when a row is tapped on the
 * Dashboard, Timeline, or Subscriptions list. Follows the "Quiet" language —
 * Archivo, near-monochrome, hairline dividers, brand orange spent only on the
 * primary action. The Edit button hands off to SubscriptionFormSheet (wired by
 * the parent), so this sheet never mutates anything itself.
 */
export const SubscriptionDetailSheet = forwardRef<SubscriptionDetailSheetHandle, Props>(
  function SubscriptionDetailSheet({ onEdit, onDismiss }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const [sub, setSub] = useState<Subscription | null>(null);

    useImperativeHandle(ref, () => ({
      open: (subscription) => {
        setSub(subscription);
        sheetRef.current?.present();
      },
      close: () => sheetRef.current?.dismiss(),
    }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
      ),
      [],
    );

    // Derived display values — guarded so a null sub (between dismissals) never throws.
    const view = useMemo(() => {
      if (!sub) return null;
      const cost = parseFloat(sub.cost);
      const status = getSubscriptionStatus(sub);
      const renewal = parseRenewalDate(sub.nextRenewalDate);
      const monthly = normalizeToMonthlyCost(cost, sub.billingCycle);
      return {
        status,
        price: formatCurrency(cost, sub.currency),
        cycle: cycleLabel(sub.billingCycle),
        // Only worth showing a monthly-equivalent when the cycle isn't already monthly.
        monthly: sub.billingCycle === 'monthly' ? null : formatCurrency(monthly, sub.currency),
        renewalDate: format(renewal, 'EEE, MMM d, yyyy'),
        renewalRelative: relativeDaysSigned(differenceInCalendarDays(renewal, new Date())),
        category: categoryLabel(sub.category),
        notes: sub.notes?.trim() || null,
      };
    }, [sub]);

    // Status reads as text, not a coloured pill — the Quiet language keeps brand
    // orange for the primary action only.
    const statusLine =
      view?.status === 'cancelling'
        ? `Cancelling · ends ${view.renewalDate}`
        : view?.status === 'ended'
          ? `Ended ${view?.renewalDate}`
          : `Renews ${view?.renewalDate}`;

    return (
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        onDismiss={onDismiss}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        {/* Dynamic sizing hugs the content, so the sheet is only as tall as it
            needs to be and the Edit button lands just above the home indicator
            rather than floating with dead space beneath it. */}
        <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
          {sub && view && (
            <>
              {/* Header — logo, name, status line */}
              <View style={styles.header}>
                <SubscriptionLogo name={sub.name} category={sub.category} size={44} />
                <View style={styles.headerText}>
                  <AppText variant="title" numberOfLines={1} style={styles.name}>
                    {sub.name}
                  </AppText>
                  <AppText variant="footnote" numberOfLines={1} style={styles.status}>
                    {statusLine}
                  </AppText>
                </View>
              </View>

              {/* Detail rows — label / value pairs on hairline rules */}
              <View style={styles.rows}>
                <DetailRow label="Cost" value={view.price} sub={view.cycle} mono />
                {view.monthly && <DetailRow label="Per month" value={view.monthly} mono />}
                <DetailRow label="Next renewal" value={view.renewalDate} sub={view.renewalRelative} />
                <DetailRow label="Category" value={view.category} />
                {view.notes && <DetailRow label="Notes" value={view.notes} stacked />}
              </View>

              <Button
                title="Edit subscription"
                onPress={() => onEdit(sub)}
                style={styles.editButton}
                accessibilityLabel={`Edit ${sub.name}`}
              />
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

function DetailRow({
  label,
  value,
  sub,
  mono,
  stacked,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  stacked?: boolean;
}) {
  return (
    <View style={[styles.row, stacked && styles.rowStacked]}>
      {/* Label matches the value's 15px so the two columns read as one scale. */}
      <AppText variant="body" style={styles.rowLabel}>
        {label}
      </AppText>
      <View style={stacked ? styles.rowValueStacked : styles.rowValue}>
        <AppText
          variant={mono ? 'monoData' : 'body'}
          weight={mono ? undefined : 500}
          style={[
            styles.rowValueText,
            // monoData is 13px; bump it to 15 so the amount isn't smaller than
            // the plain-text values (matches the Subscriptions row price).
            mono && styles.rowValueMono,
            stacked && styles.rowValueTextStacked,
          ]}
        >
          {value}
        </AppText>
        {sub && (
          <AppText variant="footnote" style={styles.rowSub}>
            {sub}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  headerText: { flex: 1, minWidth: 0 },
  name: { color: colors.foreground },
  status: { color: colors.softMuted, marginTop: 2 },

  rows: { marginBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowDivider,
  },
  rowStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  rowLabel: { color: colors.softMuted },
  rowValue: { flexShrink: 1, alignItems: 'flex-end' },
  rowValueStacked: { alignSelf: 'stretch' },
  rowValueText: { color: colors.foreground, textAlign: 'right' },
  rowValueMono: { fontSize: 15 },
  rowValueTextStacked: { textAlign: 'left' },
  rowSub: { color: colors.softMuted, marginTop: 2 },

  // Sits just below the rows; dynamic sizing + the sheet's safe-area padding
  // carry it down near the home indicator.
  editButton: { marginTop: 28 },
});
