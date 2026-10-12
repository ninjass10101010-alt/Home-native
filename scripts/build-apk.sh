#!/usr/bin/env bash
# Build the Wall APK locally (no EAS). Requires: Android SDK at
# /usr/local/share/android-commandlinetools (brew --cask android-commandlinetools)
# + JDK 21 (Temurin; JAVA_HOME pin below — system JDK 25 broke AGP/CMake here).
set -euo pipefail

cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-/usr/local/share/android-commandlinetools}"
export JAVA_HOME="${JAVA_HOME:-$HOME/Library/Java/JavaVirtualMachines/jdk-21.0.12.1+1/Contents/Home}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

if [ ! -f android/local.properties ]; then
  printf "sdk.dir=%s\n" "$ANDROID_HOME" > android/local.properties
fi

npx expo prebuild --platform android
cd android && ./gradlew :app:assembleDebug
APK="$(pwd)/app/build/outputs/apk/debug/app-debug.apk"
echo "built: $APK"
adb install -r "$APK" && echo "installed OK" || echo "install skipped (no device attached)"
