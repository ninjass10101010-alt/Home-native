#!/usr/bin/env bash
# Build the Wall APK locally (no EAS). Requires: Android SDK at
# /usr/local/share/android-commandlinetools (brew --cask android-commandlinetools)
# + JDK 21 (Temurin; JAVA_HOME pin below — system JDK 25 broke AGP/CMake here).
set -euo pipefail

cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-/usr/local/share/android-commandlinetools}"
export JAVA_HOME="${JAVA_HOME:-$HOME/Library/Java/JavaVirtualMachines/jdk-21.0.12.1+1/Contents/Home}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export ADB_USB=0

npx expo prebuild --platform android

if [ ! -f android/local.properties ]; then
  printf "sdk.dir=%s\n" "$ANDROID_HOME" > android/local.properties
fi

# Ensure LAN HTTP cleartext traffic is permitted in standalone release APKs on Android 9+
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && ! grep -q 'android:usesCleartextTraffic="true"' "$MANIFEST"; then
  sed -i '' 's/<application /<application android:usesCleartextTraffic="true" /' "$MANIFEST"
fi

cd android && ./gradlew :app:assembleRelease
APK="$(pwd)/app/build/outputs/apk/release/app-release.apk"
echo "built: $APK"
adb install -r "$APK" && echo "installed OK" || echo "install skipped (no device attached)"
