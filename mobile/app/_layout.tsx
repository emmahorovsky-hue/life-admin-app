import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../contexts/AuthContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    const handle = (url: string) => {
      const parsed = Linking.parse(url);
      if (parsed.path === 'verify-email/success') {
        router.replace('/(auth)/login');
      } else if (parsed.path === 'reset-password' && parsed.queryParams?.token) {
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
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
