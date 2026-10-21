# Home-native — Consuela Tablet App (ApoloSign) — Agent Manual

> Native port of the Consuela core hub for the ApoloSign 15.6" wall panel. Start here.
> Design contract: `../docs/superpowers/specs/2026-10-09-home-native-tablet-app-design.md` (parent repo).
> Implementation plan (Wave 0): `../docs/superpowers/plans/2026-10-09-home-native-wave0-foundation.md`.

## ⚠️ SECRETS — hard rule (identical in spirit to Home-ai)

This repo's remote is public-ish (`github.com/ninjass10101010-alt/Home-native`). **NEVER commit or echo a secret:** no `.env*` values (only `.env.example` placeholders ever), no NAS SSH creds, no PocketBase admin creds, no `SESSION_SECRET`/`ADMIN_SECRET`/`CRON_SECRET`, no `*_API_KEY`/`*_TOKEN`/`*_SECRET`. The session cookie is referenced by NAME only (`consuela_session`). PINs are memory-only in the app and are never written to any store, log, test, or file.

**Family privacy:** `reference/` and `screenshots/` contain real family names/photos and are **gitignored — local-only**. Family imagery never reaches the remote. Verify with `git check-ignore` if unsure.

**Before any push:** `bash scripts/security/push-safe.sh` — a hit means redact + commit + re-run.

## Toolchain (Expo SDK 57 — do not trust training data)

Expo ships breaking changes per SDK. Before writing code touching Expo/RN APIs: read the `expo` major version in `package.json`, consult versioned docs (`https://docs.expo.dev/versions/v<major>.0.0/` or `docs.expo.dev/llms.txt`). Recorded baseline: Expo SDK ~57, RN 0.86.3, React 19.2.3, Node 24. Dev deps were installed with `--legacy-peer-deps`; pins that MUST hold: `react-test-renderer@19.2.3` (matches React), `@react-native/jest-preset@0.86.3` (matches RN), `@testing-library/react-native@12.9.x` (v14 requires the `test-renderer` package and silently never-renders under our jest-expo wiring — do NOT upgrade past 12.x without proving `renderHook` works).

Routes live in `app/` (repo-root, expo-router). Non-route code lives in `src/`. Never create `src/app/`. ios/ and android/ are generated (CNG) — never hand-edit; configure via `app.json` + plugins. Local APK builds only (`expo prebuild` + Gradle); no EAS account, no Play Store.

## Documentation contract (mirrors parent + Home-ai)

1. Specs/plans live in the PARENT repo `../docs/superpowers/specs|plans/` — not here.
2. This repo holds: `AGENTS.md` (this file), `CHANGELOG.md` (shipped-change history — every shipped change appends a long-form entry in the same session), `README.md` (setup/build), `docs/` (app-local docs like `docs/critic-loop.md`).
3. Ship = record: CHANGELOG entry same session; if a rule/contract changes, update the owning doc.

## Sync dance (per feature, same session)

1. Verify: `npm test` (jest + tokens:check), `npx tsc --noEmit`, `npx expo lint` green; `git status` + `git diff` review.
2. Commit in Home-native (`feat|fix|docs|chore(scope): …`) + CHANGELOG entry.
3. `bash scripts/security/push-safe.sh` → `git push origin main`.
4. Parent repo: stage ONLY the `Home-native` gitlink (+ any parent docs), commit `chore(submodule): Home-native -> <summary>`, push-safe scan, `git push origin main`. Never `git add .`.
5. Session ends with clean `git status` in both repos.

## Design contracts (summary — spec is authoritative)

- Single device: ApoloSign 1080×1920 portrait, Android 15. No phone/landscape/responsive modes.
- Type floor 14sp; tap targets ≥64dp; AA contrast light+dark+boost; token-only colors (`npm run tokens:check`).
- One nav surface: manifest-driven capsule dock (7 caps/role, kid swaps House→Rewards; More… 8/7/4); caps paint after auth hydration.
- Materials thin/regular/thick via one `Material` component; perf tiers via `perf.ts`; reduced-motion + boost honored.
- Backend: LAN HTTP to the Home-ai Next.js API layer (`http://nas.local:3000` default) — never direct to PocketBase or providers. Body fields win over HTTP status. Stale data is badged or hidden, never faked.
- Music is fully on-device: playback, search, and lyrics resolve through the NewPipe Extractor engine module `modules/youtube-engine/` (GPL-3.0) — no NAS proxy in the music path. The app is licensed GPL-3.0 (`LICENSE` + `NOTICE` at repo root); keep third-party attribution in `NOTICE` intact when adding bundled components. The `explicit` flag is TRI-STATE (`true` = badged explicit, `false` = NOT MARKED EXPLICIT — YouTube's search response carried no `MUSIC_EXPLICIT_BADGE` on that row, `null` = unknown/unrated): the rating is read from YouTube Music's own `MUSIC_EXPLICIT_BADGE` marker in the innertube search response, and the engine ships `explicitKnown` so the app always knows whether the ratings it holds are authoritative. The badge MARKS the explicit tracks; it does not certify the rest — so `false` is "not marked explicit", NEVER "rated clean". The kid policy lives in `src/music/explicit.ts` and FAILS CLOSED — while the filter is on, a kid role (child/pet/guest) sees a track only when its rating says it is not marked explicit; a parent sees everything and unrated rows are marked "Unrated" for them. The NewPipe fallback yields `null` = unknown, so a kid sees nothing and the UI says why (a kid whose search ran on the fallback path is NEVER told "no songs matched" — an empty list must not read as "nothing found"). Read that policy before building UX on `explicit`: the field is tri-state, not a boolean. KNOWN LIMIT (a SOURCE gap, accepted risk): the badge is ONE-SIDED — YouTube does not badge EVERY song row (e.g. Eminem's "Till I Collapse" comes back with `badges: null`), so a song YouTube does not badge can reach a kid. The badge alone cannot be the only signal, but an unbadged row must NOT be treated as unrated in a follow-up: Adele's "Hello" (id `yjo_aXygRDI`) arrives with NO `badges` key at all (captured fixture), so "unbadged ⇒ unrated" would hide every clean song and empty the kids' music surface. A follow-up must cross-check a SECOND signal (a watch-next/metadata rating, or a curated deny-list).
- Quality gate: every surface passes the harsh-critic loop in `docs/critic-loop.md` before it counts as done.
