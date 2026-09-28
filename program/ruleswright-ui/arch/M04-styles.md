# M04 — styles (`src/renderer/src/styles/`)

**Status:** realized (v1-shell S01 c1 scaffold `ca1d972`; S02 c1 `f03f38d`; fourth mood `wild` loot-inventory S03 c1 `5b5b84b`). **Imports:** `@fontsource/*` CSS via `fonts.css` (bundled locally by Vite — CSP `font-src 'self'`, FR-17).

## Contents (realized)
- `tokens.css` — the `design.md` mood tables **verbatim**, four moods. Selectors are `:root, [data-mood='archive']`, `[data-mood='fantasy']`, `[data-mood='urban']`, `[data-mood='wild']` (not `:root[...]`), so a subtree can preview another mood's tokens (ThemeCard swatches). `archive` is also the `:root` default. Shared tokens on `:root`: `--font-ui`, `--font-mono`, `--radius-s/m/l`, `--space-1,2,3,4,6,8`, `--text-40…10`, `--dur-fast/event/mood`, `--content-max` (1152px); `--font-display` / `--font-reading` live in the mood blocks. The `wild` block uses Spectral for both display and reading, and its 12 color tokens are copied from the design.md `wild` column (AUTHOR-DESIGN-LI `3069b23`).
- `base.css` — reset (`color-scheme: dark`), type-role classes `.display .reading .mono .kicker .dim .text-NN`, `:focus-visible` accent ring, `.section-head` (urban hazard stripe), per-mood atmosphere on `body::before` (fantasy candle glow as `color-mix` of `--accent`; wild "canopy light" = two `radial-gradient`s copied from the mock), `prefers-reduced-motion` → 0s (the ≤300 ms crossfade is CSS).
- `fonts.css` — `@fontsource` imports: Cinzel 600/700, Spectral 400 + 600 + 400-italic (600 added for `wild`; same package, no new dependency), Oswald 500/600, Inter 400/500/600/700, JetBrains Mono 400/500.

## Gate (realized)
- `tests/styles/contrast.test.ts` (M17) parses `tokens.css` and asserts the WCAG AA pairs from `design.md` for every mood in `MOODS` (four since loot-inventory; nine pairs ≥ 4.5:1 for `wild`), requires 12 non-empty tokens per mood (reads the design.md column per mood, failing if a mood column is missing or empty), plus the Custom Rule 6 negative controls and "no hex literals in ui/ and shell/".

## Change history
- v1-shell S01 c1 (`ca1d972`): minimal scaffold. S02 c1 (`f03f38d`) + c2 (`6b9e658`): three moods verbatim, type roles, focus ring, hazard stripe, candle glow, reduced motion, bundled faces.
- loot-inventory S03 c1 (`5b5b84b`): `wild` token block, canopy-light atmosphere, Spectral 600.
- combat-complete: no change (board/token CSS lives in M08 `ui.css` and the view CSS).
