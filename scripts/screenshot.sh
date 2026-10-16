#!/usr/bin/env bash
# Screenshot the attached tablet/emulator into screenshots/ (gitignored — family data).
set -euo pipefail
name="${1:?usage: screenshot.sh <name>}"
mkdir -p screenshots
if ! adb shell dumpsys window displays | grep -q "com.garciafam.consuela/"; then
  echo "error: com.garciafam.consuela is not the focused foreground window" >&2
  exit 1
fi
adb exec-out screencap -p > "screenshots/${name}-$(date +%H%M%S).png"
echo "captured screenshots/${name}-*.png"
