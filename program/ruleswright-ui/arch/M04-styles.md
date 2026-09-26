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
