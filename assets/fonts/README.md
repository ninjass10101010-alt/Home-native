# Bundled typefaces

| File | Family | Weight | Provenance | License |
|---|---|---|---|---|
| `Fredoka.ttf` | Fredoka | 400/700 | Google Fonts | OFL-1.1 |
| `InstrumentSerif-Regular.ttf` | Instrument Serif | 400 | Google Fonts (`fonts.googleapis.com/css2?family=Instrument+Serif`, latin subset, TrueType face) | OFL-1.1 |

Both are loaded in `app/_layout.tsx` via `expo-font`'s `useFonts`.

`Instrument Serif` is the web's `--font-display` (Home-ai
`src/app/layout.tsx:28-33`, weight 400). It is bundled rather than falling back
to the generic `"serif"` family because the review set is set in Instrument:
the page masthead (`.text-display`), the home greeting and the weather/editorial
registers all assume its shapes, and the generic fallback resolves to a
different face per platform.

Redistribute under the SIL Open Font License 1.1 (the license both families ship
with — see the upstream repositories for the full text).
