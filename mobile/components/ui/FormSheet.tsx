import {
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Platform,
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
  BottomSheetFooter,
  BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@life-admin/shared';
import { colors } from '../../lib/theme';
import { SHEET_BACKDROP_OPACITY, SHEET_BACKGROUND, SHEET_HANDLE } from '../../lib/quiet';
import { AppText } from './AppText';
import { GlassSheetBackground } from './GlassSurface';
import { Perforation } from '../Perforation';

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
  children: ReactNode;
  /** Right-aligned actions under a dashed rule, pinned to the sheet bottom. */
  footer?: ReactNode;
  /**
   * This sheet contains live text entry.
   *
   * One prop rather than three, because the three things it decides are the
   * same decision seen from three angles, and splitting them is precisely how
   * AvatarTile drifted:
   *
   *   - No glass. Live text over a refracting surface is the canonical Liquid
   *     Glass legibility failure (see GlassSurface's header).
   *   - Therefore gorhom's default scrim, not SHEET_BACKDROP_OPACITY. The 0.2
   *     scrim exists *because* glass refracts what is behind it; without glass
   *     it is simply a weak scrim. quiet.ts warns these two must move together.
   *   - Keyboard handling, which only a text sheet needs.
   */
  textEntry?: boolean;
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
 * The chrome every settings overlay renders through (LIF-239).
 *
 * Settings used to ship two presentations at once — some overlays were bottom
 * sheets, four were centred AppDialog cards — and the split was arbitrary: two
 * rows on the same Account screen behaved differently. This is the one sheet
 * shape they all share now.
 *
 * Ref-driven (`open()`/`close()`), never a `visible` prop, matching the
 * convention the subscription sheets already established. A consequence worth
 * knowing: a sheet is mounted for the life of its screen rather than only while
 * open, so **form state does not reset itself** the way a conditionally-mounted
 * dialog's did. Seed state in `open()`, and clear anything sensitive in
 * `onDismiss`.
 *
 * Deliberately not the chrome for SubscriptionFormSheet, FirstRunSetupSheet or
 * SubscriptionDetailSheet: those need fixed percentage snap points and a
 * bounded inner scroll, which a content-sized sheet cannot express. Adding
 * `snapPoints` here to "finish the job" would make this worse for the seven
 * overlays that do fit.
 */
export const FormSheet = forwardRef<FormSheetHandle, FormSheetProps>(function FormSheet(
  { title, children, footer, textEntry, locked, onDismiss, accessibilityLabel, contentStyle },
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

  // @gorhom/bottom-sheet ships no BackHandler integration of any kind, so
  // without this Android's back button sails past the open sheet and pops the
  // screen *underneath* it — which during a locked operation would tear the
  // sheet down mid-request, the exact thing `locked` exists to prevent.
  useEffect(() => {
    if (Platform.OS !== 'android' || !presented) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!locked) sheetRef.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [presented, locked]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={textEntry ? OPAQUE_SHEET_BACKDROP_OPACITY : SHEET_BACKDROP_OPACITY}
        // 'none' still renders the view, so it goes on swallowing taps — it just
        // stops them dismissing. Exactly what a locked sheet wants.
        pressBehavior={locked ? 'none' : 'close'}
      />
    ),
    [textEntry, locked],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <View style={styles.footer}>
          <Perforation style={styles.footerRule} />
          <View style={styles.footerRow}>{footer}</View>
        </View>
      </BottomSheetFooter>
    ),
    [footer, insets.bottom],
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
      footerComponent={footer ? renderFooter : undefined}
      backgroundComponent={textEntry ? undefined : GlassSheetBackground}
      backgroundStyle={textEntry ? SHEET_BACKGROUND : undefined}
      handleIndicatorStyle={SHEET_HANDLE}
      // 'interactive', not the 'extend' the snap-point sheets use. With dynamic
      // sizing the highest detent *is* the content height, so 'extend' resolves
      // to "stay where you are" and the keyboard lands on top of the footer.
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
          // The footer floats over the body, so the body has to end above it.
          // A constant, not a measured height: the scroll content's height
          // feeds dynamic sizing, which sets the sheet height, which positions
          // the footer — measuring the footer back into this would close that
          // loop. FOOTER_HEIGHT is exact for the footer rendered above.
          { paddingBottom: footer ? FOOTER_HEIGHT + insets.bottom : insets.bottom + spacing.xl },
          contentStyle,
        ]}
      >
        {title ? (
          <AppText variant="title" style={styles.title}>
            {title}
            <Text style={styles.accent}>.</Text>
          </AppText>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

/** gorhom's own backdrop default, named so the pairing in `textEntry` is legible. */
const OPAQUE_SHEET_BACKDROP_OPACITY = 0.5;

/** Perforation (2) + paddingTop (16) + Button md (44) + paddingBottom (16). */
const FOOTER_HEIGHT = 78;

const styles = StyleSheet.create({
  body: { padding: 22 },
  title: { color: colors.foreground, marginBottom: spacing.lg },
  accent: { color: colors.brandOrange },

  footer: { backgroundColor: colors.background },
  footerRule: { marginHorizontal: 0 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
});
