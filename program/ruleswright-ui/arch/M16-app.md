# M16 — app (`src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/env.d.ts`)

**Status:** realized (S01 minimal bootstrap `ca1d972`/`b9f3518`; S02 final wiring `ae1c762`). **Imports (mechanical, non-test):** `react`, `react-dom/client`, M10 (`./shell/Shell`), M09 (`./store/worlds`), and its own `./styles/*` CSS. `env.d.ts` (owned with M03) declares `window.ruleswright: RuleswrightApi`.

- `index.html` carries the CSP meta (effective for `file://` loads): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'` (dev adds the Vite origin only via electron-vite dev handling). No remote origins ever. `<html data-mood="archive">` is the default mood (main.tsx mounts `<App/>`, which renders `<Shell/>`; the `data-mood` applier in M05 sets it on the root).
- `main.tsx` mounts `<App/>` under `StrictMode`, imports `styles/fonts.css`, `styles/tokens.css`, `styles/base.css`.
- `App.tsx` (S02): `<Shell/>` + startup (`useWorldsStore.getState().startup()`), run once even under StrictMode's double effects (`hasStarted` guard), with the `data-mood` default `archive` carried by `index.html`.

## Change history
- v1-shell plan: created (planned; S01 minimal → S02 final wiring).
- SESSION-01 c4 (`b9f3518`): minimal `main.tsx`/`App.tsx` (no style imports yet).
- SESSION-02 c3 (`ae1c762`): realized — `main.tsx` imports `styles/fonts.css`, `tokens.css`, `base.css`; `App.tsx` renders `<Shell/>` + startup.