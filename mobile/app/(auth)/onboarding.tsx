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
import { useRouter } from 'expo-router';
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

  const leave = useCallback(
    async (to: '/(auth)/register' | '/(auth)/login') => {
      await markSeen();
      router.replace(to);
    },
    [markSeen, router],
  );

  const renderReel = useCallback(
    ({ item, index: i }: ListRenderItemInfo<Reel>) => (
      <View style={{ width }}>
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
        <Pressable onPress={() => leave('/(auth)/login')} accessibilityRole="button" hitSlop={12}>
          <AppText variant="footnote" weight={500} style={{ color: colors.mutedForeground }}>
            Skip
          </AppText>
        </Pressable>
      </View>

      <FlatList
        ref={list}
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
        <Button title="Create account" onPress={() => leave('/(auth)/register')} />
        <Pressable onPress={() => leave('/(auth)/login')} accessibilityRole="button">
          <AppText variant="body" weight={600} style={styles.login}>
            Log in
          </AppText>
        </Pressable>
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
  photo: { width: '100%', height: 372, backgroundColor: colors.secondary },
  copy: { paddingHorizontal: SCREEN_PAD, paddingTop: 30, gap: spacing.md },
  title: { letterSpacing: -0.8, lineHeight: 34 },
  bodyCopy: { color: colors.mutedForeground, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 6, paddingHorizontal: SCREEN_PAD, paddingVertical: spacing.xl },
  dot: { width: 6, height: 6, borderRadius: 0 },
  dotOn: { backgroundColor: colors.brandOrange },
  dotOff: { backgroundColor: colors.border },
  cta: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline,
    paddingHorizontal: SCREEN_PAD, paddingTop: spacing.xl, gap: spacing.lg,
  },
  login: { color: colors.brandOrange, textAlign: 'center' },
});
