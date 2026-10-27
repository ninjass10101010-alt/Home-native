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

if [ ! -d android ] || [ "${PREBUILD:-0}" = "1" ]; then
  npx expo prebuild --platform android
fi

if [ ! -f android/local.properties ]; then
  printf "sdk.dir=%s\n" "$ANDROID_HOME" > android/local.properties
fi

# Ensure LAN HTTP cleartext traffic is permitted in standalone release APKs on Android 9+
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && ! grep -q 'android:usesCleartextTraffic="true"' "$MANIFEST"; then
  sed -i '' 's/<application /<application android:usesCleartextTraffic="true" /' "$MANIFEST"
fi

# Ensure sufficient Gradle heap for dex merging and native packaging
if [ -f android/gradle.properties ]; then
  sed -i '' 's/org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx5120m -XX:MaxMetaspaceSize=1024m -Djava.util.concurrent.ForkJoinPool.common.parallelism=2/' android/gradle.properties
  sed -i '' 's/org.gradle.parallel=true/org.gradle.parallel=false/' android/gradle.properties
  if ! grep -q 'org.gradle.workers.max' android/gradle.properties; then
    printf "org.gradle.workers.max=2\n" >> android/gradle.properties
  fi
fi

ARCHS="${ARCHS:-arm64-v8a}"
cd android
./gradlew --stop
./gradlew :app:assembleRelease "-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Djava.util.concurrent.ForkJoinPool.common.parallelism=2" "-PreactNativeArchitectures=$ARCHS" --max-workers=2 -x lintVitalAnalyzeRelease -x lint
APK="$(pwd)/app/build/outputs/apk/release/app-release.apk"
echo "built: $APK"

TARGET_DEVICE="${DEVICE_ID:-192.168.0.112:34229}"
if adb devices | grep -q "$TARGET_DEVICE"; then
  adb -s "$TARGET_DEVICE" install -r "$APK" && echo "installed OK on $TARGET_DEVICE"
  adb -s "$TARGET_DEVICE" shell am force-stop com.garciafam.consuela
  adb -s "$TARGET_DEVICE" shell am start -n com.garciafam.consuela/.MainActivity
else
  adb install -r "$APK" && echo "installed OK" || echo "install skipped (no device attached)"
fi
