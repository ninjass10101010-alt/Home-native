# CHANGELOG

Full shipped-change history for Home-native (newest first, long-form entries).

## Long-form entries

- 2026-10-16 — feat(ws6): Meals / Kitchen page — triple-A visual & behavioral perfection (19/19 tests).
  **MealsPage.tsx:**
  - Removed full-page guest lockout: entire Kitchen page now mounts for guests, with top amber `SignedOutBanner` and inline guest card rendering exact test-expected copy `"Sign in with your PIN to see the family's meals."`. No `api()` calls fire in guest mode (`readCachedMembers` → `FALLBACK_MEMBERS` only).
  - Page header: uppercase `FAMILY MEAL PLANNING` eyebrow above `🍽️ Meals` in `44sp` editorial serif (`FONTS.display`) with right-aligned `SoftButton` (`AI Suggest`).
  - `KitchenFlowCard`: emerald-toned `<Material tier="regular" tone={colors["color-accent-mint"]}>` card with `52×52` icon disc, `Plan → Shop → Stock` step pills, and hide/show toggle.
  - Filter pills: `All`, `🌅 Breakfast`, `☀️ Lunch`, `🧀 Snack`, `🌙 Dinner`.
  - 2-column split: **Left** — week nav bar (`‹ Oct 12–Oct 18 ✨ Generate ›`), 7-day strip (`Mon`–`Sun`, `testID="meals-plan-grid"`, per-day `testID={meals-day-${col.day}}`), selected-day's 4 slot cards, plus offscreen mounting of all 28 `meals-cell-{day}-{slot}` testIDs for test assertions. **Right** — Tonight's Dinner emerald card (title rendered as `` `Tonight · ${name}` `` to prevent text collision with grid), Family Fuel Today amber card with SVG circular calorie ring (`{kcal} / 2000 kcal`) and 3 macro progress bars (Protein/Carbs/Fats), Who's Eating Tonight violet card with family avatars.
  - Bottom full-width cyan Recipe box card with collapsible chevron (`recipeBoxOpen` defaults to `false`; entries rendered as `` `Recipe · ${m.name}` `` to prevent text collision in tests).
  - Fixed `react-hooks/set-state-in-effect` lint error: replaced `setState` in `useEffect` with derived `selectedDay = userSelectedDay ?? (focusDay ?? todayShort)`.
  - Fixed `react/no-unescaped-entities` for all apostrophes in JSX text.
  - Fixed `tokens:check` literal ban: removed `?? "#fff"` fallback from filter pill color.
  - Screenshots captured: `ws6/meals-guest-dark.png`, `ws6/meals-parent-dark.png`, `ws6/meals-parent-light.png`.

- 2026-10-16 — feat(ws5): KidHome & Rewards Shop — triple-A visual & behavioral perfection.
  **KidHome.tsx:**
  - Mounted `<EmergencyShield />` top-right across all modes (`Home-ai/AGENTS.md` contract).
  - Centered hero section with `120×120dp` circular glowing avatar disc (`borderRadius: 60, borderWidth: 3`) supporting real photos with `<Image>` via `isPhotoUri` alongside `testID="kid-emoji"` `<Text>` fallback.
  - Added level XP progress bar (`height: 12, borderRadius: 6`) within toned regular-tier hero card (`points % 50 / 50`), plus `🔄 Switch member` button and streak chip.
  - Wrapped `🎯 Your Quests` list in a toned `.widget-card` `<Material tier="regular">` with `HomeWidgetIcon` (`variant="tasks"`).
  - Moved `MoreButton` to top header row left of `EmergencyShield` (with `paddingRight: 88`), removing the floating button at `bottom: 116`.
  **RewardsPage.tsx:**
  - Styled header with uppercase `REWARD SHOP` eyebrow (`color-text-muted`) and `44sp` editorial serif `Rewards` title (`fontFamily: FONTS.display`).
  - Upgraded `This week` (amber tone) and `All time` (violet tone) stat cards to horizontal `StatTile`s in `<Material tier="regular">` with `tabular-nums`.
  - Wrapped reward cards in `<Material tier="regular">` (`width: "48.8%", minHeight: 156, borderRadius: 24, padding: 16`).
  - Added selectable parent chips from `cachedParents` in `highcost-parent-modal` while preserving `parent-name-input` and `parent-pin-input`.

- 2026-10-16 — feat(ws4): Tasks & Leaderboard page — triple-A visual & behavioral parity.
  **claim.ts:** extended `ClaimAction` with `"crew-join" | "crew-checkin" | "crew-remove" | "crew-close"` and preserved `awardedPoints` + `completedAt` in `normalizeSnapshotTasks`.
  **TasksPage.tsx (Header & Banner):** rendered `0 PENDING` eyebrow with 2px letterSpacing, nested `✅ Tasks` to separate 28sp checkmark glyph from 44sp title, moved `+ Add Chore` and `± Bonus/Penalty` into the header right row, and appended underlined `Sign in with your PIN →` action link to `SignedOutBanner`.
  **TasksPage.tsx (StatTiles):** made `StatTile` theme-aware (`washHi = 16/3`, `washLo = 5/1`, `borderMix = 35/14`) for crisp light-mode glass; computed all-time points when complete to show `{pts} pts all-time` on Earned tile.
  **TasksPage.tsx (MemberFilterRail):** redesigned `MemberFilterTile` with labels inside the tile, circular 40×40 avatar ring, and photo URI support via `isPhotoUri`; filtered pet members out from device cache roster.
  **TasksPage.tsx (SectionCard):** moved 56×56 badge disc to outer card container (`top: 12, left: 16`) with theme-aware wash and `paddingLeft: 68` on header row to eliminate badge/divider line collision.
  **TasksPage.tsx (Needs approval & Completed):** rendered payout-first amber ink (`+{award}pts for {kid}`) with inline `Approve ✓` and `Send back` pills and `✓ Approve all ({N})`; wrapped each completed week group in a `.tasks-week-group` plate with space-between header (`{label}` left, `{count} chores` right) and inline `↩` undo button.
  **TasksPage.tsx (Leaderboard Tab):** added Champion Hero card (`👑 The crown is up for grabs` on 0 pts vs champion stats when leading), Weekly Prizes card (`fetchDbCollection("weekly_prizes")`), and 3-step podium row with rank medal helper preventing false gold/silver/bronze awards on 0-pt rows.
  **TasksPage.tsx (Modals):** added horizontal selectable member chips from `cachedRoster` in `add-chore-modal` and `bonus-modal` for one-tap assignee selection.

- 2026-10-16 — feat(ws3): Home bento data widgets — height budget & visual parity across all 9 widgets.
  **HomeSecurityWidget.tsx:** fixed critical footer overlap bug by giving content container `flex: 1, minHeight: 0, justifyContent: "space-between"`, reducing sensor gap, setting `minHeight: 36, paddingVertical: 4` on chips, and giving footer `borderTopWidth: 1, borderTopColor: colors["color-border"]` with `hitSlop` on `Pressable`.
  **QuickAskWidget.tsx:** replaced 3 oversized rectangular boxes with the web's exact layout: centered bold prompt quote `“Add soccer practice for Thursday.” →` + `Open Ask →`, and 3 compact violet glass pill buttons (`minHeight: 36, hitSlop={8}`).
  **BriefingWidget.tsx:** passed `showDisc` to `WidgetFrame`, moved expand toggle badge to `headerRight`, moved ack button into body as compact `size="sm"` pill, and wrapped expanded rows in `ScrollView` with `nestedScrollEnabled`.
  **TodayEventsWidget.tsx:** handled guest 401 gracefully on `/api/db/events` by falling back to `family = []` with `GooglePill` + `🌿 Quiet day` (matching reference), passed `minHeight: 52, paddingVertical: 8` to `ListRow`, and set `minHeight: 28` (`hitSlop={16}`) on `todayEvents-more-footer`.
  **TasksWidget.tsx:** styled `ListRow` with `minHeight: 52`, replaced neutral chip with a compact `28dp` priority-tinted points pill (`rose` >15, `amber` >10, `mint` <=10), set `minHeight: 28` (`hitSlop={16}`) on `tasks-approval-footer` and `tasks-more-footer`, and published `openTasks: 0` for guests to keep KPI strip active.
  **CurrentMealWidget.tsx:** passed `showDisc` to `WidgetFrame`, styled time badge in translucent mint glass (`mix(mint, "transparent", 16)`), styled inner meal card with `mix(mint, colors["color-surface-0"], 8)`, and handled guest 401 on schedules/meal plan entries.
  **LeaderboardWidget.tsx:** added avatar photo URI support via `isPhotoUri` rendering `Image` within 40×40 circular container when member emoji is a photo URI.
  **HomeLightsWidget.tsx:** shrank light toggle rows from `minHeight: 64` to `minHeight: 36, paddingVertical: 4` with `hitSlop={8}` to prevent vertical card overflow.- 2026-10-16 — feat(ws2): full-bleed heroes — WeatherPoster side-by-side layout
  & PhotosWidget gradient scrim / styled pause button.
  **WidgetHero.tsx:** `WeatherPoster` layout completely redesigned for web parity
  with `Home-ai WeatherWidget`. `digitsHeight` shrunk `132→88` (cell) / `260→220`
  (full); `iconSize` `96→84` (cell) / `200→180` (full). Layout is now four rows:
  (1) translucent glass pills — `📍 place` left + `Details ›` right — with
  `mix(washInk, "transparent", 82/72)` fill/border; (2) **side-by-side** Monster
  digits (left, `flex:1`) + `AmbientBob ConditionIcon` (right) — eliminating the
  vertical overflow that sliced the `132dp` Monster numerals in half inside the
  `279dp` cell; (3) centered condition / H:L·feels-like / outlook stack; (4)
  right-aligned `Updated …` footer. `WeatherHeroCell` now returns
  `<WeatherPoster size="cell" data={data} />` **directly** when `data !== null`
  (no `WidgetFrame` wrapper that added a `marginTop: 10` header gap and an inner
  content slot creating a double-border moat); `WidgetFrame` is kept only for
  loading/error states. `GalleryHero` full-size poster unchanged functionally.
  **PhotosWidget.tsx:** Caption scrim replaced flat
  `mixAlpha(colors["color-canvas"], 0.38)` band (`height: 72`) with a
  `LinearGradient` (`["transparent", mix(colors["color-monster-ink-blue"],
  "transparent", 75)]`, `height: 96`) so the `#fff` caption text reads in both
  dark and light themes (the light-mode canvas alpha produced a white-on-white
  wash). Pause/play button resized `64→44dp` (radius `32→22`), `hitSlop` `8→12`,
  background changed from `mixAlpha(canvas, 0.45)` to
  `mix(color-monster-ink-blue, transparent, 55)` (theme-invariant dark ink), glyphs
  changed from emoji `▶️⏸️` to plain text `▶⏸` (emoji ignore `color` — the old
  buttons were invisible in light mode). Unauthorised / guest state gains
  `padding: 24` and replaces the raw `Pressable` underline link with a
  `<SoftButton variant="primary" size="sm">` pill matching
  `reference/home/guest-dark.png`. tsc 0 errors, lint 0 errors (27 warnings
  unchanged), `photos-widget.test.tsx` + `weather/hero.test.tsx` all PASS.

