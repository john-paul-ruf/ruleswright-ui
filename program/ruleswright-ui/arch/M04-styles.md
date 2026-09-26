# M04 — styles (`src/renderer/src/styles/`)

**Status:** realized (SESSION-01 c1 minimal `tokens.css` in `ca1d972`; SESSION-02 c1 completes `f03f38d`). **Imports:** `@fontsource/*` CSS via `fonts.css` (bundled locally by Vite — CSP `font-src 'self'`, FR-17).

## Contents (realized)
- `tokens.css` — the `design.md` mood tables **verbatim**. Selectors are `:root, [data-mood='archive']`, `[data-mood='fantasy']`, `[data-mood='urban']` (not `:root[...]`), so a subtree can preview another mood's tokens (ThemeCard swatches). `archive` is also the `:root` default. Shared tokens on `:root`: `--font-ui`, `--font-mono`, `--radius-s/m/l`, `--space-1,2,3,4,6,8`, `--text-40…10`, `--dur-fast/event/mood`, `--content-max` (1152px), `--content-max` `--content-max: 1152px`; `--font-display/--font-reading` live in the mood blocks.
- `base.css` — reset (`color-scheme: dark`), type-role classes `.display .reading .mono .kicker .dim .text-NN`, kickers, `:focus-visible` accent ring, `.section-head` (urban hazard stripe), fantasy candle glow on `body::before` as `color-mix` of `--accent`, `prefers-reduced-motion` → 0s (the ≤300 ms crossfade is CSS), instant under reduced motion.
- `fonts.css` — `@fontsource` imports: Cinzel 600/700, Spectral 400 + 400-italic, Oswald 500/600, Inter 400/500/600/700, JetBrains Mono 400/500; bundled locally by Vite.

## Gate (realized)
- `tests/styles/contrast.test.ts` (SESSION-02 c1, in M17's lease) parses `tokens.css` and asserts WCAG AA pairs from `design.md` for every mood (34 tests; lowest urban `danger/surface` ≈ 4.78), plus the Custom Rule 6 negative controls and "no hex literals in ui/ and shell/".

## Change history
- v1-shell plan: created (planned).
- SESSION-01 c1 (`ca1d972`): minimal `tokens.css` scaffold.
- SESSION-02 c1 (`f03f38d`) + c2 (`6b9e658`): realized — mood tables verbatim with bare `[data-mood]` selectors, type-role classes, focus ring, hazard stripe, candle glow, reduced-motion → 0s, bundled faces.