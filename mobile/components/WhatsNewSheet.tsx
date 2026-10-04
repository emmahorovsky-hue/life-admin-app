import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { radius, spacing } from '@life-admin/shared';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../lib/theme';
import {
  getPendingNote,
  markSeen,
  type PendingNote,
  type ReleaseNoteItem,
} from '../lib/whatsNew';
import { PayprIcon } from './icons/PayprIcon';
import { AppText, Button, FormSheet, type FormSheetHandle } from './ui';

/** Past this many items the list collapses to the first few behind a link. */
const MAX_ROWS = 4;
const COLLAPSED_ROWS = 3;

/**
 * "What's new" after an update (LIF-271): once per app version, per account.
 *
 * Follows BiometricOptInSheet's shape: offered from the dashboard, at most once
 * per mount, and gated on `canOffer` so the dashboard decides which sheet gets
 * the moment (setup, then the biometric offer, then this). One difference
 * matters: the note is *resolved* as soon as `hasSubscriptions` is known, even
 * while `canOffer` is false. Resolving is what writes the fresh-install
 * baseline (see lib/whatsNew.ts), and a session where setup takes the moment is
 * exactly the session that baseline must be written in.
 *
 * Marked seen on dismissal, by any route: FormSheet funnels backdrop taps,
 * swipes, Android back and every button through `onDismiss`. The design calls
 * for the app's standard sheet chrome rather than the ticket's raw values, and
 * adds no motion of its own, so reduced motion is whatever the sheet library
 * does with the system setting (it honours it by default).
 */
export function WhatsNewSheet({
  hasSubscriptions,
  canOffer,
}: {
  /** Null until the dashboard has loaded; nothing is decided before then. */
  hasSubscriptions: boolean | null;
  canOffer: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.id;
  const sheetRef = useRef<FormSheetHandle>(null);
  const titleRef = useRef<View>(null);
  const [pending, setPending] = useState<PendingNote | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Resolve once per mount, as soon as the account's state is known. Only
  // unmounting cancels the read: `hasSubscriptions` can change while it is in
  // flight (setup finishing), and a per-run cancel would drop the one result
  // this mount is ever going to get.
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const resolved = useRef(false);
  useEffect(() => {
    if (!userId || hasSubscriptions === null || resolved.current) return;
    resolved.current = true;
    void getPendingNote(userId, hasSubscriptions).then((note) => {
      if (mounted.current) setPending(note);
    });
  }, [userId, hasSubscriptions]);

  // Present at most once per mount, and only when the dashboard says the
  // moment is free. Claimed before opening so a re-render cannot present twice.
  const offered = useRef(false);
  useEffect(() => {
    if (!pending || !canOffer || offered.current) return;
    offered.current = true;
    sheetRef.current?.open();
  }, [pending, canOffer]);

  // A CTA navigates only after the sheet has gone, so the next screen does not
  // push underneath a sheet that is still animating out.
  const pendingRoute = useRef<Href | null>(null);
  const handleDismiss = useCallback(() => {
    if (userId) void markSeen(userId);
    const route = pendingRoute.current;
    pendingRoute.current = null;
    if (route) router.push(route);
  }, [userId, router]);

  const focusTitle = useCallback(() => {
    if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
  }, []);

  const close = useCallback(() => sheetRef.current?.close(), []);

  if (!pending) return null;

  const { version, note } = pending;
  const single = note.items.length === 1;
  const item = note.items[0];
  const title = single ? item.title : "What's new";

  const collapsible = !single && note.items.length > MAX_ROWS;
  const rows = collapsible && !expanded ? note.items.slice(0, COLLAPSED_ROWS) : note.items;

  const primaryLabel = single && item.cta ? item.cta.label : 'Continue';
  const onPrimary = () => {
    if (single && item.cta) pendingRoute.current = item.cta.route;
    close();
  };

  return (
    <FormSheet
      ref={sheetRef}
      onDismiss={handleDismiss}
      onOpened={focusTitle}
      accessibilityLabel={`What's new in version ${version}`}
      actions={
        <>
          <Button title={primaryLabel} accessibilityLabel={primaryLabel} onPress={onPrimary} />
          {single ? (
            <Button
              title="Maybe later"
              accessibilityLabel="Maybe later"
              variant="outline"
              onPress={close}
            />
          ) : null}
        </>
      }
    >
      {single ? <Panel item={item} /> : null}

      <View style={single ? styles.headerAfterPanel : undefined}>
        <AppText variant="monoLabel" color={colors.mutedForeground} style={styles.eyebrow}>
          {single ? `NEW IN ${version}` : `VERSION ${version}`}
        </AppText>
        {/* The accessible wrapper is the header and the focus target: AppText
            does not forward a ref, and grouping keeps the brand period from
            being read as a separate element. */}
        <View ref={titleRef} accessible accessibilityRole="header" accessibilityLabel={title}>
          <AppText variant="title" style={styles.title}>
            {title}
            <Text style={styles.accent}>.</Text>
          </AppText>
        </View>
      </View>

      {single ? (
        <AppText variant="body" color={colors.mutedForegroundStrong} style={styles.singleBody}>
          {item.body}
        </AppText>
      ) : (
        <View style={styles.rows}>
          {rows.map((row) => (
            <Row key={row.id} item={row} />
          ))}
          {collapsible && !expanded ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See full release notes"
              onPress={() => setExpanded(true)}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <AppText variant="footnote" weight={500} color={colors.foreground}>
                See full release notes
              </AppText>
            </Pressable>
          ) : null}
        </View>
      )}
    </FormSheet>
  );
}

function Panel({ item }: { item: ReleaseNoteItem }) {
  return (
    <View style={styles.panel}>
      {item.illustration ? (
        <Image
          source={item.illustration}
          resizeMode="contain"
          style={styles.illustration}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : (
        <PayprIcon name={item.icon} size={48} color={colors.foreground} />
      )}
    </View>
  );
}

function Row({ item }: { item: ReleaseNoteItem }) {
  return (
    // Grouped so VoiceOver reads headline and description as one item.
    <View style={styles.row} accessible accessibilityLabel={`${item.title}. ${item.body}`}>
      <View style={styles.tile}>
        <PayprIcon name={item.icon} size={20} color={colors.foreground} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="headline">{item.title}</AppText>
        <AppText variant="footnote" color={colors.mutedForegroundStrong} style={styles.rowBody}>
          {item.body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Single mode: the panel leads, then the header a section-gap below it.
  panel: {
    height: 196,
    borderRadius: radius.base,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illustration: { width: '100%', height: '100%' },
  headerAfterPanel: { marginTop: spacing.xl },
  eyebrow: { marginBottom: spacing.xs },
  title: { color: colors.foreground },
  accent: { color: colors.brandOrange },
  singleBody: { marginTop: spacing.md, lineHeight: 22 },

  // Multi mode.
  rows: { marginTop: spacing.xl, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.base,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowBody: { marginTop: 2, lineHeight: 18 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
});
