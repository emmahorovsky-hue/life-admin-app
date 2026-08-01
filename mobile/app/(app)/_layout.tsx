import { Redirect } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import {
  GlassTabBar,
  GlassTabButton,
  TabBarMinimizeProvider,
  renderFadingTabScreen,
  type GlassTabItem,
} from 'expo-glass-tabs';
import { useAuth } from '../../contexts/AuthContext';
import { useIntroSeen } from '../../lib/introSeen';
import { colors } from '../../lib/theme';

// SF Symbol names (rendered via expo-symbols); solid variants match the old
// Ionicons "outline" set closely enough for the tab bar's small size.
const ITEMS: (GlassTabItem & { href: string })[] = [
  { name: 'index', href: '/(app)/', label: 'Dashboard', icon: 'square.grid.2x2' },
  { name: 'subscriptions', href: '/(app)/subscriptions', label: 'Subscriptions', icon: 'square.stack' },
  { name: 'timeline', href: '/(app)/timeline', label: 'Timeline', icon: 'calendar' },
  { name: 'profile', href: '/(app)/profile', label: 'Profile', icon: 'person' },
];

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { seen } = useIntroSeen();

  // LIF-218: a logged-out visitor goes to onboarding the first time on this
  // device and to login every time after. `seen` is null until the flag has
  // been read — redirecting on it early would send first-timers to login. Only
  // the logged-out branch consults it, so a logged-in launch must not wait on
  // it: that would put a keychain read in front of the first paint of the tabs.
  if (loading || (!user && seen === null)) return null;
  if (!user) return <Redirect href={seen ? '/(auth)/login' : '/(auth)/onboarding'} />;

  return (
    <TabBarMinimizeProvider>
      <Tabs>
        <TabSlot style={{ height: '100%' }} renderFn={renderFadingTabScreen} />
        <TabList asChild>
          <GlassTabBar
            // Each TabTrigger drives navigation itself (expo-router/ui), so the bar
            // stays a pure view — no imperative router.navigate to double-fire or
            // desync the active tab from the real route (deep links, back nav).
            theme={{
              activeTint: colors.foreground,
              inactiveTint: colors.faint,
              highlight: 'rgba(0,0,0,0.06)',
              glassTint: 'rgba(255,255,255,0.55)',
              solidFallback: 'rgba(255,255,255,0.94)',
            }}
            haptics
          >
            {ITEMS.map(({ href, ...item }, index) => (
              <TabTrigger key={item.name} name={item.name} href={href as never} asChild>
                <GlassTabButton item={item} index={index} />
              </TabTrigger>
            ))}
          </GlassTabBar>
        </TabList>
      </Tabs>
    </TabBarMinimizeProvider>
  );
}
