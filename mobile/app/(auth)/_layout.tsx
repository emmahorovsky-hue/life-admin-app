import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (!loading && user) return <Redirect href="/(app)/" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Login slides up as a modal over the onboarding carousel, so its X
          dismisses downward to reveal it again (LIF-221). A returning user who
          lands straight on login has no carousel beneath — react-native-screens
          presents the first screen of a stack as a push regardless, so a modal
          still renders correctly as the stack root.

          `register` is deliberately *not* listed: it only redirects here, and
          presenting an empty sheet just to replace it costs two animations. */}
      <Stack.Screen name="login" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