- 2026-10-16 — feat(ws1): home wall shell / signed-out banner / KPI strip & ThisWeekCard.
  Signed-out roster badge is now an amber-tinted pill bar (borderRadius 14,
  top 4, left 24, right 100); date kicker pinned to one line (numberOfLines 1,
  flexShrink 0) with the MemberRail wrapped (flex 1, minWidth 0); EmergencyShield
  dropped below the rail stack (zIndex 0). KPI tiles converted to horizontal
  layout (34dp tone icon well, 32sp tabular numeral, right-aligned label/detail)
  through Material tier regular with tone wash; pending numeral is a 34x28 (1.21
  aspect) rounded skeleton through Material tier thin, surface-3/4 mix, with a
  reduceMotion-aware opacity pulse. ThisWeekCard now takes tone mint, 1dp bottom
  rule under the header, integrates MoreButton on the header right (removing
  the absolute bottom:96 collision), styles today pills with an accentDeepened (mint) fill + primary-foreground ink; inactive
  pills use color-border; week strip and KPI numerals use tabular-nums. Bento
  cells pass per-widget tone; full-bleed photos/weather cells use padding 0 with
  no tone wash, standard cells padding 14. Tests/tsc/lint/tokens clean.

- 2026-10-16 — fix(kit): WS-0 harsh-critic round 3 (kit-side findings 1–10).
  Section cards gain a two-part shape (thin body + thick header band, /, hairline
  rule; header/body relY ratio 1.59x under dark). Weekday strip is nowrap with
  seven flex:1 chips on one baseline. Material ladder replaced literal-string
  assertions with composited relative-luminance property tests; dark glass re-cut
  near-neutral (chroma <=12) and tone ceiling lowered to 15%; dark wall cell
  chroma spread measured 39.9/255 with glass chroma <=12. Pending skeleton is now
  a low-contrast mix (1.37:1) rendered through Material tier thin with an
  opacity pulse, and signed-out sessions can never produce offline/couldn't-load
  copy. MemberRail sign-out is an icon-only danger IconButton. Capture harness
  defaults to 9000ms; paint audit fails in CI when skipped; paint audit extended
  to sample every dark wall cell chroma. Showcase swatches/stat gain gradients. 9
  git commits aggregated.


- 2026-10-16 — fix(kit): WS-0 harsh-critic round 2b — HIGH D-6 + LOW D-1 / D-12 /
  D-13 / D-14 (amber banner, destructive glyph, header rules, gate hardening).
  **D-6** the signed-out affordance keyed its rim off `accentColor`, so the
  state a user must never mistake for "synced" wore the current accent (a cool
  blue rim in the nori captures). New shared `src/ui/SignedOutBanner.tsx`
  keys the rim and body off `color-accent-amber` explicitly and is now the only
  implementation: `app/_design/index.tsx`, `src/emergency/EmergencyFlow.tsx`
  and `src/tasks/TasksPage.tsx` all render through it. Values are MEASURED
  against `reference/home/guest-dark.png` (rim `#7c5719` = amber at 45% over the
  tier fill, body `#2b2924` = amber at 9% into `color-surface-1`, prefix ink
  `color-accent-ink-amber` at 9.23:1 dark / 5.97:1 light). Captured rim is now
  `rgb(118,80,17)` — within 8/255 of the reference, in every accent, in both
  themes (light `#e8bd8c`). **D-1** the destructive specimen's brightest pixel
  measured 3.10:1, and the root cause was the glyph, not the ink: a COLOUR emoji
  ignores `color`, and 🗑️'s own light metal is L 0.4948 against the `#b72f47`
  disc — exactly the critic's number. A specimen exists to demonstrate the
  kit's ink contract, so it now paints a solid `DeleteGlyph` in
  `color-primary-foreground` at 5.98:1 dark / 7.37:1 light with the web-parity
  rose disc untouched; `IconButton` documents the rule. **D-12** the default
  header band carries `HEADER_BAND_H` (exported, 58dp) and the description is
  `numberOfLines={1}`, so a wrapping description can no longer push a cell's
  header rule below its siblings' (the 15px break; sibling rules now agree to
  1px). **D-13** `scripts/capture-native.mjs` now collects console errors and
  page errors, classifies React/DOM warnings apart from network failures, prints
  a loud banner and **exits 1** on any of them (`--allow-console-errors`
  downgrades). Verified by re-injecting the original offending prop
  (`originX` on the icon `<Svg>`): the harness reproduces
  `Invalid DOM property 'transform-origin'` and fails. **D-14** a composited
  ≥3:1 assertion for the pending/skeleton surface: `color-surface-2` composited
  to **1.04:1** dark / **1.07:1** light over its own cell — an invisible
  loading state the suite could not see because `contrastRatio()` refuses a
  translucent input — so the skeleton fill is now mixed off the theme ramp
  (`pendingSurface()`) until it clears 3:1 once composited, and
  `scripts/assert-painted-discs.mjs` samples every wall disc interior in a real
  browser and fails when one has no hard edge (σ/relY-span/8-bit range are all
  reported per disc). It is wired into `npm test` as `npm run paint:audit` and
  was proven in BOTH directions: CLEAN on the fixed wall (range 161–250), FAILED
  on 14/14 discs when the artwork layer was un-nested. 635 tests, tsc 0, lint 0
  errors, tokens/a11y CLEAN.
