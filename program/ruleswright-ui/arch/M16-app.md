# M16 — app (`src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/env.d.ts`)

**Status:** planned (S01 minimal → S02 final wiring).

- `index.html` carries the CSP meta (effective for `file://` loads): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'` (dev adds the Vite origin only via electron-vite dev handling). No remote origins ever.
- `main.tsx` mounts `<App/>`, imports `styles/fonts.css`, `styles/tokens.css`, `styles/base.css`.
- `App.tsx` (S02): `<Shell/>` + startup (`useWorldsStore.getState().startup()`), `data-mood` default `archive`.

## Change history
- v1-shell plan: created (planned).
