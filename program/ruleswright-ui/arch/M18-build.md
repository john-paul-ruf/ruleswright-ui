# M18 — build (root config + `scripts/`)

**Status:** planned (SESSION-01 c1 installs **every** planned dependency, fonts included, so no later session owns root manifests).

- `package.json` — no `"type"`; `"pnpm": {"onlyBuiltDependencies": ["electron","esbuild"]}`; dependency `"ruleswright": "file:../Ruleswright"`; scripts per PROGRAM-CONFIG Verification Commands (guards chained explicitly — pnpm skips pre/post scripts).
- `scripts/check-engine.mjs` — fails loudly unless `../Ruleswright/dist/{compiler,runtime,schema}.js` exist, `node_modules/ruleswright/package.json` version equals `../Ruleswright/package.json` version, and the three dist files are byte-identical between sibling and installed copy (else: "run `pnpm build` in ../Ruleswright, then `pnpm install` here"). Accepts `--sibling <dir> --installed <dir>` overrides for its self-test `tests/scripts/check-engine.test.ts`.
- `electron.vite.config.ts`, `tsconfig.json` (solution) + `tsconfig.node.json` / `tsconfig.web.json` / `tsconfig.test.json`, `.eslintrc.cjs`, `vitest.config.ts`, `playwright.config.ts`, `electron-builder.yml` (dmg; nsis/AppImage configured, not gated).
- `.gitignore` — append `/out/` only; existing lines (incl. demiurge block) untouched.

A later session that genuinely needs a new dependency goes through Orchestrator's Controlled Lease Revision on `package.json` + `pnpm-lock.yaml` (never concurrently with another holder).

## Change history
- v1-shell plan: created (planned).
