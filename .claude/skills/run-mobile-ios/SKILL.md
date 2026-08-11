---
name: run-mobile-ios
description: Launch and drive the Expo mobile app on the iOS simulator to verify a change visually — including seeding an isolated database and tapping/typing in the simulator programmatically. Use when asked to run the mobile app, screenshot a screen, or confirm a mobile change works in the real app.
---

# Running the mobile app on the iOS simulator

Verified end-to-end on 2026-08-01 (Xcode 26.3, Expo SDK 57, iPhone 16e).

## 0. The hazard to check first

**`server/.env` points the dev backend at `neondb` — the PRODUCTION Neon database.**
Never seed or mutate test data against a backend started from the default `.env`.
Section 3 sets up an isolated local database instead. Check before you write anything:

```bash
grep -m1 '^DATABASE_URL' server/.env | sed -E 's#.*\.tech/([^?"]*).*#\1#'   # neondb == production
```

`server/.env.test` has the same trap: three `DATABASE_URL` lines, the third being production.
dotenv keeps the *first*, which is why tests hit localhost — don't reorder them.

## 1. Preflight

```bash
lsof -ti :8081                  # Metro
lsof -ti :3001                  # backend
xcrun simctl list devices available | grep -i "iphone 16e"
node -p "require('./mobile/node_modules/expo/node_modules/expo-modules-core/package.json').version"
```

- **Metro and the backend are frequently already running from another session** — the repo is a
  shared working directory. Reuse them; don't start a second Metro.
- `expo-modules-core` must match `package-lock.json` (57.0.7 as of 2026-08-01 — read the lockfile
  rather than trusting this number). A mismatch causes a dyld "Symbol not found" crash at launch.
  Fix with `npm ci` from the repo root. Never `expo install --fix` — it rewrites the team's pinned
  versions.
- **Two apps register the `lifeadmin://` scheme.** `com.paypr.live` is the current app;
  `com.yourname.lifeadmin` is a stale build from before the rename. iOS routes `simctl openurl` to
  whichever it likes, so a deep link can silently drive the *old* app — the giveaway is a
  "◀ Paypr" back banner in the status bar. Launch by bundle id, not by deep link, or uninstall the
  stale one: `xcrun simctl uninstall <udid> com.yourname.lifeadmin`.
- The Xcode 26.3 `Swift.abs` patch for `expo-modules-jsi` is applied automatically by
  `patch-package` on install (`mobile/patches/`). Don't re-patch by hand.

**JS/TS-only changes need no native rebuild** — Metro serves them. Only rebuild
(`npx expo run:ios --device <udid>`) when native deps change. Note `run:ios --device` prints
"Skipping dev server" and exits after installing; Metro must already be running.

## 2. Launch and screenshot

```bash
UDID=$(xcrun simctl list devices available | grep -m1 "iPhone 16e" | grep -oE '[0-9A-F-]{36}')
xcrun simctl terminate $UDID com.paypr.live 2>/dev/null   # force a fresh bundle fetch
xcrun simctl launch $UDID com.paypr.live
sleep 15
xcrun simctl io $UDID screenshot /tmp/sim.png
```

Always **read the screenshot**. A blank or error frame is a failed launch, not a pass.

## 3. Isolated database (required before seeding anything)

```bash
createdb lifeadmin_<purpose>_demo
DB="postgresql://$USER@localhost:5432/lifeadmin_<purpose>_demo?schema=public"

cd server
DATABASE_URL="$DB" npx prisma migrate deploy

lsof -ti :3001 | xargs kill                       # note what was running first, to restore later
DATABASE_URL="$DB" ENABLE_CRON=false DISABLE_AUTH_RATE_LIMIT=true npm run dev &
```

Create the account over the API, then seed rows that need a controlled `createdAt` with Prisma:

```bash
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"DemoPass123!","name":"Demo"}'
```

A seeding script **must live inside the workspace** (e.g. `server/seed-tmp.ts`) or Node cannot
resolve `@prisma/client`; run it with `npx tsx` and delete it afterwards. See
`references/seed-dashboard.ts` for a working example.

**Restore when done:** kill your backend and restart the original (`cd server && npm run dev`),
which picks the production `.env` back up.

