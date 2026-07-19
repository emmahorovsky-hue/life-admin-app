import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typeScale } from '@life-admin/shared';
import { colors, fontMono, fonts } from '../../lib/theme';

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
// Clears the tab bar (49pt) with a small gap; on tabless screens (auth) the
// toast simply floats a little higher, which is fine.
const TAB_BAR_CLEARANCE = 61;

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
  const insets = useSafeAreaInsets();
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
          style={[styles.region, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        >
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(200)}
            exiting={FadeOutDown.duration(150)}
          >
            <Pressable
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              onPress={dismiss}
              style={styles.card}
            >
              <Text style={[styles.accent, { color: accents[toast.variant].color }]}>
                {accents[toast.variant].label}
              </Text>
              <Text style={styles.message} numberOfLines={2}>
                {toast.message}
              </Text>
            </Pressable>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 448,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.foreground,
    borderRadius: radius.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: colors.foreground,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  accent: {
    fontFamily: fontMono,
    fontSize: typeScale.monoLabel.size,
    letterSpacing: typeScale.monoLabel.letterSpacing,
  },
  message: {
    flexShrink: 1,
    fontFamily: fonts.sans.semibold,
    fontSize: 14,
    color: colors.foreground,
  },
});
