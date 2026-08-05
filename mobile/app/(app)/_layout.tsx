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
import { colors } from '../../lib/theme';

// SF Symbol names (rendered via expo-symbols); solid variants match the old
// Ionicons "outline" set closely enough for the tab bar's small size.
const ITEMS: (GlassTabItem & { href: string })[] = [
  { name: 'index', href: '/(app)/', label: 'Home', icon: 'house' },
  { name: 'subscriptions', href: '/(app)/subscriptions', label: 'Subscriptions', icon: 'square.stack' },
  { name: 'timeline', href: '/(app)/timeline', label: 'Timeline', icon: 'calendar' },
  { name: 'profile', href: '/(app)/profile', label: 'Profile', icon: 'person' },
];

export default function AppLayout() {
  const { user, loading, locked } = useAuth();

  // The carousel is the logged-out home, every launch — not a first-run gate.
  // It was originally shown once per device (LIF-218) behind a keychain flag;
  // that flag is gone, which also takes a keychain read off the launch path.
  // Auth screens now open as modals *over* it, so their close button always has
  // somewhere to dismiss to.
  if (loading) return null;
  // Locked at cold start: there is no user yet because the token has not been
  // unlocked, but that is not the same as logged out. Hold still rather than
  // redirect — the lock screen (rendered from the root layout) is already
  // covering this, and bouncing to the carousel would only have to bounce back
  // the moment unlock resolves. LIF-222.
  //
  // Only when there is no user, though. A re-lock keeps `user`, and returning
  // null then would unmount the whole tab tree — every screen's state gone,
  // every list refetched on unlock, a half-filled subscription form lost
  // because someone read a text message for a minute. The lock screen already
  // covers what is behind it, so there is nothing to hide by unmounting, and
  // lib/api.ts refuses authenticated calls while locked so nothing behind it
  // can talk to the server either.
  if (locked && !user) return null;
  if (!user) return <Redirect href="/(auth)/onboarding" />;

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
