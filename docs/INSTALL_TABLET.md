# Install Consuela (Home-native) on the ApoloSign wall panel

Hardware: ApoloSign 15.6" (RK3576, Android 15, 1080×1920 portrait). The app IS this panel's composition — no phone/landscape builds.

## Build the APK

Prereqs (one-time, this Mac):
- Homebrew Android command-line tools: `brew install --cask android-commandlinetools` (installs `adb` + SDK at `/usr/local/share/android-commandlinetools`)
- JDK 21 (Temurin): the gradle/AGP combo in this repo fails under JDK 25 on this box; download `jdk-21` from the Adoptium API into `~/Library/Java/JavaVirtualMachines/` (see package scripts). Node 24 works.

Then, from `Home-native/`:

```bash
./scripts/build-apk.sh
```

That script (checked into this repo): `npx expo prebuild` → `android/gradlew :app:assembleDebug` → expects `app-debug.apk` at `android/app/build/outputs/apk/debug/`. If a device is reachable (`adb devices` shows one), it also installs it. **Never commit APKs or `android/`** (generated).

## Install on the tablet

1. Enable USB debugging on the ApoloSign (Settings → Developer options).
2. Connect via USB (or use `adb connect <tablet-ip>` for wireless — the tablet is on the home LAN).
3. `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
4. Launch "Consuela" from the launcher — it should cold-start into family Home in portrait, full-screen, stay-awake. The member rail + PIN flow arrive via the web's own `/api/auth/*` cookie semantics.

## Kiosk / always-on pinning (device-side, AFTER install)

1. Screensaver (Consuela's ambient board) is in-app — it takes over after 90s idle on Home (src/home/idle.ts) and any tap exits.
2. Pin the app: Settings → Security → App pinning (Android 15: "Pin app"). Enter the app overview and pin Consuela — Back can't leave.
3. For a true kiosk lock-down (device-owner / immersive sticky), the full device-level setup is documented in parent `docs/superpowers/plans/2026-10-12-home-native-wave3-hardening.md` (WS-11).

## Update / rebuild flow

1. Edit → `npm test && npx tsc --noEmit && npx eslint .` → commit.
2. Rebuild with `./scripts/build-apk.sh`.
3. `adb install -r` — data (session/AsyncStorage/SecureStore) persists.

## Troubleshooting

- **App doesn't boot / white screen:** cold-kill + relaunch. If the NAS is down the app must show the calm "Can't reach the family server" state (Safing) — never a blank board. That's by contract.
- **Pins failing:** confirm the session cookie round-trips (whoami 401 → sign-in banner, never a confusing error).
- **Stuck on a crew/approval:** reopen the wall by swiping out of pinning (Recents → back).
- **Forgot which APK ship:** CHANGELOG in this repo.
