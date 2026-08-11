#!/usr/bin/env bash
# Tap the iOS simulator at a point located in a screenshot.
#
#   sim-tap.sh <screenshot_x> <screenshot_y> [device_pt_w] [device_pt_h]
#
# Coordinates are in screenshot pixels (what you read off `simctl io screenshot`),
# not screen points — the script converts. Defaults are iPhone 16e (390x844pt @3x).
#
# Requires: cliclick (brew install cliclick) and macOS Accessibility permission
# for the calling terminal.
set -euo pipefail

PX_X=${1:?screenshot x required}
PX_Y=${2:?screenshot y required}
DEV_W=${3:-390}
DEV_H=${4:-844}

read -r WIN_X WIN_Y WIN_W WIN_H <<<"$(osascript -e '
tell application "System Events" to tell process "Simulator"
  set w to first window
  set {x, y} to position of w
  set {ww, hh} to size of w
  return "" & x & " " & y & " " & ww & " " & hh
end tell')"

# Screenshots are 3x the point size on every current iPhone simulator.
# Override with SCALE=2 for the handful of @2x devices.
SCALE=${SCALE:-3}

PT_X=$(echo "$PX_X / $SCALE" | bc -l)
PT_Y=$(echo "$PX_Y / $SCALE" | bc -l)

# Horizontal chrome is split evenly; vertical chrome is all title bar (top).
SCREEN_X=$(printf '%.0f' "$(echo "$WIN_X + ($WIN_W - $DEV_W)/2 + $PT_X" | bc -l)")
SCREEN_Y=$(printf '%.0f' "$(echo "$WIN_Y + ($WIN_H - $DEV_H) + $PT_Y" | bc -l)")

osascript -e 'tell application "Simulator" to activate' >/dev/null
sleep 0.4
cliclick "c:${SCREEN_X},${SCREEN_Y}"
echo "tapped screenshot(${PX_X},${PX_Y}) -> screen(${SCREEN_X},${SCREEN_Y})"
