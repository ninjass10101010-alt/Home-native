# Home-native — Consuela for the ApoloSign wall panel

Native Expo/React Native client of the Consuela family dashboard, designed for one device: the ApoloSign 15.6" 1080×1920 portrait wall panel (Android 15, RK3576). Talks to the NAS-hosted Home-ai API layer over LAN. The web PWA remains the primary client; this is an additional client per the design spec.

## Toolchain

| Piece | Version |
|---|---|
| Expo SDK | ~57.0.27 |
| React Native | 0.86.3 |
| React | 19.2.3 |
| Node (dev machine) | v24.13.1 |
| Package manager | npm (dev deps installed once with `--legacy-peer-deps`; `react-test-renderer` pinned to 19.2.3 to match React) |

## Toolchain rules

- Always `npx expo install <pkg>` (SDK-compatible versions), never raw npm add for Expo modules.
- `ios/` and `android/` are generated (CNG) — never edit by hand; configure via `app.json` + plugins.
- APKs build locally (`expo prebuild` + Gradle). No EAS, no Play Store.

## Commands

```bash
npm run start       # expo start (dev server)
npm run android     # build + install on attached device/emulator
npm test            # jest + token-literal gate
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run tokens:gen  # regenerate src/theme/tokens.generated.ts from ../Home-ai/globals.css
npm run push:safe   # secrets scan — REQUIRED before any git push
```

## Device notes

Panel display metrics: **PENDING-HARDWARE** — run `adb shell wm size; adb shell wm density` with the tablet attached and record here before Task 10 locks layout math (expected 1080×1920 @ portrait).

## Docs

- Agent manual: `AGENTS.md`
- Design spec + Wave 0 plan: parent repo `docs/superpowers/specs|plans/2026-10-09-...`
- Critic loop (quality gate): `docs/critic-loop.md` (lands in Task 15)
