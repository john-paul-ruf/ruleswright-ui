# M17 — tests (`tests/`, `e2e/`)

**Status:** planned. Each session owns only its own spec files; shared harness files are S01's.

## Harness (S01)
- `tests/support/in-process-bridge.ts` — `createInProcessBridge(rootDir): RuleswrightApi` built from the **real** `createIpcHandlers({storage: createStorage(rootDir), dialogs: fake})` (skips only Electron transport); `tests/support/tmp.ts` temp-dir helpers.
- `e2e/fixtures.ts` — Playwright fixture: `mkdtemp` userData → `_electron.launch({ args: [path.join(root,'out/main/index.js')], env: {...process.env, RULESWRIGHT_USER_DATA: dir} })`, `firstWindow()`, request recorder (FR-17), `restart()` (close + relaunch on same dir), `stubSaveDialog(app, path)` / `stubOpenDialog(app, path)` via `app.evaluate(({dialog}, p) => …)`, cleanup `rm -rf`.
- `e2e/global-setup.ts` — runs `pnpm build` (fresh `out/`) and writes `test-results/build-identity.json` `{head, dirty, porcelainSha256, builtAt}`.
- `tests/lint/boundary.test.ts` — ESLint API self-test of Custom Rules 1 & 3.

## Change history
- v1-shell plan: created (planned).
