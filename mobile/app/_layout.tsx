import { useEffect } from 'react';
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
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();
  const { loading } = useAuth();

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
  useEffect(() => {
    if (!loading && (fontsLoaded || fontError)) SplashScreen.hideAsync();
  }, [loading, fontsLoaded, fontError]);

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
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <ToastProvider>
            <RootLayoutNav />
          </ToastProvider>
        </BottomSheetModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
