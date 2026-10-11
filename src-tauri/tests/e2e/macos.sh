#!/bin/bash
# A smoke test of the macOS app (CI, macOS runner): it starts, shows the site, takes an app link
# while running (one instance), and quits cleanly. Screenshots go to the output folder.
#
#   bash src-tauri/tests/e2e/macos.sh path/to/Blob.app out/
set -u
APP="$1"
OUT="${2:-e2e-macos}"
mkdir -p "$OUT"
FAILED=0
check() {
  if [ "$2" = 1 ]; then echo "ok   $1 ${3:-}"; else echo "FAIL $1 ${3:-}"; FAILED=1; fi
}

# Signed (ad hoc) as a whole, so a downloaded copy isn't called damaged.
check "the app's signature is valid" "$(codesign --verify --deep --strict "$APP" > "$OUT/codesign.txt" 2>&1 && echo 1 || echo 0)" "$(head -c 200 "$OUT/codesign.txt")"
codesign -dv "$APP" >> "$OUT/codesign.txt" 2>&1

open "$APP"
sleep 30
screencapture -x "$OUT/01-start.png"
check "the app is running" "$(pgrep -x blob > /dev/null && echo 1 || echo 0)"

# An app link while it runs: the same app takes it (no second copy).
open "org.bojes.blob://show"
sleep 12
screencapture -x "$OUT/02-app-link.png"
check "an app link doesn't start a second copy" "$([ "$(pgrep -x blob | wc -l | tr -d ' ')" = 1 ] && echo 1 || echo 0)"

osascript -e 'tell application "Blob" to quit' > /dev/null 2>&1
sleep 5
check "the app quits cleanly" "$(pgrep -x blob > /dev/null && echo 0 || echo 1)"
log show --last 5m --predicate 'process == "blob"' --style compact > "$OUT/log.txt" 2> /dev/null
exit $FAILED
