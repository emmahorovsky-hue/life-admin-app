import { Redirect, useRouter } from 'expo-router';
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
  { name: 'index', href: '/(app)/', label: 'Dashboard', icon: 'square.grid.2x2' },
  { name: 'subscriptions', href: '/(app)/subscriptions', label: 'Subscriptions', icon: 'square.stack' },
  { name: 'timeline', href: '/(app)/timeline', label: 'Timeline', icon: 'calendar' },
  { name: 'profile', href: '/(app)/profile', label: 'Profile', icon: 'person' },
];

export default function AppLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <TabBarMinimizeProvider>
      <Tabs>
        <TabSlot style={{ height: '100%' }} renderFn={renderFadingTabScreen} />
        <TabList asChild>
          <GlassTabBar
            onIndexSelected={(i) => router.navigate(ITEMS[i].href as never)}
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
