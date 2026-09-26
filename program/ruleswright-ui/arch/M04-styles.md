# M04 — styles (`src/renderer/src/styles/`)

**Status:** planned (SESSION-01 creates a minimal `tokens.css`; SESSION-02 completes). **Imports:** `@fontsource/*` CSS (fonts.css).

## Contents
- `tokens.css` — the `design.md` mood tables **verbatim** under `:root[data-mood="fantasy"|"urban"|"archive"]`; `--font-display/--font-reading/--font-ui/--font-mono`; radii `--radius-s/m/l`; spacing scale; motion durations; `archive` is also the `:root` default.
- `base.css` — reset, type scale (40·32·24·20·18·16·14·12·11·10), kickers, focus ring, `prefers-reduced-motion` → instant, ≤300 ms variable crossfade, atmosphere accents (fantasy candle radial, urban hazard stripe) as `color-mix` of `--accent`.
- `fonts.css` — `@fontsource` imports (Cinzel, Spectral, Oswald, Inter, JetBrains Mono); bundled locally by Vite (CSP `font-src 'self'`).

## Gate
- `tests/styles/contrast.test.ts` (SESSION-02) parses `tokens.css` and asserts WCAG AA pairs from `design.md` for every mood.

## Change history
- v1-shell plan: created (planned).


<!-- v1-shell SESSION-02 -->
## Realized — v1-shell SESSION-02

### M04 styles — realized (`f03f38d`, `6b9e658`)
- `tokens.css`: design.md mood tables verbatim. Selectors are `:root, [data-mood='archive']`, `[data-mood='fantasy']`, `[data-mood='urban']` (not `:root[...]`), so a subtree can preview another mood's tokens (ThemeCard swatches). Shared tokens on `:root`: `--font-ui`, `--font-mono`, `--radius-s/m/l`, `--space-1,2,3,4,6,8`, `--text-40…10`, `--dur-fast/event/mood`, `--content-max`.
- `base.css`: reset (`color-scheme: dark`), type-role classes `.display .reading .mono .kicker .dim .text-NN`, `:focus-visible` accent ring, `.section-head` (urban hazard stripe), fantasy candle glow on `body::before`, reduced-motion → 0s.
- `fonts.css`: Cinzel 600/700, Spectral 400 + 400-italic, Oswald 500/600, Inter 400/500/600/700, JetBrains Mono 400/500.
