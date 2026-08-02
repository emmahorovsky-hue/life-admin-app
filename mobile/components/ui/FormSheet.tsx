import {
  ReactNode,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@life-admin/shared';
import { colors } from '../../lib/theme';
import { SHEET_BACKDROP_OPACITY, SHEET_HANDLE } from '../../lib/quiet';
import { useSheetBackHandler } from '../../lib/useSheetBackHandler';
import { AppText } from './AppText';
import { GlassSheetBackground } from './GlassSurface';

/** The minimum every ref-driven sheet exposes; what a screen holds a ref to. */
export interface OpenableSheetHandle {
  open: () => void;
}

export interface FormSheetHandle extends OpenableSheetHandle {
  /** Dismiss. Deliberately a no-op while `locked`. */
  close: () => void;
}

export interface FormSheetProps {
  /** Heading at the top of the body. Omit for a menu that is only rows. */
  title?: string;
  /** Supporting line under `title`. Tightens the gap the title would otherwise carry. */
  subtitle?: string;
  children: ReactNode;
  /**
   * Buttons closing the sheet, stacked full-width below the body.
   *
   * Primary first, then the way out ("Save" above "Cancel") — the order every
   * sheet in the app reads in, and the reason this is a prop rather than
   * something callers append to `children`: it is what keeps that order and the
   * spacing above it from being re-decided per sheet.
   */
  actions?: ReactNode;
  /**
   * Refuse every dismissal route — pan-down, handle drag, backdrop tap, Android
   * hardware back, and `close()` on the handle — for an operation that must not
   * be interrupted partway.
   */
  locked?: boolean;
  /** Fired once the sheet has fully dismissed. Where a sheet clears secrets. */
  onDismiss?: () => void;
  accessibilityLabel?: string;
  /** Replaces the default body padding, for a menu that bleeds rows to the edges. */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The chrome every content-sized bottom sheet renders through (LIF-239).
 *
 * Settings used to ship two presentations at once — some overlays were bottom
 * sheets, four were centred AppDialog cards — and the split was arbitrary: two
 * rows on the same Account screen behaved differently. This is the one sheet
 * shape they all share now, and since the settings overlays were only ever half
 * the app's sheets, the subscription detail, receipt-scan chooser and biometric
 * opt-in sheets render through it too.
 *
 * Ref-driven (`open()`/`close()`), never a `visible` prop, matching the
 * convention the subscription sheets already established. A consequence worth
 * knowing: a sheet is mounted for the life of its screen rather than only while
 * open, so **form state does not reset itself** the way a conditionally-mounted
 * dialog's did. Seed state in `open()`, and clear anything sensitive in
 * `onDismiss`.
 *
 * **Every sheet is glass, text entry included.** This used to be conditional: a
 * `textEntry` prop dropped glass and swapped in a 0.5 scrim, because live text
 * over a refracting surface is the legibility case LIF-223 called out. That
 * split was chosen deliberately and reversed just as deliberately — it made
 * adjacent rows on one Account screen open visibly different sheets, which is
 * the thing this component exists to stop. If input legibility turns out to be
 * a real problem, fix it in `GlassSurface`'s sheet tint so the answer stays one
 * decision for all twelve, rather than reintroducing a per-sheet flag.
 *
 * Deliberately not the chrome for SubscriptionFormSheet or FirstRunSetupSheet:
 * those need fixed percentage snap points and a bounded inner scroll, which a
 * content-sized sheet cannot express. Adding `snapPoints` here to "finish the
 * job" would make this worse for the ten overlays that do fit. Those two match
 * this sheet by hand instead — see the note in quiet.ts.
 */
export const FormSheet = forwardRef<FormSheetHandle, FormSheetProps>(function FormSheet(
  { title, subtitle, children, actions, locked, onDismiss, accessibilityLabel, contentStyle },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [presented, setPresented] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setPresented(true);
        sheetRef.current?.present();
      },
      close: () => {
        if (!locked) sheetRef.current?.dismiss();
      },
    }),
    [locked],
  );

  const handleDismiss = useCallback(() => {
    setPresented(false);
    onDismiss?.();
  }, [onDismiss]);

  // A locked sheet still swallows back — dismissing mid-request is the exact
  // thing `locked` exists to prevent.
  useSheetBackHandler(
    presented,
    useCallback(() => {
      if (!locked) sheetRef.current?.dismiss();
    }, [locked]),
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={SHEET_BACKDROP_OPACITY}
        // 'none' still renders the view, so it goes on swallowing taps — it just
        // stops them dismissing. Exactly what a locked sheet wants.
        pressBehavior={locked ? 'none' : 'close'}
      />
    ),
    [locked],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={handleDismiss}
      enableDynamicSizing
      // Content-sized, but never taller than the screen less the notch: past
      // that the body scrolls inside the sheet instead of the sheet growing.
      maxDynamicContentSize={windowHeight - insets.top - spacing.xl}
      // BottomSheetModal defaults this to true (bare BottomSheet defaults it to
      // false), so the explicit false is load-bearing, not belt-and-braces.
      enablePanDownToClose={!locked}
      enableHandlePanningGesture={!locked}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassSheetBackground}
      handleIndicatorStyle={SHEET_HANDLE}
      // 'interactive', not the 'extend' the snap-point sheets use. With dynamic
      // sizing the highest detent *is* the content height, so 'extend' resolves
      // to "stay where you are" and the keyboard lands on top of the actions.
      // 'interactive' lifts the sheet by the keyboard height instead.
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView
        accessibilityLabel={accessibilityLabel}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.xl },
          contentStyle,
        ]}
      >
        {title ? (
          <AppText variant="title" style={subtitle ? styles.titleTight : styles.title}>
            {title}
            <Text style={styles.accent}>.</Text>
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText variant="footnote" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
        {children}
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  body: { padding: 22 },
  title: { color: colors.foreground, marginBottom: spacing.lg },
  // With a subtitle the pair carries the gap, not the title alone.
  titleTight: { color: colors.foreground, marginBottom: 4 },
  subtitle: { color: colors.mutedForeground, marginBottom: spacing.lg },
  accent: { color: colors.brandOrange },

  // Buttons stretch because the container is a column with the default
  // `alignItems: 'stretch'` — no per-button `alignSelf` at the call sites.
  actions: { marginTop: spacing.xl, gap: spacing.sm },
});
