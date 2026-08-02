import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOutDown, Keyframe } from 'react-native-reanimated';
import { spacing } from '@life-admin/shared';
import { colors } from '../../lib/theme';
import { useTabBarInset } from '../../lib/useTabBarInset';
import { AppText } from './AppText';
import { GlassSurface } from './GlassSurface';

type ToastVariant = 'success' | 'error';

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 2500;

// Translate-only entrance, because `opacity: 0` disables glass rendering
// entirely: with a fade, frame 1 has no glass and the toast pops into being
// instead of materialising. Kept to a short 24pt travel rather than reanimated's
// SlideInDown, which starts at the screen edge and would drag the toast up
// across the tab bar. The exit stays a fade — the glass is already on screen by
// then, and fading is the dismissal the app has always had.
const ToastEnter = new Keyframe({
  0: { transform: [{ translateY: 24 }] },
  100: { transform: [{ translateY: 0 }] },
}).duration(220);

const accents: Record<ToastVariant, { label: string; color: string }> = {
  success: { label: 'OK', color: colors.success },
  error: { label: 'ERR', color: colors.destructive },
};

/**
 * Mobile counterpart of the web sonner toasts (LIF-179/LIF-205): a single
 * receipt-styled card above the tab bar — ink hairline border, sharp 2px
 * corners, mono uppercase accent tag. Latest toast replaces the current one;
 * auto-dismisses, tap dismisses early.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  // Shares the tab bar's own geometry rather than a hard-coded clearance. The
  // old constant (61) assumed a 49pt bar and predated the glass pill, which
  // sits at max(insets.bottom - 16, 12) and is 58 tall: on a device with
  // insets.bottom === 0 the toast rendered 9pt *behind* the bar.
  const tabBarInset = useTabBarInset();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, variant: ToastVariant) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: nextId.current++, message, variant });
    timer.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show(message, 'success'),
      error: (message) => show(message, 'error'),
    }),
    [show],
  );

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <View
          pointerEvents="box-none"
          style={[styles.region, { bottom: tabBarInset }]}
        >
          {/* The animated wrapper stays *outside* the glass — see ToastEnter. */}
          <Animated.View
            key={toast.id}
            entering={ToastEnter}
            exiting={FadeOutDown.duration(150)}
          >
            <GlassSurface role="floating" style={styles.card}>
              <Pressable
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                onPress={dismiss}
                style={styles.cardInner}
              >
                <AppText variant="monoLabel" style={{ color: accents[toast.variant].color }}>
                  {accents[toast.variant].label}
                </AppText>
                <AppText variant="body" weight={600} style={styles.message} numberOfLines={2}>
                  {toast.message}
                </AppText>
              </Pressable>
            </GlassSurface>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  region: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  // Layout only — the paint (white, ink hairline, shadow) and the 2px corner
  // live in GlassSurface's `floating` role, which is where the glass branch
  // swaps them for a tinted refraction.
  card: { maxWidth: 448 },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  message: { flexShrink: 1 },
});