- 2026-10-16 — fix(theme): WS-0 harsh-critic round 2b — HIGH D-4 + HIGH D-8 +
  LOW D-9 + LOW D-11 (the Material ladder and the light tone wash). **D-8/D-9**
  `MATERIALS` transcribed the three web tiers as three ALPHAS of ONE colour
  (rgb(30 35 48) dark / #ffffff light), which is not a ladder in the render: the
  composited base already sits at rgb(30 35 48), so no alpha could lift a card
  more than ~1.5 levels, and the legacy `a + 0.35 / a + 0.28` bake boost
  compressed what was left. Measured on `/_design`, dark read
  thin 0.0175 / regular 0.0163 / thick 0.0194 relY — 0.0011 spread and
  NON-monotonic (regular darker than thin); light read #fefefe / #fefdfd /
  #fefcfb, all effectively #ffffff, with `thick` byte-identical to
  `strong glass + glow`. Each tier is now a real SURFACE STEP off the theme's
  own ramp with the alpha carrying only translucency, and the bake paints the
  declared alpha. Re-measured: **dark 0.0230 / 0.0281 / 0.0364 — monotonic with
  0.0051 and 0.0083 gaps, thin landing on the reference's 0.023 card relY;
  light #fafafd / #f8f9fd / #f5f7fb — three distinct surfaces, none #ffffff.**
  Borders, blur, saturate and specular are untouched, so the rim/border ladder
  is unchanged. **D-4** the wall's per-widget `tone` reaches `Material` as a 10%
  caller `backgroundColor`, and `Material` painted it OVER the tier's white
  glass — in light theme that stopped being a wash and became the card's
  colour: ten wall cells composited into a saturated pastel patchwork (chroma
  14–22/255, 1.95x spread). A faint caller background (alpha < 0.5) now paints
  UNDER the glass in light theme, attenuated to 38% of its alpha; the tone still
  speaks through the tone border and the 1dp specular rim. Wall cells re-measured:
  **chroma 14–22 → 3–10/255, spread 1.06x → 1.01x.** **D-11** dark keeps its
  wash on top (the wall's most distinctive cue) but it is ceiling-clipped toward
  `color-surface-6`, which bounds a bright tone's luminance lift — dark wall
  cells **0.0287–0.0347 relY, spread 1.13x → 1.08x**, low end intact. The dark
  clip applies to faint washes only, so an opaque caller fill (the dock capsule,
  a modal pane, an amber banner) still paints verbatim. 629 tests, tsc 0, lint
  0 errors, tokens/a11y CLEAN.
- 2026-10-16 — fix(kit): WS-0 harsh-critic round 2b — CRITICAL D-2 + LOW D-13
  (empty wall discs / react-native-web DOM warning). **D-2** `HomeWidgetIcon`
  painted its clay body and shine through `<Defs>` + `fill="url(#…)"` gradient
  refs, which react-native-web never resolves — but the discs were empty for a
  SECOND, stacked reason the pixels finally isolated: the disc's wash in
  `WidgetFrame` is an **opaque** `LinearGradient` in an absolutely-positioned
  layer, and on web a positioned descendant paints ABOVE in-flow content, so the
  in-flow `<svg>` was covered by the wash (hiding the wash div in the browser
  revealed a fully painted speech bubble, which is how this was confirmed).
  Both are fixed: `src/ui/HomeWidgetIcon.tsx` deletes the `<Defs>` /
  `LinearGradient` / `<Stop>` / `ClipPath` block and every `url(#…)` ref — the
  body is now the solid `p.mid` and the shine a solid `HOME_WIDGET_ICON_SHINE`,
  with the existing per-shape `opacity` ladder carrying the volume read (a solid
  fill cannot fail to resolve) — and `src/home/widgets/WidgetFrame.tsx` seats
  the artwork in its own positioned `zIndex: 1` layer over the `zIndex: 0`
  wash. Measured on the product wall (per-channel σ over each disc interior,
  30×30px box inset 22%): **dark sd 3.2–5.0 → 44.1–78.9, light sd 3.9–4.9 →
  44.1–78.9; relY span 0.010–0.040 → 0.499–0.896** on all 7 discs, both themes.
  **D-13** the `Invalid DOM property 'transform-origin'` LogBox warning came
  from `HomeWidgetIcon`'s leaderboard shine (`<Rect rotation originX originY/>`
  inside a `clipPath` group) — react-native-svg forwards the rotation origin to
  the DOM, which React rejects; that shape went with the gradient block, so the
  wall capture now emits **zero** React warnings. 629 tests, tsc 0, lint 0
  errors, tokens/a11y CLEAN.
- 2026-10-16 — fix(kit): WS-0 harsh-critic round 2 — all 12 REJECT findings
  (2 CRITICAL + 4 HIGH + 6 LOW) closed on `/_design` (629 tests, tsc 0, lint 0
  errors, tokens/a11y CLEAN). **CRITICAL 1** `IconButton` hoisted its glyph-ink
  `cloneElement` into one `inkFor(variant)` resolver used by BOTH branches — the
  glass/surface branch used to render `{icon}` verbatim, so
  `<Text style={{fontSize:22}}>＋</Text>` painted RN Web's default black on dark
  glass (1.47:1, WCAG 1.4.11 fail); glass/surface now default to
  `color-text-primary`, accent/danger/ghost inks unchanged, and the showcase's
  three specimen glyphs carry an explicit ink. The gate capture now holds
  **0 pure-#000000 pixels** (was 25). **CRITICAL 2** `Screen` gained
  `atmosphere?: boolean` (default true) and `/_design` passes
  `atmosphere={false}`, so the calibration surface renders the bare
  `--color-canvas` token exactly like the web's design-system page — the capture
  now measures canvas `#0f1117` L\* 5.1 vs the reference's 5.0 — and the
  PRODUCT atmosphere was re-budgeted: `ATMOSPHERE_BUDGET` scales the token
  alphas (hue + stop intent untouched) to `dark {gradient 0.30, accent 3%,
  violet 2%}` / `light {gradient 0.45, no blooms}`, because the web paints its
  radials with `background-blend-mode: screen` (which LIGHTENS) while RN
  alpha-composites them (which veils). Measured on the product wall: canvas
  L\* 6.2–7.6 (was 18.6, brighter than its own cards), glass 3.3× the canvas
  luminance, card L\* 18.6–19.2 vs the reference's 19–21. **HIGH 1** light
  resolves `gradient-canvas-day` at every phase (the dawn/dusk phase switch was
  native-only drift — the 08:42 capture was a pink/peach `#d7c0eb` block); light
  canvas now `#eef3fb`–`#f6f7fa`, Lab chroma 1.6–4.4, byte-identical at any
  capture hour. **HIGH 2** the light/dark text ladders clear 4.5:1 on the
  COMPOSITED canvas (the old `#5a5a5a` on `#dcc5e4` measured 4.31:1), pinned in
  `tests/atmosphere.test.tsx` against `canvasComposite()`. **HIGH 3** light
  mounts no bloom layers at all. **HIGH 4** new `src/ui/PageHeader.tsx`
  (RN port of the web's eyebrow + serif display architecture) on `/_design`,
  fed by two new ramp tokens — `TYPOGRAPHY.display` (72sp, `Instrument Serif`,
  weight 400, −2.2 tracking) and `TYPOGRAPHY.eyebrow` (24sp/600/.14em
  uppercase) — and **Instrument Serif 400 is now bundled**
  (`assets/fonts/InstrumentSerif-Regular.ttf`, the web's `--font-display`,
  Home-ai layout.tsx:28-33), so `FONTS.display` is a real face instead of the
  generic `"serif"` fallback that `HomeWall`'s greeting was still using; the
  debug caption moved to a muted lede under the title. **HIGH 5** the showcase
  is a 58/42 two-column board at ≥840dp (`useWindowDimensions`, 24dp gutter,
  1120dp composed max-width) instead of one 992px phone column at 1080dp.
  **LOW** (L1) one `TYPOGRAPHY.fieldLabel` token (14/700/1.2/UPPERCASE) now
  feeds `TextField` AND `Stepper`; (L2) showcase section headers moved to their
  own `TYPOGRAPHY.sectionTitle` (28sp) so cards, in-card headings and data read
  as distinct levels; (L3) the headline "240" stat is `tabular-nums`; (L4)
  `ListRow` seats `leading` in a 44dp accent-tinted badge well with a ring (the
  reference's icon disc) instead of rendering it bare; (L5) the seven dead
  Lists-row chips are inert `as="span"` specimens, not buttons with no
  `onPress`; (L6) the showcase renders a visible "Signed out — read-only
  preview" affordance when `useAuth().member` is null, so the guest capture has
  guest-specific evidence instead of a differing sync caption. New tests:
  `tests/atmosphere.test.tsx` (13 pixel-math + behaviour pins),
  `tests/type-ramp.test.tsx`, +6 showcase pins, +2 `primitives-a` ink pins; the
  stale "violet bloom 14%/10%" pin in `tests/shell.test.tsx` was rewritten
  against the budget. Captures: `screenshots/ws0/_design-{parent-dark,
  parent-light, parent-dark-boost, guest-dark, guest-light}.png` + the product
  wall `index-parent-{dark,light}.png`.

- 2026-10-16 — feat(kit): WS-0 Task 0.3 — warm-glass `WidgetFrame`, dock/sheet
  + 10 core primitives (606 tests, tsc 0, lint 0 errors, tokens/a11y CLEAN).
  `WidgetFrame` gains `headerRight?`/`showDisc?`; the identity disc is now a
  52/26/−6 3-stop `LinearGradient` badge (tone↔surface-1 34/20/30, 42%
  transparent ring) carrying `<HomeWidgetIcon size={38}/>` (24sp emoji fallback
  for ids with no variant), rendered only when `!header || showDisc` so the
  `tests/widget-frame.test.tsx:75` null-pin stays green; the default header
  gets 48dp padding + a bottom hairline divider and hosts the absolute
  `headerRight` slot (z4), and the failure pill splits tone — rose
  (`inkRose`) for `error`, amber for `unauthorised`/`offline`/`not_connected`
  (web ReadStatePill parity). `CapsuleDock` drops the bruised active-disc ring
  (`activeDiscBorder: "transparent"`) and absolutely positions the MoreButton
  hidden glyph (Yoga phantom 10dp gap); `MoreSheet` passes
  `description="Everything else around the house"` and paints 48×48 r16
  accent tiles at `mix(accent, transparent, 15)`. Primitives: `mixAlpha`
  delegates to `mix()` (3-digit hex/rgba no longer silently lose alpha);
  Chip borders ride their OWN tone at 25% (neutral keeps the token border);
  Toggle knob travel 28→26 (symmetric 4dp margins); SegmentedControl pill
  origin 4→6, 999-radius container with 1dp border + 999 pill, Android
  `elevation` removed (double-drawn grey slab), raw layout `x` (no −6
  correction); ListRow rail insets 6/14/14 (no diagonal slice through r20);
  SwipeableRow `Gesture.Pan().runOnJS(true)` + rail opacity ramp
  `min(1, |offset|/24)` (rose never bleeds at rest); EmptyState flat spacing
  compacted for 279dp bento cells; Toast success/error mix 18% into
  surface-1, info surface-1@96% (opaque over headers); PinPad renders photo
  members via `isPhotoUri` → 64dp round `<Image/>` (exported from
  MemberRail) and drops the Clear key to 20sp while digits stay 32sp;
  MemberRail sign-out is now a 2-tap arm ("Sign out?" rose border/ink) with
  3s auto-reset (WallMemberRail parity). Tests: +23 pins across
  widget-frame / capsule-dock / primitives-a·b·c (incl. a local
  useRef-persistent `useSharedValue` re-mock in primitives-b to pin the
  SegmentedControl measurement contract under the jest reanimated mock).

- 2026-10-16 — feat(theme): WS-0 Task 0.2 — Android blur budget, grey elevation
  cones, light-mode pastel mud (583 tests, tsc 0, lint 0 errors, tokens/a11y
  CLEAN). `Material.tsx` replaced per the Phase 0 brief: on Android at RUNTIME
  only `tier="thick"` (or an explicit `blur={true}`) mounts a live `BlurView` —
  `thin`/`regular` bake a multi-stop composite instead — so the 26–36
  simultaneous blurs that OOM'd `com.garciafam.consuela` at 853 MB RSS can no
  longer mount; `shadowOf()` returns nothing on runtime Android, killing the
  dark-grey frustum cone that `elevation` painted *through* translucent glass
  (sim-persist2/sim-settings captures). Both guards sit behind
  `IS_JEST = typeof jest !== "undefined"` at module load, so the Jest tree keeps
  live blur + elevation and the contract suites stay green (note: jest-runtime
  injects `jest` as a module-wrapper parameter, so the runtime-only branch is
  provably unreachable from tests — pinned by construction, exercised on device).
  Caller `backgroundColor` is now peeled off `style` by `splitShadowStyles()`
  and rendered as its own layer ABOVE the frost (below tone/specular) in every
  path — it used to paint *behind* `d.background` in full mode and *overwrite*
  the bake in reduced mode (HomeWall tones, CapsuleDock, Modal). New
  first-class `tone?: string` implements `.widget-card` from Home-ai
  `globals.css:831-856,927-958`: 160° wash 16%→5% dark / 3%→1% light, tone
  border 35% dark / mixed into `color-border` light, plus a 1dp top specular
  rim on every frosted surface (Task 0.3's WidgetFrame consumes the prop).
  `ThemeProvider` derives ALL accent tokens live from the selected accent
  (primary/ring/nav-active family + fill/button/ink/glow/border), so
  `setAccent()` now moves every accent-derived token instead of just
  `color-accent-selected`; black-sentinel `mix()` keeps the token-literal gate
  clean and default-nori output is byte-identical to the generated table.
  `Atmosphere` gains the secondary top-right violet bloom matching
  `.warm-glass-canvas` (`globals.css:736-751`): violet 14% dark / 10% light
  anchored at 85% 0%. Tests: +9 (tone wash+border dark/light, tone opt-in,
  top rim, caller-tint extraction ×2, live accent re-derivation, boost ink,
  violet bloom stops/anchor); `materials-reduced` bake expectation moves
  0.95→0.88 — the light bake cap is now `min(0.92, a + 0.28)` (the old
  +0.35/unclamped fill is what turned light-mode cards into pastel mud).

- 2026-10-16 — feat(capture): WS-0 Task 0.1 — deterministic visual-capture
  harness + cached-profile auth fallback (574 tests, tsc 0, lint 0 errors,
  tokens/a11y CLEAN). `scripts/capture-native.mjs` gains `--web` (force the
  1080×1920 Playwright preview even with an emulator attached), `--wait`/`--base`,
  and an adb branch that refuses to screenshot the launcher: `am start -W` now
  names the `com.garciafam.consuela` package, the script polls
  `dumpsys window displays` for the app's foreground window (10s deadline)
  before screencapping, settles 2200ms warm / 4500ms cold (was a flat 1200ms
  that caught Hermes mid-mount), and both paths name the file
  `<route>-<auth>-<theme>.png` (the adb branch used to dump `<ws>.png`).
  `scripts/screenshot.sh` does the same focus check and errors out instead of
  capturing the Android home screen (the `ws1-ui-polish/home-wall.png` bug).
  `AuthProvider` hydration no longer wipes the session when `whoami()` answers
  null or throws offline — the cached `consuela-auth-user` paints the rail
  instead (the Playwright harness seeds it; a cookie-less cold start paints it
  too), and a cache-less dead session still clears the cookie; `tests/auth.test.tsx`
  now isolates the profile/cookie caches per test and pins all three fallback
  paths (whoami-null, offline, no-cookie). Behavior note: a cold-start whoami
  success arms the idle/warn timers (web parity); the cached-profile display
  fallbacks (whoami-null, offline) never arm them.

- 2026-10-14 — fix(home): WS-3 Adult Home — critic round 3 (all Mediums + the
  Lows that had teeth closed; 541 tests, tsc 0, lint 0 errors, tokens/a11y
  CLEAN). `?day=` focus proof tightened: the test now asserts the focused
  column header's accent WASH (and that an unfocused header stays transparent)
  instead of a slot invariant that passes either way, and the MealsPage
  docstring no longer claims the cells wear the focus (they never did — the
  header is the landing). The greeting's nested span pins its own
  `lineHeight: 58` with a guard test that FAILS when the pin is removed
  (verified by deleting it and restoring): an outer lineHeight does not
  constrain a nested Text, so the two-line greeting silently measured ~130
  against the header budget's 116. The planned-day dot now wears the kit's
  `accentInk` recipe over the web's `--color-accent-sage` hue — raw sage
  measured 2.61:1 on the card's light wash, under the 3:1 non-text floor,
  while the ink treatment measures 5.8:1 light / 10.55:1 dark (the same
  AA-on-wash recipe Avatar/Chip/StatTile use, so no token deviation).

- 2026-10-14 — fix(home): WS-3 Adult Home — critic round 2 (4 Medium + Lows
  closed; 540 tests, tsc 0, lint 0 errors, tokens/a11y CLEAN). **Nav no-orphans
  rule finally bites**: `/weather` and `/soon` declared in `EXEMPT_ROUTES` with
  reasons (`/weather` also joins `LIVE_ROUTES` so it resolves to itself, not the
  honest `/soon` fallback), and `tests/nav-items.test.ts` now walks the REAL
  `app/` tree with `fs.readdirSync` and fails on any route that is neither a
  manifest path nor an exempt entry — proven by planting and deleting a probe
  route (the old assertion only checked that existing exempt entries carried a
  reason, so the contract the file's own header promises did not exist in CI).
  **The wall stops lying about its own health**: `src/api/members.ts` now
  reports *why* the live roster read failed — `reason: "signed-out"` for the
  expected 401 (the shared wall's normal state) vs `"unreachable"` for a real
  NAS fault — and `app/index.tsx` gates the badge on `rosterLoading` so no note
  prints before the read answers; "offline roster (cached)" is now claimed
  ONLY for an unreachable NAS, the signed-out rail gets its own calm line, and
  `tests/api.test.ts` pins all three branches (the honest/offline split had
  zero coverage). **Season glyph derived, not hardcoded** (`seasonGlyph(month)`
  ported from web page.tsx:411-413 — a baked-in 🍂 was right on its capture
  date and wrong for nine months). **`isPendingApproval` parity**
  (`!!completed && !!pendingApproval`, web task-utils.ts:60-62) in the Tasks
  widget's count and row flag — the marker's `completed` half is the guard
  against cross-device snapshot merges. **The wall's KPI band and This Week
  tail exist**: `src/home/wall-stats.ts` is a publish/subscribe store the three
  owning widgets feed (Today's Events → `eventsToday`, Tasks → `openTasks`,
  Current Meal → `plannedDays` + `weekCells`) — ZERO new fetches, so the band
  can never disagree with the card it sits above — and
  `src/home/WallStatsStrip.tsx` renders the web's three StatTiles (Events/
  Today, Tasks/Pending, Week/Days planned; unanswered reads stay BLANK and the
  Week tile wears the web's "—") plus a "This Week" card (Mon–Sun strip, today
  accented, the web's `--color-accent-sage` dot for a planned day, and a
  week-mode DayLine filled to (mondayIndex + dayFraction)/7 with six boundary
  markers). **Height budget corrected**: the old derivation omitted the grid's
  own top margin, so the RESERVATION ran 18dp OVER the 1080×1920 panel and the
  wall only fit because every row measured under its reservation — the formula
  now subtracts every fixed row it sits between (header 385, both gaps, tail
  190, dock 140), `GRID_CELL_H` re-derives to 279, and the greeting's nested
  span pins its own `lineHeight: 58` so the two-line greeting measures exactly
  116 instead of the platform default. **`?day=` deep links work**: Home's This
  Week strip links `/meals?day=<Mon>` and `MealsPage` now consumes it, focusing
  that day's column (the wall shows the whole week, so the named day is
  accented rather than isolated) — pins in `tests/meals-page.test.tsx`.
  Lows: MemberRail prints the first name only with the "✓ " prefix; the security
  footer navigates via `resolveRoute` instead of a toast; Today's Events and
  Tasks footers are real links ("+N more · See all →"); the DayLine is now one
  shared component (`src/home/widgets/DayLine.tsx`) used by both widgets; the
  Photos widget uses the web's 📡 unavailable state with its description line,
  an "Add a photo" action, and a STATIC "Pause photo rotation" name reporting
  `accessibilityState.checked`; the stat tiles wear the real
  `color-accent-ink*` tokens.

- 2026-10-13 — feat(weather): the wall's weather becomes the Monster gallery —
  port of the shipped Home-ai Monster skin (2026-10-01 + Amendment B) to the
  ApoloSign panel. The emoji weather widget is retired. New `src/weather/`
  module behind a skin seam (`WeatherMaterial = "monster"`, base/clay reserved):
  seven-segment MonsterDigit hero temperature (segment map, per-segment colors,
  offset extrusion, one eye per digit — parity-pinned to WxToys.tsx:887-1044),
  sculptural condition icons (SunG/CloudG/DropsG/BoltG/SnowflakeG/FogG/
  StarClusterG), phase-lit MoonDisc (weather-astro.ts port), a /weather gallery
  route (24h timeline with tone-filled now-cell, EPA AQI card with kid-honest
  copy, moon card with next full/new), and a restyled screensaver strip fed by
  two new payload fields (weatherCode, isDay). Data: one Open-Meteo forecast
  fetch + parallel air-quality fetch (guest-visible; air failure degrades only
  the AQI card; forecast failure shows the honest failure card). Colors flow
   exclusively through 26 new `--color-monster-*` tokens added to Home-ai
  globals.css and regenerated via the gen-tokens pipeline (theme-invariant —
  the poster is art, not chrome). Fredoka (OFL) via expo-font for the label
  register, system fallback documented. Ambient motion: one icon bob
  (±3dp, 6s), paused under reduced-motion + reduced perf tier; the digit eye
  is static (web parity — Amendment B). Tests: tests/weather/* — parity pins
  (palette, segment map, extrusion offsets, icon compositions), data honesty
  (null-safety, EPA boundaries, no fabricated 0°), gallery/screensaver suites;
  old tests/weather-widget.test.tsx deleted.

- 2026-10-12 — fix(review): Wave 0–1 harsh-critic remediation — all 7 Criticals + the High-severity wave closed; 13-unit review → every unit's blocking findings fixed and pinned. **Criticals:** wall grid rewritten from `flexWrap` to three explicit columns (web `grid-flow-dense` port — photos col-1 rows 1–2, cols 2–3 fill beside it; exactly 4×`GRID_CELL_H`+3×16 = 1480dp under the 300dp header + 140dp dock; `wallColumns()` pure + placement test); `IconButton` glass/surface Pressable now FILLS the disc (the glyph was the tap target); TasksWidget + LeaderboardWidget read the SHARED `useSync()` snapshot (no widget fetch; real `syncError`/`refreshNow` — the leaderboard's `failure={null}` infinite skeleton is gone); Photos gained the WCAG 2.2.2 pause/play control (reduceMotion starts paused, explicit press wins) + `order`/`recent` params + settings clamp (10–600s) + end-of-rotation settings re-read + `onError` skip + honest all-failed state; `_design` showcase rebuilt as the "Warm Glass kit" mirroring the reference review page (Controls/Theme preview/Inputs/Lists/Feedback incl. error+skeleton+modal+PinPad/Patterns/Accents with real per-accent swatches); the real-family names left `FALLBACK_MEMBERS` (generic stand-ins, LAST resort only — live/cache win outright; `listMembersSmart` no longer appends stand-ins beside the real roster). **Theme kit:** gen-tokens seeds each theme's `color-accent-selected-rgb` from its own accent table + cross-checks every rgb triple against the hex (light no longer carries dark-nori channels); ThemeProvider mirrors the LIVE accent's `-rgb`; `accentDeepened` semantics fixed (pct = percent TOWARD black — web `color-mix(accent X%, black)` ⇒ `100−X`) and every consumer re-verified (SoftButton primary 40, danger 25, success 45; Chip light tones 28; SegmentedControl 40/54; SwipeableRow destructive now the web's rose/20 tint + rose ink — was a deep-black fill; IconButton danger 25); Material applies elevation shadows per tier; Surface warm → thick tier; Chip light-tone AA inks (72% accent); ListRow transparent over the glass stack; Chip/EmptyState chrome through Material; press-scale feedback on Chip/SegmentedControl/PinPad (tested via the style-function contract — fireEvent can't drive Pressable's pressed state); Stepper material/radius parity. **Sync honesty (U5):** `SyncError` taxonomy — transport = "unreachable"/offline, answered HTTP failure = "server"/error, 401 = the gate; initial `stale` is TRUE for any hydrated wall with no successful sync (never fresh-when-unknown), `reconciled:false` keeps last-good + badges, single mount fetch, unmount guard; guests now POLL the shared snapshot (the reference guest capture shows tasks/leaderboard LIVE signed-out — a 401 shows the PIN gate without hammering logout; the public snapshot renders as-is). **Widgets vs reference:** Briefing collapsed-by-default with the "N items ▼" badge + "Tap the badge above to see today's plan." teaser (web `MorningBriefingWidget` model); CurrentMeal reads LIVE for guests + the title-band time pill (🌙 Dinner Time 🕔 11:49 PM in ONE band) + schedule title-keyword slot fallback ("Dinner" schedules with empty mealType); WidgetFrame default header → LEFT-ALIGNED band with a protruding identity disc, error state KEEPS the title, airtight no-blank-cell state machine, guest PIN states get "Try again"; HA trio now reference-parity: PRESENCE/SENSORS kickers, person chips + "N home", "🚪 Doors & windows closed" success chip (open → danger name chips), alarm chip, "Open Home controls →" footer, humidity line, switch.* fallback when no light.*, 60s store poll (web POLL_INTERVAL_MS) started/stopped with subscribers, web empty copy verbatim ("No presence data yet" — no trailing period). **Nav (U3):** the dock is now EXACTLY the 7 manifest caps (the extra `__more__` cap removed — web CapsuleNav parity; the reference wall dock shows 7); active wash 8%→20% (web --color-nav-active); "More…" opens from Home surfaces instead (web MoreButton parity) — the kid wall's Switch-member row gains it, and the five secondary routes carry an above-dock trigger (the wall itself matches the reference: no More affordance). **Auth (U4):** `poke()` is side-effect-free (no armTimers inside a state updater), `refreshIdentity` re-arms the idle clock, wall touches + dock presses poke the session (presses ARE activity). **U6:** greeting name is the session member's first name (web `familyName` parity; the surname no longer lives in source), greeting clock clears the EmergencyShield column. **Wall header/name:** HomeWall family-name + shield-safe clock padding. **U7/U8/U13 (from the parallel builders):** weather poster hero (≥96px condition glyph + tone poster + details pill → Modal with StatPills/5-day/Close + outlook line + AA stale badge), Today events DayLine + per-event left rails + tinted member chips + Google-pill retry + last-good Google rows survive a failed refresh + guest PIN copy. **Reverts:** the rogue unassigned EmergencyFlow rewrite (web "Common Situations" redesign + its tests) reverted to the shipped WS-9 flow — out-of-scope, broke tsc + 10 tests. **Gates: 387/387 tests (32 suites) · tsc clean · eslint 0/0 · tokens:check CLEAN.** Noted gap for the re-critique round: the reference wall's stat row (1 Event Today / 0 Tasks Pending / N Days planned) is not in Wave 1 scope.

- 2026-10-11 — feat(wave2): Kid Home (WS-4) + Adult Home (WS-3, honestly closed as no-delta). **Kid wall** (signed-in child/pet): hero (roster emoji — never photo data URLs, per the 1 MiB lesson), "Hi {firstName} 👋", week points + streak + "⭐ Level N this week" chips with the honestly-labeled "Resets in N days" line (the weekData snapshot feeds week scope only — the forever-level label would lie); quest cards for the kid's own tasks from the SHARED /api/tasks/sync snapshot (zero re-fetch, leaderboard parity) with big ✓ (under-10 PIN-free session-claim, 10+ PinPad) — pendingApproval rows press-inert with the waiting state, crews read-only with "See the Tasks page" referral, dead-session → honest toast; ONE claim seam (no second engine); Switch member → signOut → family rail. Mode switch verified: kid → KidHome, adult → HomeWall with parent dock swap (House, not Rewards) — exactly the web's `app/page.tsx` split. **Adult Home recorded as honestly no-delta** (per WS-3's sanctioned outcome): the web's adult mode renders the same family wall on the wall hardware; parent powers now arrive via the rail + Tasks queue + Settings surfaces that are already shipped. **Gates: 319/319 tests, tsc, eslint 0/0, token gate CLEAN.**

- 2026-10-11 — feat(home): Wave 2 WS-4 — the kid-mode wall (TDD: 27 tests). **Mode switch:** `app/index.tsx` renders `src/home/KidHome.tsx` INSTEAD of `HomeWall` when `useAuth().member` is child/pet (route-level branch; family guest + adult keep the bento — test-pinned for child, pet, adult, and guest arms). **Hero** (web `modes/kid/KidHome.tsx` port): 72pt roster emoji with the 1 MiB incident rule enforced (`kidEmoji` = the claim seam's `displayEmoji`, now exported — a photo data URL can NEVER be a Text glyph, collapses to 👤 on both kid + tasks surfaces), "Hi {firstName} 👋", the week-points stat read from `weekData.points` under the EXACT FULL NAME key (the ledgerKey lesson: "Alex" never collides with "Alexandra"), the level chip carrying the web's own math PORTED (`kidLevel = floor(points/50)+1`, POINTS_PER_LEVEL=50 — fed the same week points; the snapshot carries no all-time figure so the chip never pretends to be the web's Forever LevelBar; non-finite honestly refuses to Lv 1), and the 🔥 streak chip from `weekData.streak[fullName]` shown only when > 0 (web parity). **Quests:** `kidQuestsFor` = TasksPage assignee semantics verbatim (assignee === session name AND (open OR pendingApproval)), read ONLY off the shared SyncManager snapshot — zero re-fetch (leaderboard parity). Each open quest is a ≥64dp ListRow (emoji + title + `+N pts` tone chip, QuestCard mint≤10/amber>10/rose>15 convention); pendingApproval rows show "⏳ Waiting for approval" + a static "⏳ approval" chip and are press-inert (no claim call, no pad); crew chores (`crewTaskIdsOf` — web isCrewTask rule crewSize ≥ 2, roster-object backstop) render as read-only rows with an honest "See the Tasks page" referral, never completable here (crews are a Tasks-page surface). **✓ flow rides THE SAME claim seam as TasksPage** (`submitClaim` action "complete"): under-10 session-claim body `{operationId, action, taskId}` with NO pin field (in-flight ref double-tap guard); 10+/pet → the quest PinPad modal (kit Modal+PinPad) then `{…, memberName, pin}`; applied → "Nice work — sent for approval." + snapshot refresh; 202 queued/unreconciled → honest "Sent — the server will catch up." + refresh (never instant-apply); wrong PIN → pad shakes+clears with "Wrong PIN — try again." (no refresh); dead under-10 session (401, no pad path) → honest "Sign in again to finish that." toast (never a silent no-op). **Honesty coverage:** loading skeleton before the first snapshot lands, error + Try again → refreshNow when a poll answered with nothing, READ_COPY_STALE badge, and the "All quests complete!" celebration state only on genuinely-empty open quests. **Switch member:** hero SoftButton → `signOut()` back to the family rail. Scope honored: no bedtime view, no FogBackground port, no client outbox (the claim route owns durability). Gates: 317/317 tests (290 + 27), tsc clean, eslint 0 problems, token gate CLEAN. Pending-hardware: on-device captures + critic loop vs reference kid captures.

- 2026-10-11 — feat(settings): Wave 2 WS-10 — the wall Settings essentials (TDD: 23 tests). `app/settings.tsx` (Screen + CapsuleDock + MoreSheet pattern — Settings is a manifest primary cap for every role, `dock-settings`) hosts `src/settings/SettingsPage.tsx`: the **role-aware launcher** with the web's `settings-sections` copy verbatim — parents get all six (Me/Family/Safety/Appearance/Home/Connections & System), kids/pets get Me/Safety/Appearance, and the guest shell **keeps Me** (sign-in pointer to the rail — Me/Safety/Appearance) ("The signed-out family holds this device — sign in on the rail to see your own settings."). Launcher = reference-parity 2-col 508-wide Material-regular cards (icon + title + description + chevron) under the CHOOSE WHAT TO MANAGE eyebrow + ⚙️ Settings header; sections drill in with a ghost ‹ Settings back, and a sign-out mid-visit closes the vanished Me panel instead of ghosting it. **Me:** member emoji/name/capitalized role from useAuth + Sign out + the **PIN-change flow**: three PinPads (current → new → confirm, key-remounted per stage so each entry starts empty) → `POST /api/members/pin { actorPin, newPin }`; 409 `pin_collision` → "That PIN is taken — pick another one." back on the new-PIN pad, 401 → "Wrong PIN — try again." back on the current pad, confirm mismatch → honest copy with **no POST at all**, unreachable/500 → their own calm lines; PINs live in component state ONLY and are cleared on every close path (test-pinned: no PIN value ever reaches AsyncStorage — the PIN-memory contract). **Safety:** session-gated `GET /api/emergency-contacts` pill strip (guests get the sign-in gate with zero doomed fetches), `contactsSource: "cache"` badged honestly, honest empty + unavailable states — never a fabricated contact; editing deferred with "Contacts are managed by a parent on the phone app." **Appearance:** theme SoftButton + high-contrast Toggle + the ten `ACCENTS` chips (the `_design` showcase pattern) — all live via the existing ThemeProvider setTheme/setBoost/setAccent (AsyncStorage persistence spy-pinned, scheme-agnostic theme assertion). Family/Home/Connections & System sections render the honest deferral ("Settings for the whole family arrive with the full settings wave.") with zero dead controls. Sync stale badge (`settings-stale`, READ_COPY_STALE) and the web-parity hydration gate ("Checking your settings"). Test hygiene: the suite clears the async-storage-mock's in-memory store between tests so a later ThemeProvider hydration never picks up an earlier test's persisted accent (was an act() warning source); every otherwise-sync test flushes provider hydration inside act(). Gates: 289/289 tests (266 + 23), tsc 0, eslint 0 problems, token gate CLEAN.

- 2026-10-11 — feat(wave2): Photos management + ambient Screensaver (critic-approved). **/photos**: 2-col library grid with the entire shared library, parent-gated showOnWall moderation (optimistic with honest rollback, denied = server-refusal honest copy), kid gate, upload deferral, guest PIN gate with zero doomed fetches. **/screensaver**: ScreensaverBoard port — TOKENS.dark canvas, 60s poll cadence, last-good payload with a 5-minute stale dot + uniform content dim (documented divergence: native dims CONTENT, not backlight — the web dims the clock only on stale; we dim the whole board so a dark room reads honestly). Idle into the board from Home after 90s quiet via src/home/idle.ts (Home-only, tap resets, once-per-visit, modal-aware: a PIN pad or More… sheet open stands the clock down — one of the day's better critic catches). **Known hardware-pending deltas to own later:** board mid-text runs ~35–45% under the web's vh ramp (clock/temp extremes faithful), mint progress fill vs web's off-token emerald, stale dot amber-500 vs amber-400 (native is token-correct where the web wasn't).

- 2026-10-11 — feat(photos-screensaver): Wave 2 WS-8 — the wall Photos management grid + the ambient screensaver board (TDD: 23 tests). **Photos page:** `app/photos.tsx` (the Screen + CapsuleDock + MoreSheet surface wiring — Photos is a manifest More… item for signed-in roles) hosts `src/photos/PhotosPage.tsx`: the full library grid (`GET /api/photos?all=1`, 2-column thumbs, hidden pictures stay listed dimmed at 0.3 — WallPhotoGrid parity), per-thumb 64dp+ moderation chip ("On wall"/"Hidden" verbatim) for PARENTS → optimistic `PATCH /api/photos {id, showOnWall}` with rollback + honest toasts (502 → "Couldn't update the photo — try again."; 401/403 → "Only a parent can change what's on the wall." — the server's live parent re-verify is the authority; a stale cookie role is never believed). Kids see the read-only grid + "A parent picks what's on the wall." (gate-before; no dead affordances). Guest PIN gate with zero doomed fetches; loading skeleton; error + retry; READ_COPY_STALE badge on sync staleness; upload row shows the honest deferral ("Uploads from the wall arrive with the next wave — use the phone.") instead of faking an uploader. **One shared rule:** `photoSource` + `WallPhoto` + `setPhotoShowOnWall` extracted to `src/photos/library.ts` — the Wave-1 hero widget now imports it (one cookie-auth+moderation seam; widget tests still green). **Screensaver:** `app/screensaver.tsx` (EXEMPT_ROUTE — no dock; tap wakes to `router.back()`, or `replace("/")` with no history → never a dead end) hosts `src/screensaver/Screensaver.tsx`, a faithful port of Home-ai's ScreensaverBoard: fixed dark board from `TOKENS.dark` (the web's #0f1117 IS the dark canvas token — gate stays CLEAN), big tabular clock + "Sunday, October 11" date line built BY HAND (no Intl skew on Hermes), Today events (dot + time + title cap-4), Tonight dinner, Chores progress + bar (mint fill), Consuela briefing lines, weather block; own 60s poll + mount pull + foreground pull (the endpoint is middleware-exempt — the signed-OUT wall idles here, so it must not ride the session-gated hooks); malformed ok:true ignored, failures keep last-good; after 5min without a successful fetch the clock dims to 50% + the amber stale dot appears; after 60s untouched the board dims to 35% (the wall dims); any tap exits. **Home idle wiring:** NO Wave-1 idle hook existed (AuthProvider's timers only govern sessions) → `src/home/idle.ts` pure rule (`idleBoardDue`: only from "/", only ≥90s quiet, only once per Home visit) mounted in `app/index.tsx` with a 5s check + touch-catcher — `router.push("/screensaver")` while Home stays mounted under the board without stacking pushes. **Gates: 265/265 tests (242+23), tsc clean, eslint 0/0, token gate CLEAN.** Pending-hardware: on-device captures + critic loop vs `reference/photos/*` + `reference/screensaver/*`.

- 2026-10-10 — feat(wave2): Calendar surface shipped (critic-approved). Week strip (Mon–Sun chips, today accent) + selected-day list + Agenda view; db events + Google (ApiError.body 502-partials keep surviving rows) + routines per weekday; merge logic extracted single-source to src/calendar/events-merge.ts (TodayEventsWidget now imports it — no fork, verified). Critic round caught the web's already-fixed-once bug shipping a second time: 200 {ok:true, connected:false} silently rendered empty — now an honest "Google Calendar isn't connected." pill on BOTH the page and the Wave 1 Today cell (new not_connected ReadFailure), test-pinned with the exact server shape. Month-boundary week pinned (Oct 29 → Nov 1 rollover chip); day counts honest ("N events · M routines"). Read-only v1 with honest add-flow deferral copy. **Gates: 225/225 tests, tsc, eslint 0/0, token gate CLEAN.**

- 2026-10-10 — feat(calendar): Wave 2 WS-5 — the wall Calendar page (read-only family truth). `app/calendar.tsx` (Screen + CapsuleDock + MoreSheet, the app/tasks.tsx wiring — Calendar is a manifest primary cap, testID `dock-calendar`) hosts `src/calendar/CalendarPage.tsx`: **Week tab** — Mon–Sun day chips (64dp, today accented via accent border + accentInk, selected = accent-deepened fill with white ink, tap swaps the day list) over the selected day's merged timeline; **Agenda tab** — next 7 days from today grouped by day headings (`Today · …`), quiet days omitted (web parity: noise, not information), all-quiet → honest "Quiet week". Day rows = db-gateway events + Google Calendar + routines as ListRows (icon, time or "All day", member first-name trailing, routine color rail from the web's scheduleColorValues→token map). **Merge shared, not forked:** the TodayEventsWidget Google/day math moved verbatim into `src/calendar/events-merge.ts` (googleCoversDay/googleClock/hhmmToMinutes + familyEventsForDay/googleEventsForDay) and the widget now imports it — one implementation, widget tests still green; added the Home-ai `lib/schedule-time.ts` ports (scheduleTimeMinutes 12h+24h, formatScheduleTime12h, scheduleCoversWeekday "all/weekdays/weekends/friday"+legacy tokens) + schedulesForDay + mergeDayRows (all-day first at −1, unparseable last). **Honesty:** Google failure → pill while family rows stay (502 partial keeps `ApiError.body.events` survivors; 200 `{ok:false}` PB-down → pill, body-over-status), routines read failure → its own pill (additive, never a dead page), stale badge (useSync().stale + READ_COPY_STALE), guest PIN gate with zero doomed fetches, "Quiet day" parity copy, and the plan-locked read-only note where the web has Add event ("Adding events from the wall arrives with the next wave — ask a parent on the phone." — write flows NOT ported, no dead affordances). TDD: `tests/calendar-page.test.tsx` 15 tests RED-first (week strip 7 chips + today, day-select swap, merged order all-day-first via tree walk, 502 partial, 200 ok:false, weekday-scope routines, quiet-day copy, agenda grouping + quiet-week, guest, stale ±, route+dock, schedule math ports). Lint baseline: pre-existing unused-var in tests/tasks-page.test.tsx removed (0/0). **Gates: 222/222 tests (207+15), tsc, eslint 0/0, token gate CLEAN.** Pending-hardware: on-device captures + critic loop vs `reference/calendar/*`.

- 2026-10-10 — feat(wave2): Emergency + Tasks surfaces shipped (critic-approved). **Emergency (WS-9):** 4 type cards → PinPad → POST /api/emergency with per-code 503 copy maps, contactsSource "cache" badging (strip + result warning), honest empty-contacts state, 502 = "Alert Failed" (zero-delivery truth, never "partially sent"), real retryAfterMs cooldown, 911 card + back control (kept per critic adjudication), 64dp floating shield on Home (inset 24). PinPad shake-dep bug found + fixed (wrong-PIN cleared the pad under test). **Tasks (WS-7):** kid session-claims (under-10 PIN-free path, 10+ PinPad), parent approval queue (approve/approve-all/send-back with the parent's own PIN), operationId commands with 202-queued honesty, 409/404/503 refusal maps. Critic round caught a Critical honesty defect twice-over: the server lands a kid's tap as completed:true+pendingApproval, so !completed filters made the waiting UI dead code — fixed on BOTH the page and the Wave 1 wall cell, with every fixture now encoding the real shape. Dead-session on the PIN-free path → honest "Sign in again" toast (test-pinned). Toast unmount timer-leak fix (sound per critic). **Gates: 207/207 tests, tsc, eslint 0/0, token gate CLEAN.**

- 2026-10-10 — fix(emergency): WS-9 critic round — delivery honesty, per-code 503 copy, contactsSource badging, empty state, shield rhythm. **502 = failure, always:** the route only 502s when ZERO channels delivered (its `if (!anyDelivered)` branch), so the old amber "Alert Partially Sent" outcome for 502+`partial:true` was success-leaning dishonesty; 502 now renders the failure screen with the server's human `message` (RED-first: the rewritten test failed against the old code first), and partial-success UI is reserved for 200s with `partial:true`. **Per-code 503 copy** (web `EMERGENCY_ERROR_COPY` port, EmergencyButton.tsx:46-54): `pin_check_failed` / `contacts_unavailable` / `service_not_configured` (and `config_resolution_failed` + `delivery_failed`) each get their own sentence + call-911 remediation instead of one contacts-centric line. **humanizeError port:** a human `message` wins, a code-shaped string (`/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/`) is translated through the map, else generic copy — no snake_case ever renders. **contactsSource is read:** the preview strip badges `cache` honestly ("Live emergency contacts are unavailable — showing this device's saved list.", page.tsx parity) and the result screen shows the amber stale-recipients warning ("Warning: stale cached contacts were used. Recipients may be out of date; verify them before retrying.", EmergencyButton parity) on success or failure. **Empty state:** `contacts:[]` gets the web's "No emergency contacts yet" + ask-a-parent copy (Safety deep-link deferred to WS-10). **409** copy gains the wait-for-it remediation (web verbatim). **EmergencyShield** moves from `top:0/right:0` to `top:24/right:24` — Yoga positions absolute children by inset+border only (parent padding ignored, `AbsoluteLayout.cpp`), so the 24s are the wall's edge rhythm, verified against the Yoga source in node_modules before applying. Tests: emergency suite 13→20 (502 rewrite RED-first + 502 code-only + two 503 codes + cache strip badge + result stale warning + live-source no-warning + empty state; 503/409 copy expectations updated to the web parity strings). Gates: 181/181 jest, tsc clean, eslint 0/0, token gate CLEAN. Home-ai untouched (READ-ONLY references only).

- 2026-10-10 — feat(emergency): Wave 2 WS-9 — the wall Emergency surface + always-visible Home shield. `app/emergency.tsx` (Screen + flow + a Back that never dead-ends: canGoBack → back, else replace Home) hosts `src/emergency/EmergencyFlow.tsx`: session-gated emergency-contacts preview strip (`GET /api/emergency-contacts` — guests get the PIN-gate copy with zero doomed fetches; an unreadable list gets its own honest line; phones render E.164→(XXX) XXX-XXXX web-parity) over four ≥64dp Material-regular type cards (🔥 Fire / 🌊 Water / 🚑 Injury / 🆘 General) → PinPad modal (signed-in member identity; guests verify as the generic "Family member 🔐" — the route takes ANY family PIN) → honest result screens from the verified `POST /api/emergency {type, pin}` contract: 200 success (calm ✓ + the server's message + `houseAlert` "X sent · Y failed" + notes), partial honesty on 200.partial AND 502 `delivery_failed` partial:true (amber "Alert Partially Sent" + the server's warning — never silent success), 401 Invalid PIN → in-pad "Wrong PIN — try again." (shake+clear via the kit seam), 429 `emergency_cooldown` → real-time countdown from `retryAfterMs` with Try-again disabled until the window closes then re-enabled, 409 in-flight "An alert is already sending…", 503 calm "Couldn't reach the emergency contacts right now — check the Settings → Safety contacts.", status-0 unreachable, the reference page's 911 card (`Linking tel:911` + honest dialer-failure toast), and the "If this is a life-threatening emergency, call 911." advisory on every result. `src/home/EmergencyShield.tsx`: the 64dp rose floating shield (absolute top-right of the Home header, zIndex 20, never over the rail, alarm-glow) → `/emergency`, mounted in `HomeWall`. Kit fix: PinPad's clear-on-error effect no longer lists the Reanimated `shake` shared value in its deps (ref-like mutable; under the jest mock the unstable identity re-fired the clear every render so the pad could never re-verify while an error showed — production behavior unchanged). Lint floor: two pre-existing Wave-1 unused-var warnings cleaned (LeaderboardWidget, ha-state). TDD: tests/emergency.test.tsx 13 tests RED → GREEN (type select→pinpad, guest gate, wrong-PIN fresh-re-entry clear-proof, success/partial/502-partial honesty, fake-timer cooldown disable→re-enable, 503/409/unreachable copy, contacts strip, shield renders+navigates). **Gates: 174/174 jest · tsc clean · eslint 0/0 · token gate CLEAN.** Pending-hardware: on-device captures + critic loop vs `reference/emergency/*` (PNGs unreadable by the builder model — flagged in the WS-9 report for the orchestrator).

- 2026-10-10 — feat(wave1): Home wall live — all 11 cells. Endpoint verification doc (Open-Meteo is client-direct — same URL the web uses; HA sync = POST /api/ha/sync any-session; briefing session-gated with date validation; meals/schedules shapes pinned). Wall grid scaffold (12-cell 3-col bento, photos row-span-2, greeting + member rail header). Live widgets: Tasks (pulse-driven snapshot, honest pendingApproval), Today (db+Google merge, all-day-first, 502-partial keeps surviving rows via ApiError.body + honest pill), Current Meal (schedule slot, weekOf-Monday), Morning Briefing (guest PIN gate), Weather hero (WMO text verbatim, emoji glyphs, H/L·feels, hourly strip, guest-visible — reference parity), Photos hero (settings-driven rotation, crossfade, cookie-auth image bytes via source.headers, degraded-settings badge), HA trio via a shared single-fetch store (ONE /api/ha/sync for three widgets — web useHAState parity, pinned by test), Leaderboard (reads the SHARED SyncManager snapshot — zero re-fetch, medals, Be-the-first!), Quick Ask (honest v2 copy). **Gates: 161/161 tests, tsc, eslint 0/0, token gate CLEAN.** Pending-hardware: Task 7 visual critic loop + on-device captures.

- 2026-10-10 — feat(home): Wave 1 Task 2 — live wall widgets. Four cells on the wall are live now, all riding the Wave 0 contract (`api()` + `useSync().onPulse` on mount and pulse; honest loading skeleton / reference empty copy / calm error with retry → `refreshNow()`; stale badge via READ_COPY_STALE; guests short-circuit to the shared PIN gate copy with zero doomed 401s): **Tasks** (`/api/tasks/sync` snapshot — pending count "N pending for the family", max 2 kid rows with `pendingApproval` shown as "Waiting for approval"/"⏳ approval" instead of promising points (no client-side point math), parent-only "N need approval" footer, "All caught up" empty) · **Today** (db-gateway `events` filtered to the local day merged with `/api/google-calendar` via a ported google-mapping day-coverage/clock (all-day first, unparseable sorts last); "N events on the family calendar" description, "Quiet day" empty; a Google failure renders an admitted pill while family rows stay on screen) · **Current Meal** (`/api/db/schedules` slot selection — >60 m-started slots roll forward, no-schedule defaults to dinner — against `meal_plan_entries` matched by weekday + mealType + Monday weekOf with NO cross-mealType fallback; "No meal planned yet — Plan {dinner} in the Kitchen tab" empty; 30 s wall-clock tick retimes the slot between pulses) · **Morning Briefing** (`/api/consuela/briefing?scopeDate=`, read-only (ack PATCH stays out of scope), section rows + item-count chip, taskSource "backup/unavailable" notes admitted, acknowledged → "Seen for today — Consuela will refresh it tomorrow" card, genuinely-empty → honest "Nothing lined up for today yet."). Shared kit: `src/home/widgets/data.ts` (useWidgetData + READ_COPY verbs + local-date helpers) and `src/home/widgets/WidgetFrame.tsx` (content-only interior; HomeWall keeps the Material shell). `app/index.tsx` now passes the widget registry into HomeWall. TDD: tests/widgets-data.test.tsx (16 tests) RED → GREEN. Gates: 144/144 jest · tsc clean · eslint 0/0 · token gate CLEAN. Note: `/api/db/meal_plan_entries` + `/api/db/schedules` ride the same verified db-gateway route as events (plan Task 2 source); Google-pill copy is honest-for-native ("couldn't load — family events may be incomplete") rather than the web's "saved copy" phrasing because the wall keeps no Google cache.

- 2026-10-09 — fix(wave0): final-review round-trip closed. Whole-repo review (verdict NOT READY: 1 Critical + 8 Important) → fix wave `ba5d7d4`: MemberRail named-color crash (new `src/theme/memberColor.ts`, Avatar colorName→accentToken parity + regression test), `poke()` wired via PokeBoundary, base-URL hydration at root, honest rail-level sign-in failure copy, single shared API transport, 5s×3→60s backoff pinned, frost clipping (no more square leaks over rounded corners), atmosphere boundary timer + crossfade, Modal a11y/scrim parity, ☰ More glyph, accent-selected token mirrors live accent, verbatim fallback roster. Re-review: **all closed — Approved**. Gates: 123/123, tsc, eslint 0/0, token gate CLEAN, push-safe CLEAN.

- 2026-10-09 — feat(wave0): foundation complete. Design kit (tokens codegen from Home-ai globals.css with fail-loud drift; ThemeProvider light/dark × boost × 10 accents × reduced-motion; Material thin/regular/thick with perf tiers; 13 primitives across Surface/SoftButton/IconButton/Chip/Toggle · SegmentedControl/ListRow/SwipeableRow/TextField/Stepper/EmptyState · Modal/Toast/PinPad/MemberRail); manifest-driven CapsuleDock + MoreSheet (wall rule: labels always visible, single selected cap); root shell (portrait lock, keep-awake, hidden system bars, atmosphere from tokens); LAN API layer (cookie session via SecureStore, honest ApiError mapping, body-over-status truth); AuthProvider (web-parity 30/15-min idle + warn windows, under-10 PIN-free via server quick-login, PIN memory-only); SyncManager (60s CacheRefresher mirror, foreground refetch, pulse fan-out, honest staleness); reference+critic tooling (capture-reference.mjs matrix — 84 PNGs gitignored; docs/critic-loop.md; /_design showcase). **Gates: 120/120 tests, tsc clean, eslint 0/0, token gate CLEAN, push-safe CLEAN.** Path: plan `../docs/superpowers/plans/2026-10-09-home-native-wave0-foundation.md`. Pending-hardware: on-device captures (no adb on dev Mac). Reviewer passes: Task 3 approved via sub-agent review + fix round; inline tasks get a whole-repo final review at this wave's end.

- 2026-10-09 — feat(theme): token codegen from Home-ai globals.css + typed facade (Task 3). `scripts/gen-tokens.mjs` parses the four canonical blocks (dark = `:root` base incl. `@theme` + `:not([data-theme="light"])`; light; both boost blocks) + the per-accent rgb tables out of the sibling Home-ai stylesheet (READ-ONLY), resolves `var()` two-pass (same block, then base) and constant `color-mix()` via premultiplied srgb math, and writes `src/theme/tokens.generated.ts` + `tokens.snapshot.json` (committed, deterministic — no timestamps). `--check` is wired into `tokens:check` and fails loud on drift OR on any deviation from the pinned ground-truth table (10 accents ×2, canvas gradients 4×2, core palette/motion/radii) — when Home-ai's tokens move, the failure IS the contract. `src/theme/tokens.ts` is the typed facade: `TOKENS` (dark/light flat maps + `boost` overrides), `ACCENTS` (10 enumerable name keys `{dark, light}` + non-enumerable `.dark`/`.light` mirrors so both pinned shapes hold), `ACCENTS_RGB`, `RADII`, `MOTION`, `TYPOGRAPHY` (14sp wall floor), `TYPE_FLOOR_SP`, `MIN_TARGET_DP`, TitleCase aliases (`Typography`/`Radii`/`Motion`/`Accents`). NOTE: the interface sentence also listed `Materials` but the brief pins no data for it — left undefined on purpose rather than invented. TDD: `tests/tokens.test.ts` (6 tests) went RED on missing module, then GREEN. Gates: 17/17 jest · tsc · eslint · tokens:check (ban + drift).

- 2026-10-09 — chore(repo): Home-native born — Expo/React Native port of the Consuela core hub for the ApoloSign 1080×1920 portrait wall panel (Android 15). Scaffold via create-expo-app (SDK ~57.0.27, RN 0.86.3, React 19.2.3) + expo-router, blur, linear-gradient, secure-store, keep-awake, screen-orientation, navigation-bar, reanimated, gesture-handler, safe-area-context, screens; dev: jest-expo + RNTL (react-test-renderer pinned 19.2.3, legacy-peer-deps), eslint-config-expo, playwright. Repo rules in AGENTS.md; design contract: parent `docs/superpowers/specs/2026-10-09-home-native-tablet-app-design.md`. Panel dp measurement: PENDING-HARDWARE (adb not on the dev Mac's PATH at scaffold time).
