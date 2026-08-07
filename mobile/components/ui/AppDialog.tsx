import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { radius, spacing } from '@life-admin/shared';
import { IconClose } from '../icons';
import { colors } from '../../lib/theme';
import { useAppActive } from '../../lib/useAppActive';
import { AppText } from './AppText';
import { Perforation } from '../Perforation';

export interface AppDialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Right-aligned footer actions, rendered under a dashed rule. Omit for a footerless card. */
  footer?: ReactNode;
  /** Extra styles on the card (e.g. a wider maxWidth). */
  style?: StyleProp<ViewStyle>;
  /** Override the default body padding when a dialog needs to bleed content to the edges. */
  bodyStyle?: StyleProp<ViewStyle>;
}

/**
 * The app's centred modal chrome — RN port of web's AppDialog (design 1D,
 * LIF-193; spec source client/src/components/ui/AppDialog.tsx): ink hairline
 * border, 2px corners, extra-bold title with an orange period + icon-only
 * close, and a dashed footer rule. Backdrop tap, the close button, and hardware
 * back all dismiss via `onClose`.
 *
 * **Currently unused.** Every overlay it served — edit name, change email,
 * change password, delete account — moved to `FormSheet` in LIF-239, because
 * settings was presenting two ways at once: some overlays were bottom sheets
 * and these four were centred cards, and which you got was arbitrary. Mobile
 * now diverges from web here on purpose.
 *
 * Kept rather than deleted: it is still the faithful port of the web dialog,
 * the spec source has not moved, and anything genuinely centre-modal belongs
 * here rather than in a seventh hand-rolled `Modal`. Prefer `FormSheet` for
 * anything in settings.
 *
 * The `useAppActive` guard below stays load-bearing, and is *not* made
 * redundant by LIF-239 hoisting PrivacyCover above the sheet portal: that fixed
 * bottom sheets, which are ordinary views inside the hierarchy. A `Modal`
 * presents its own view controller and sits outside it entirely, so no sibling
 * — at any depth — can cover this one. Do not remove it.
 */
export function AppDialog({
  visible,
  onClose,
  title,
  children,
  footer,
  style,
  bodyStyle,
}: AppDialogProps) {
  // A Modal presents its own view controller, so the root layout's PrivacyCover
  // cannot draw over it — an open dialog would otherwise be photographed for the
  // app switcher with its contents intact.
  //
  // Covered rather than hidden: flipping `visible` would unmount the Modal's
  // children and take their state with it, so switching away for a second while
  // half-way through the change-password dialog would silently empty the fields.
  // An opaque sibling hides the same pixels and keeps everything mounted.
  const appActive = useAppActive();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} accessibilityLabel="Close dialog" onPress={onClose} />
        <View style={[styles.card, style]}>
          <View style={styles.header}>
            <AppText variant="title" style={styles.title}>
              {title}
              <Text style={styles.accent}>.</Text>
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <IconClose size={16} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={[styles.body, bodyStyle]}>{children}</View>
          {footer ? (
            <>
              <Perforation style={styles.footerRule} />
              <View style={styles.footer}>{footer}</View>
            </>
          ) : null}
        </View>
        {!appActive && <View style={styles.snapshotCover} pointerEvents="none" />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Opaque, and the last child so it covers the card and the backdrop alike.
  // Only ever mounted while the app is leaving the foreground.
  snapshotCover: { ...StyleSheet.absoluteFill, backgroundColor: colors.background },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  // Web's bg-foreground/50 scrim: ink at 50%.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(23, 23, 23, 0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 448,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.foreground,
    borderRadius: radius.base,
    shadowColor: colors.foreground,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: 20,
    paddingBottom: spacing.lg,
  },
  title: { flexShrink: 1 },
  accent: { color: colors.brandOrange },
  // Web: 32×32 outline icon button pulled up/right by 4px to optically align.
  close: {
    width: 32,
    height: 32,
    marginTop: -4,
    marginRight: -4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
  },
  closePressed: { opacity: 0.7 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: 20 },
  footerRule: { marginHorizontal: 0 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
});
