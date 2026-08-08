import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

/**
 * What the server puts in `data.type` for a renewal digest push
 * (server/src/services/pushService.ts). Routing keys off this rather than the
 * copy, so the wording can change without breaking the tap.
 */
const RENEWAL_REMINDER = 'renewal_reminder';

/**
 * Decides what a notification does while the app is in the foreground.
 *
 * Without a handler, iOS delivers foreground notifications silently — the
 * reminder simply never appears for anyone who happens to have the app open.
 *
 * Called at module scope (see app/_layout.tsx) because expo-notifications reads
 * this when a notification arrives, which can be before any component mounts.
 *
 * `shouldShowBanner`/`shouldShowList` are the SDK 54+ split of the old
 * `shouldShowAlert`, which is deprecated — banner is the heads-up, list is the
 * notification centre entry, and a reminder wants both.
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      // Nothing clears a badge anywhere in the app, so setting one would leave
      // a permanent unread dot on the icon.
      shouldSetBadge: false,
    }),
  });
}

/**
 * Sends a tapped renewal reminder to the subscriptions screen.
 *
 * Built on `useLastNotificationResponse` rather than
 * `addNotificationResponseReceivedListener` because that hook also reports the
 * notification that *launched* the app from a killed state — the cold-start
 * case a plain listener misses entirely, since it subscribes long after the tap
 * was delivered.
 *
 * The trade-off is that the hook keeps returning the same response for the rest
 * of the session, so the identifier of the one already acted on is latched;
 * otherwise any re-render would navigate again and trap the user on the tab.
 *
 * @param enabled false until there is a signed-in user. A tap that arrives at
 * the login screen is remembered, not dropped: routing is deferred until auth
 * resolves, so the deep link still lands instead of silently doing nothing
 * while the `(app)` group's auth gate bounces it away.
 */
export function useNotificationRouting(enabled: boolean): void {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !response) return;

    const { identifier, content } = response.notification.request;
    if (handledId.current === identifier) return;
    if (content.data?.type !== RENEWAL_REMINDER) return;

    handledId.current = identifier;
    // navigate, not push: subscriptions is a tab, and pushing it would stack a
    // second copy on top of the one already in the tab history.
    router.navigate('/subscriptions');
  }, [enabled, response, router]);
}
