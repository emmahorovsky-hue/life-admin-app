import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthProvider } from '../contexts/AuthContext';

function RootLayoutNav() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url);
      if (parsed.path === 'verify-email/success') {
        router.replace('/(auth)/login');
      } else if (parsed.path === 'reset-password' && parsed.queryParams?.token) {
        router.replace({
          pathname: '/(auth)/reset-password',
          params: { token: parsed.queryParams.token as string },
        });
      }
    });
    return () => subscription.remove();
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
