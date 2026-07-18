import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();
  const { loading } = useAuth();

  // The web app's typefaces (LIF-197): Archivo for sans, Space Mono for the
  // receipt-style mono. One family per weight — RN static fonts don't
  // synthesize weights, so styles reference these names via lib/theme.ts
  // `fonts` instead of pairing fontFamily with fontWeight.
  const [fontsLoaded] = useFonts({
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
  // on fonts so screens never flash system typefaces.
  useEffect(() => {
    if (!loading && fontsLoaded) SplashScreen.hideAsync();
  }, [loading, fontsLoaded]);

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

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <RootLayoutNav />
        </BottomSheetModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
