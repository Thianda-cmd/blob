#!/bin/bash
# Checks of the iOS app in the simulator (CI, macOS runner): simctl for launching, app links and
# screenshots; idb (fb-idb) for taps, swipes, typing and reading what's on screen.
#
#   bash src-tauri/tests/e2e/ios.sh path/to/Blob.app out/
#
# What it looks at: the page sits below the status bar / Dynamic Island; app links open their page;
# a swipe scrolls; the edge swipe goes back; the keyboard doesn't cover the field; dark mode.
set -u
APP="$1"
OUT="${2:-e2e-ios}"
BUNDLE="org.bojes.blob"
mkdir -p "$OUT"
: > "$OUT/results.jsonl"
FAILED=0
N=0
shot() { N=$((N + 1)); xcrun simctl io booted screenshot "$OUT/$(printf %02d $N)-$1.png" > /dev/null 2>&1 || echo "(no screenshot $1)"; }
check() {
  if [ "$2" = 1 ]; then echo "ok   $1 ${3:-}"; else echo "FAIL $1 ${3:-}"; FAILED=1; fi
  printf '{"name":%s,"ok":%s,"detail":%s}\n' "$(jq -Rn --arg v "$1" '$v')" "$([ "$2" = 1 ] && echo true || echo false)" "$(jq -Rn --arg v "${3:-}" '$v')" >> "$OUT/results.jsonl"
}
# What idb sees on screen: [{label, y, h, type}].
screen() { idb ui describe-all --udid "$DEVICE" --json 2> /dev/null || echo "[]"; }
find_label() { jq -r --arg re "$1" '[.[] | select((.AXLabel // "") | test($re; "i"))] | first // empty'; }

DEVICE=$(xcrun simctl list devices available -j | jq -r '[.devices | to_entries[] | select(.key | test("iOS")) | .value[] | select(.name | test("^iPhone 1[5-9]"))] | sort_by(.name) | last | .udid')
echo "simulator: $DEVICE"
xcrun simctl boot "$DEVICE" 2> /dev/null
xcrun simctl bootstatus "$DEVICE" -b > /dev/null
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl launch "$DEVICE" "$BUNDLE"
sleep 30
shot start

# The page below the status bar: the top of the sign-in page (the Blob logo, the DE/EN switch).
TOP=$(screen | jq '[.[] | select((.AXLabel // "") | test("^(Blob|DE|EN|Welcome back|Willkommen zurück)$"; "i")) | .frame.y] | min // -1')
check "the page starts below the status bar" "$(echo "$TOP >= 44" | bc)" "top element at y=$TOP"
WELCOME=$(screen | find_label "Welcome back|Willkommen")
check "the start page opens the site's sign-in" "$([ -n "$WELCOME" ] && echo 1 || echo 0)"

# The keyboard: tap the email field, type, and the field stays visible above the keyboard.
FIELD=$(screen | jq -c '[.[] | select(.type == "TextField" or .role == "AXTextField")] | first // empty')
if [ -n "$FIELD" ]; then
  X=$(echo "$FIELD" | jq '.frame.x + .frame.width / 2')
  Y=$(echo "$FIELD" | jq '.frame.y + .frame.height / 2')
  idb ui tap --udid "$DEVICE" "$X" "$Y"
  sleep 2
  idb ui text --udid "$DEVICE" "student"
  sleep 1.5
  shot keyboard
  AFTER=$(screen | jq -c '[.[] | select(.type == "TextField" or .role == "AXTextField")] | first // empty')
  VALUE=$(echo "$AFTER" | jq -r '.AXValue // ""')
  FY=$(echo "$AFTER" | jq '.frame.y + .frame.height')
  KB=$(screen | jq '[.[] | select((.AXLabel // "") | test("^(return|space|Leerzeichen|Return|go|Go|next|Next)$"))] | map(.frame.y) | min // 9999')
  check "typing in the email field works" "$(echo "$VALUE" | grep -q student && echo 1 || echo 0)" "value=$VALUE"
  check "the field stays visible above the keyboard" "$(echo "$FY < $KB" | bc)" "field bottom=$FY keyboard keys from y=$KB"
else
  check "the email field is there" 0
fi
xcrun simctl terminate "$DEVICE" "$BUNDLE"
xcrun simctl launch "$DEVICE" "$BUNDLE"
sleep 20

# An app link opens its page.
xcrun simctl openurl "$DEVICE" "org.bojes.blob://show"
sleep 12
shot app-link
SHOW=$(screen | find_label "Interactive pictures|Interaktive Bilder")
check "an org.bojes.blob:// link opens its page" "$([ -n "$SHOW" ] && echo 1 || echo 0)"

# A swipe up scrolls.
Y0=$(echo "$SHOW" | jq '.frame.y // 0')
idb ui swipe --udid "$DEVICE" --duration 0.4 200 650 200 250
sleep 2
shot scrolled
Y1=$(screen | find_label "Interactive pictures|Interaktive Bilder" | jq '.frame.y // -999')
check "swiping up scrolls the page" "$(echo "$Y1 < $Y0" | bc)" "heading y $Y0 → $Y1"

# The edge swipe goes back to the page before.
idb ui swipe --udid "$DEVICE" --duration 0.3 2 420 330 420
sleep 3
shot swipe-back
BACK=$(screen | find_label "Welcome back|Willkommen")
check "the edge swipe goes back a page" "$([ -n "$BACK" ] && echo 1 || echo 0)"

# Dark mode.
xcrun simctl ui "$DEVICE" appearance dark
sleep 3
shot dark
xcrun simctl ui "$DEVICE" appearance light

# Still running (no crash).
RUNNING=$(xcrun simctl spawn "$DEVICE" launchctl list | grep -c "$BUNDLE")
check "the app is still running" "$([ "$RUNNING" -ge 1 ] && echo 1 || echo 0)"
xcrun simctl spawn "$DEVICE" log show --last 10m --predicate 'process == "blob"' > "$OUT/log.txt" 2> /dev/null

jq -s . "$OUT/results.jsonl" > "$OUT/results.json"
exit $FAILED
