# Critic Loop — Home-native

The quality engine for every surface (spec §7). Every workstream passes this loop before it counts as done.

## Roles

- **BUILDER sub-agent:** implements one workstream, self-checks against the contract
  checklist, captures RN screenshots (`scripts/screenshot.sh` on-device, or the dev
  preview capture at `/_design` while hardware is pending), hands off.
- **CRITIC sub-agent:** fresh cold context. Receives ONLY this rubric + the
  reference PNGs (`reference/<route>/*`) + the RN screenshots (`screenshots/*`).
  Never sees builder intent. Harsh by design: a rubber stamp is a failure.
- **ORCHESTRATOR** (the human's session agent): shuttles defect lists builder↔critic;
  max 5 cycles, then escalate with side-by-side evidence. Never lets them talk
  directly.

## Rubric — all five axes must PASS (zero Critical/High defects)

1. **Fidelity** — layout, spacing, materials, palette vs reference captures at 1080×1920.
2. **Contracts** — 14sp type floor; 64dp targets; AA contrast light+dark+boost;
   token-only colors (`npm run tokens:check` clean); manifest nav only;
   reduced-motion and high-contrast honored; honest empty/error/offline/stale states.
3. **Feel** — 60fps motion (Reanimated), material press response, calm over clever.
4. **State coverage** — loading, empty, error, offline (unreachable), stale-badge;
   kid pending-approval honesty where applicable.
5. **Voice & brand** — warm Consuela copy, emoji identity, no generic-app tells.

## Critic prompt template (paste verbatim into the critic sub-agent)

You are a HARSH visual-design critic for a faithful React Native port of a
production family dashboard (Warm Glass v2). You judge OUTCOMES ONLY.
You will receive: (a) the rubric, (b) reference PNGs from the production web app
(1080×1920, wall mode), (c) RN implementation screenshots of the same states.
Find defects. Cite pixel/contract evidence per defect (what, where, expected
vs actual, severity Critical/High/Low). Critical = contract breach, unreadable
type, wrong data state, broken tap target, theme violation, dishonest staleness.
High = visible fidelity gap (spacing, material, type ramp). Low = polish.
If you find nothing, say EXACTLY "PASS: zero Critical/High" and list residual
Low nits. Never suggest redesigning away from the reference. A rubber stamp is
a failure.

## Builder prompt template (paste verbatim into the builder sub-agent)

Implement <workstream> for the Home-native Expo app. Read docs/critic-loop.md,
the spec/plan, src/theme/*, src/ui/*, src/api/* FIRST. Use ONLY existing
primitives + tokens; if a needed primitive is missing, STOP and report instead
of inventing one. Self-check: npm test && npx tsc --noEmit && npm run lint
green, then capture screenshots of every state (loading/error/offline
included) via scripts/screenshot.sh, then self-review against the rubric
BEFORE handoff.

## Loop mechanics

1. Builder ships → 2. Critic scores against rubric → 3. Fail: orchestrator
   returns the defect list (verbatim) to the SAME builder thread → fix →
   re-screenshot → the SAME critic thread re-reviews the full rubric →
4. Pass: archive screenshots under `screenshots/accepted/<workstream>/`,
   append CHANGELOG entry, next workstream.
5. Five failed cycles → STOP, escalate to the human with the latest
   side-by-side evidence.

## Environment notes (2026-10-09)

- Reference captures: `npm run reference:capture` (needs the Home-ai dev server:
  `cd ../Home-ai && PORT=3100 npm run dev`; matrix = 84 PNGs).
- Device captures: `scripts/screenshot.sh` requires adb + the tablet (or an
  emulator). If no hardware is attached, capture the dev preview of `/_design`
  with Playwright instead (documented when it's wired).
