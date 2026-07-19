import { Stack } from 'expo-router';

// Settings drill-down (LIF-200): nested stack inside the Profile tab so the
// tab bar stays visible on detail screens.
export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
