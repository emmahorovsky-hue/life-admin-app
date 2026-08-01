import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (!loading && user) return <Redirect href="/(app)/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Login and register slide up as modals over the onboarding carousel, so
          the X on each dismisses downward to reveal it again (LIF-221). A
          returning user who lands straight on login has no carousel beneath —
          a full-screen 'modal' still renders correctly as the stack root. */}
      <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      <Stack.Screen name="register" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
