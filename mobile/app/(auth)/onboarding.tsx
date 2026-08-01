import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@life-admin/shared';
import { colors } from '../../lib/theme';
import { SCREEN_PAD } from '../../lib/quiet';
import { AppText, Button, ScreenTitle } from '../../components/ui';
import { Wordmark } from '../../components/Wordmark';
import { useOnboardingSeen } from '../../lib/onboarding';

type Reel = {
  photo: ImageSourcePropType;
  title: string;
  body: string;
};

const REELS: Reel[] = [
  {
    photo: require('../../assets/onboarding/reel-1.jpg'),
    title: 'Your entire paper trail',
    body: 'Every subscription, contract, and warranty — organized into one living timeline.',
  },
  {
    photo: require('../../assets/onboarding/reel-2.jpg'),
    title: 'We read every line, so you don’t have to',
    body: 'Upload any receipt or renewal notice and Paypr fills in the details for you.',
  },
  {
    photo: require('../../assets/onboarding/reel-3.jpg'),
    title: 'Nothing slips through',
    body: 'Catch every renewal before it charges you — and keep more of your money.',
  },
];

/**
 * First-run onboarding — the 1d "Sheet" layout (LIF-218). Reached only by a
 * logged-out visitor who hasn't seen it; `app/(app)/_layout.tsx` owns that
 * decision. Every exit marks the flag before navigating, so Skip counts as
 * seen — the reel is a welcome, not a gate.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { markSeen } = useOnboardingSeen();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Reel>>(null);
  const leaving = useRef(false);

  // The carousel now stays mounted beneath the login / register modal (LIF-221)
  // instead of unmounting on exit, so reset the one-shot guard each time it
  // regains focus — otherwise a return via the modal's X leaves the CTAs dead.
  useFocusEffect(useCallback(() => {
    leaving.current = false;
  }, []));

  const leave = useCallback(
    async (mode: 'signin' | 'signup') => {
      if (leaving.current) return; // a double-tap must not stack two screens
      leaving.current = true;
      try {
        await markSeen();
      } catch {
        // Deliberately swallowed. This screen is only reachable by redirect and
        // has no back gesture, so these three buttons are the only way out: a
        // failed keychain write must cost a repeat of onboarding, never the exit.
      }
      // `push`, not `replace`, so the carousel stays mounted beneath the auth
      // modal — the X (and the swipe-down) then dismiss to it (LIF-221). Both
      // CTAs open the one `login` route; `mode=signup` picks the sign-up form.
      router.push(mode === 'signup' ? { pathname: '/(auth)/login', params: { mode: 'signup' } } : '/(auth)/login');
    },
    [markSeen, router],
  );

  const renderReel = useCallback(
    ({ item, index: i }: ListRenderItemInfo<Reel>) => (
      <View style={[styles.reel, { width }]}>
        <Image source={item.photo} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
        <View style={styles.copy}>
          <AppText variant="monoLabel" style={{ color: colors.softMuted }}>
            {`0${i + 1} / 0${REELS.length}`}
          </AppText>
          <ScreenTitle style={styles.title}>{item.title}</ScreenTitle>
          <AppText variant="body" style={styles.bodyCopy}>
            {item.body}
          </AppText>
        </View>
      </View>
    ),
    [width],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Wordmark size={16} />
        <Pressable onPress={() => leave('signin')} accessibilityRole="button" hitSlop={12}>
          <AppText variant="footnote" weight={500} style={{ color: colors.mutedForeground }}>
            Skip
          </AppText>
        </Pressable>
      </View>

      <FlatList
        ref={list}
        style={styles.list}
        data={REELS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.title}
        renderItem={renderReel}
        // The item width is the screen width, so paging offsets are exact —
        // give them to the list rather than making it measure three times.
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      />

      {/* pager — square dots, the logo's motif (and quiet.dueDot's) */}
      <View style={styles.dots}>
        {REELS.map((reel, i) => (
          <Pressable
            key={reel.title}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Go to slide ${i + 1} of ${REELS.length}`}
            accessibilityState={{ selected: i === index }}
            onPress={() => list.current?.scrollToOffset({ offset: i * width, animated: true })}
            style={[styles.dot, i === index ? styles.dotOn : styles.dotOff]}
          />
        ))}
      </View>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
        <Button title="Create account" onPress={() => leave('signup')} />
        <Button title="Log in" variant="outline" onPress={() => leave('signin')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PAD, paddingTop: spacing.sm, paddingBottom: spacing.lg,
  },
  // The photo takes what the copy, the pager and the CTA block leave, capped at
  // the designed 372. It is not a fixed height: RN doesn't shrink flex children
  // by default, so a fixed one pushed the CTA off the bottom of every screen
  // shorter than a 6.1" phone — 372 + copy + chrome is ~800pt against 647 of
  // usable height on an SE. Nothing here scrolls vertically, so the buttons
  // were simply unreachable.
  list: { flex: 1 },
  reel: { flex: 1 },
  photo: { width: '100%', flex: 1, maxHeight: 372, backgroundColor: colors.secondary },
  copy: { paddingHorizontal: SCREEN_PAD, paddingTop: 30, gap: spacing.md },
  title: { letterSpacing: -0.8, lineHeight: 34 },
  bodyCopy: { color: colors.mutedForeground, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 6, paddingHorizontal: SCREEN_PAD, paddingVertical: spacing.xl },
  dot: { width: 6, height: 6, borderRadius: 0 },
  dotOn: { backgroundColor: colors.brandOrange },
  dotOff: { backgroundColor: colors.border },
  cta: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
    paddingHorizontal: SCREEN_PAD, paddingTop: spacing.xl, gap: spacing.sm,
  },
});