## 4. Driving the UI

`xcrun simctl` cannot tap. `osascript`'s `click at` fails with error `-25204`. What works:

- **Taps:** `cliclick` (`brew install cliclick`). Needs the terminal to hold macOS Accessibility
  permission — already granted if `osascript ... keystroke` works.
- **Typing:** never `keystroke` a string containing `-` or `@` — it silently truncates
  (`dash-demo@example.com` arrived as `dash`). Use the simulator pasteboard instead:

```bash
printf 'demo@example.com' | xcrun simctl pbcopy $UDID
cliclick c:<x>,<y>                                            # focus the field FIRST
osascript -e 'tell application "System Events" to keystroke "a" using command down'
osascript -e 'tell application "System Events" to key code 51' # delete
osascript -e 'tell application "System Events" to keystroke "v" using command down'
```

- **Scrolling:** `cliclick dd:x,y m:x,y1 m:x,y2 du:x,y2` (drag).
- Bring the window forward first: `osascript -e 'tell application "Simulator" to activate'`.

### Screenshot pixel → screen coordinate

Screenshots are device pixels (iPhone 16e: 1170x2532 = 390x844pt @3x). To tap something you
located in a screenshot, use `scripts/sim-tap.sh` (below), or compute:

```
pt        = screenshot_px / 3
screen_x  = win_x + (win_w - 390)/2 + pt_x
screen_y  = win_y + (win_h - 844)   + pt_y      # window height - device height = title bar
```

Get `win_*` from:

```bash
osascript -e 'tell application "System Events" to tell process "Simulator"
  set w to first window
  set {x, y} to position of w
  set {ww, hh} to size of w
  return "" & x & " " & y & " " & ww & " " & hh
end tell'
```

**Verify the first tap landed** (screenshot, look for the cursor) before typing a sequence —
a missed tap leaves focus on the previous field and silently corrupts the next several steps.

### The top band does not receive taps — do not call it a bug

Clicks in roughly the **top ~100pt of the device screen** never reach the app: Simulator window
chrome swallows them. A header button, a modal's close X, a nav-bar action will all look dead to
`cliclick` while working fine for a human. This is the single most expensive trap here — it reads
exactly like a broken hit-target, and it cost a full misdiagnosis (and a wrong "fix") on 2026-08-01.

Before concluding that any high-up control is broken, **run the control experiment**: tap a
*different* control at the same height on a plain, non-modal screen (e.g. `Skip` on the onboarding
carousel, ~63pt). If that is dead too, it's the harness. To exercise the real handler, temporarily
enlarge the target (`width/height: 300`, translucent `backgroundColor` so you can see it) and tap
its lower half — then revert. Anything above the band needs a human click to confirm; say so in the
report rather than claiming it verified.

### Window geometry drifts, and `first window` disappears

The Simulator window moves between calls, and `System Events` intermittently reports zero windows
(`Invalid index. (-1719)`), which makes `sim-tap.sh` compute `screen(0,0)` and click the desktop.
Always activate and re-measure immediately before a tap sequence:

```bash
osascript -e 'tell application "Simulator" to activate' >/dev/null
osascript -e 'tell application "System Events" to tell process "Simulator" to set visible to true' >/dev/null
sleep 2
```

## 5. Gotchas that cost time

- iOS shows a **"Save Password?"** dialog after login; dismiss "Not Now" or it covers the screen.
- **Fast Refresh is not reliable for verifying a change.** It applied edits to a leaf component
  while silently keeping the old version of the screen that renders it, which produced a
  contradictory-looking UI for several minutes. When a change alters layout or view order,
  `terminate` + `launch` to force a fresh bundle before believing a screenshot.
- RN's LogBox toast ("Open debugger to view warnings") **cannot be read from the CLI** —
  `simctl log stream` does not carry JS console output. Report it as uninspected rather than
  guessing, or open the debugger.
- Layout shifts when validation errors appear; re-measure coordinates from a *fresh* screenshot.
- Timezone-dependent UI cannot be verified here: the host Mac is `Asia/Singapore` (UTC+8), which
  masks bugs that only appear at negative UTC offsets. Test those in Node across timezones:
  `TZ=America/New_York node -e '...'`.
