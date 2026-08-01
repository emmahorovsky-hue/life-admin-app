import { Redirect } from 'expo-router';

/**
 * Sign-up now lives inside the combined auth modal (`login.tsx`) as a mode, so
 * the sign-in/up toggle crossfades in place instead of swapping screens
 * (LIF-221). This route is kept only so `/(auth)/register` and any external
 * deep link still land on the sign-up form.
 */
export default function RegisterRedirect() {
  return <Redirect href="/(auth)/login?mode=signup" />;
}
