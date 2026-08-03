import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ToastProvider } from '../components/ui';
import { BrandSplash } from '../components/BrandSplash';
import { BiometricLockScreen } from '../components/BiometricLockScreen';
import { PrivacyCover } from '../components/PrivacyCover';
import { useAppActive } from '../lib/useAppActive';
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

/**
 * How long the app may sit in the background before biometric quick-unlock
 * re-arms (LIF-222). Short enough that a stolen unlocked phone is not left open
 * indefinitely, long enough that flicking to Mail to read a renewal notice and
 * coming straight back does not demand a face.
 */
const RELOCK_AFTER_MS = 60_000;

function RootLayoutNav() {
  const router = useRouter();
  const { user, loading, relock } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  // The web app's typefaces (LIF-197): Archivo for sans, Space Mono for the
  // receipt-style mono. One family per weight — RN static fonts don't
  // synthesize weights, so styles reference these names via lib/theme.ts
  // `fonts` instead of pairing fontFamily with fontWeight.
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  // Hide the splash here (not in a group layout) so it can't get stuck when an
  // early navigation unmounts a group before auth loading resolves. Also gated
  // on fonts so screens never flash system typefaces — but a font-load failure
  // must still release the splash (fall back to system fonts) rather than
  // stranding the app on it forever.
  const ready = !loading && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // LIF-218: the animated splash takes over from the native one in the same
  // frame `ready` flips — the native frame is the same lockup at the same size,
  // so the handover is invisible and `BrandSplash` animates from it rather than
  // playing (and finishing) unseen behind it.
  //
  // It leaves only when the animation has finished AND auth has resolved, so
  // the brand moment is never cut short. Logged-out first-timers skip it: they
  // get onboarding, which is its own brand moment.
  const handleSplashDone = useCallback(() => setSplashDone(true), []);
  const showBrandSplash = (!splashDone || loading) && (loading || !!user);

  // Re-lock only counts real backgrounding, and only past the grace period.
  // 'inactive' is excluded on purpose: iOS reports it for the app switcher,
  // Control Centre and incoming calls, none of which are leaving the app, and
  // demanding a face after each would be intolerable. (The privacy *cover* uses
  // the opposite threshold and now lives in PrivacyCoverGate, below.)
  //
  // Timestamped rather than timer-based because a suspended app does not run
  // timers — elapsed wall-clock is the only honest measure.
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since !== null && Date.now() - since >= RELOCK_AFTER_MS) relock();
      } else if (state === 'background' && backgroundedAt.current === null) {
        backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [relock]);

  useEffect(() => {
    const handle = (url: string) => {
      const parsed = Linking.parse(url);
      // For custom schemes the first segment parses as hostname, not path:
      // lifeadmin://verify-email/success → { hostname: 'verify-email', path: 'success' }
      const route = [parsed.hostname, parsed.path].filter(Boolean).join('/');
      if (route === 'verify-email/success') {
        router.replace({
          pathname: '/(auth)/login',
          params: { notice: 'Email verified. You can now sign in.' },
        });
      } else if (route === 'verify-email/error') {
        // Failed verification (expired/used/invalid) must not land silently — surface it on login.
        const reason = parsed.queryParams?.reason;
        const notice =
          reason === 'expired'
            ? 'That verification link has expired. Request a new one from your account.'
            : 'That verification link is invalid or has already been used.';
        router.replace({ pathname: '/(auth)/login', params: { notice } });
      } else if (route === 'reset-password' && parsed.queryParams?.token) {
        router.replace({
          pathname: '/(auth)/reset-password',
          params: { token: parsed.queryParams.token as string },
        });
      }
    };

    // Handle deep links when the app was closed at tap time
    Linking.getInitialURL().then((url) => { if (url) handle(url); });

    // Handle deep links while the app is already running
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, [router]);

  // The tab group and root Stack both run headerShown:false, so no native
  // header reserves the top safe area. Apply the top inset once here — every
  // screen (tabs, auth, settings detail) inherits it and clears the notch.
  // Top edge only: the tab bar and Toast own the bottom inset.
  // The splash sits outside the SafeAreaView, not inside it: the native splash
  // centres its lockup on the whole screen, and an absolute fill inside the
  // safe area starts below the notch — the wordmark would jump down by the top
  // inset at handover. Being the later sibling also puts it over the tab bar.
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaView>
      {showBrandSplash && <BrandSplash start={ready} onDone={handleSplashDone} />}
      {/* The lock screen and privacy cover used to sit here. They now render in
          RootLayout, outside BottomSheetModalProvider — see the note there. */}
    </View>
  );
}

/**
 * The biometric lock screen, rendered outside `BottomSheetModalProvider`.
 *
 * Its own component only so that `locked` can be read from `useAuth()` at a
 * level above the sheet provider; there is nothing else to it.
 */
function BiometricLockGate() {
  const { locked } = useAuth();
  return locked ? <BiometricLockScreen /> : null;
}

/**
 * The app-switcher privacy cover, rendered outside `BottomSheetModalProvider`.
 *
 * Goes up on 'inactive' — precisely when iOS photographs the app for the
 * switcher, so anything later is too late and the snapshot shows the dashboard.
 * Cosmetic, costs nothing, and applies to every user whether or not
 * quick-unlock is on.
 *
 * Uses `useAppActive` rather than its own AppState listener: the hook already
 * answers exactly this question, on exactly this threshold.
 *
 * Held back until the app has been active once. iOS reports 'inactive' for the
 * whole cold-launch window, so without this the cover — zIndex 300 — went up
 * over `BrandSplash` (100) at launch and the splash was never seen. Nothing is
 * given away by waiting: there is only the splash behind it until the app comes
 * up, and the OS is not photographing an app it has not finished launching.
 *
 * A latched ref rather than state, because the cover has to be up *before* the
 * snapshot is taken and a state update would cost a frame.
 */
function PrivacyCoverGate() {
  const active = useAppActive();
  const hasBeenActive = useRef(false);
  if (active) hasBeenActive.current = true;
  return active || !hasBeenActive.current ? null : <PrivacyCover />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        {/* The lock screen and privacy cover are siblings of the *whole* sheet
            provider, not of the app tree inside it (LIF-239).
            `BottomSheetModalProvider` renders `<PortalProvider>`, which emits
            its children and then the portal host as a *later* sibling — so a
            bottom sheet paints above anything inside that subtree, no matter
            its zIndex. Rendered in here they would be photographed for the app
            switcher with an open sheet on top, and the lock screen would not
            cover one either. */}
        <View style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <ToastProvider>
              <RootLayoutNav />
            </ToastProvider>
          </BottomSheetModalProvider>
          <BiometricLockGate />
          <PrivacyCoverGate />
        </View>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
