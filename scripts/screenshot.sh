#!/usr/bin/env bash
# Screenshot the attached tablet/emulator into screenshots/ (gitignored — family data).
set -euo pipefail
name="${1:?usage: screenshot.sh <name>}"
mkdir -p screenshots
adb exec-out screencap -p > "screenshots/${name}-$(date +%H%M%S).png"
echo "captured screenshots/${name}-*.png"
