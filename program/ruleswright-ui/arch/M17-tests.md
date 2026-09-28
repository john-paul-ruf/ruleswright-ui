# M17 — tests (`tests/`, `e2e/`)

**Status:** realized (S01 harness `ca1d972`/`b9f3518`; surface specs land with their owning sessions). Each session owns only its own spec files; shared harness files are S01's. Module edges realized at S01: M02→M01, M03→M01, M06→M01 (errors/schema), M07→M01, M09→M06/M07/M01, M11→M09/M06(types)/M01(types), M16→M09/M11.

## Harness (S01, realized)
- `tests/support/in-process-bridge.ts` — `createInProcessBridge(root, dialogs?): RuleswrightApi` built from the **real** `createIpcHandlers({storage: createStorage(root), dialogs: fake})` (skips only the Electron transport); payloads and results structured-cloned like IPC. Also exports `createFakeDialogs() / FakeDialogs` (`savePath`, `openPath`, `saveRequests`). `tests/support/tmp.ts` temp-dir helpers.
- `tests/support/eslint.d.ts` — minimal ambient types for `eslint@8` (no `@types/eslint` dependency).
- `e2e/fixtures.ts` — Playwright fixture: `mkdtemp` userData → `_electron.launch({args: [path.join(root,'out/main/index.js')], env: {...process.env, RULESWRIGHT_USER_DATA: dir}})` with `ELECTRON_RENDERER_URL` stripped so the built renderer is always exercised (H-2: needs a GUI session; report e2e as not run when no display is available); `firstWindow()`, request recorder (FR-17), `restart()` (close + relaunch on same dir), `stubSaveDialog(path|null)` / `stubOpenDialog(path|null)` via `app.evaluate(({dialog}, p) => …)`; fixture `rw: RulesWrightApp {app, page, userData, requests, restart(), stubSaveDialog, stubOpenDialog}`; re-exports `expect`; cleanup `rmSync`.
- `e2e/global-setup.ts` — runs `pnpm build` (fresh `out/`) and writes `test-results/build-identity.json` `{head, dirty, porcelainSha256, builtAt}`.
- `tests/lint/boundary.test.ts` — ESLint API self-test of Custom Rules 1 & 3 (rejects runtime and type-only `ruleswright` imports outside `engine/`, rejects `Math.random` in a view, rejects `Date.now` inside `engine/`, rejects `eval`/`new Function` everywhere; allows the same imports inside `engine/`).

## Per-session specs (as landed)
- S01: `tests/{support,main,lint,scripts}/**`, `tests/engine/{errors,compiler,schema}.test.ts`, `tests/store/worlds.test.ts`, `e2e/{fixtures,global-setup}.ts`, `e2e/journey.spec.ts` (CAP-01).
- S02: `tests/{styles,moods}/**` (contrast gate 34 tests; `moodForTheme` 9 unit tests), `e2e/shell.spec.ts` (CAP-04).
- S03: `tests/store/worlds-manage.test.ts` (CAP-03 store path), `e2e/roll.spec.ts` (CAP-02/CAP-03; r2 added one navigation click each to `shell.spec.ts`/`journey.spec.ts`, no assertion change).
- S04: `tests/engine/determinism.test.ts`, `tests/store/determinism.test.ts`, `e2e/world.spec.ts` (CAP-05/CAP-06 + export).
- S05: `tests/engine/runtime.test.ts`, `tests/store/character.test.ts`, `e2e/character.spec.ts` (CAP-07/CAP-08/CA-06 proof owner).
- S06: `tests/engine/{combat,replay}.test.ts`, `tests/store/combat.test.ts`, `tests/main/{storage,ipc}.test.ts` (B-2 additions), `e2e/{combat,replay}.spec.ts` (CAP-09/CAP-10; `RW_SHOTS_DIR` env opt-in for screenshots).

## Final gate (Orchestrator-run, `98a14e3`, `pnpm verify` exit 0)
- check:engine `engine ok: ruleswright@0.1.0`; typecheck 0; lint 0.
- vitest: 18 files / 178 tests passed.
- Playwright e2e: 17/17 passed (journey, shell ×2, roll ×4, world ×4, character ×2, combat ×3, replay ×1).
- Build identity: head `98a14e3e444f538be3f11fb6831b558eb40c8ed4`, dirty false, porcelainSha256 `e3b0c442…` (empty tree diff).

## Change history
- v1-shell plan: created (planned).
- SESSION-01 c1/c4: realized (bridge, dialogs fake, ambient eslint types, fixtures, global setup, boundary self-test, journey).
- SESSION-02 c1: contrast gate + moods tests.
- SESSION-03 c1/c3: worlds-manage tests + roll.spec.
- SESSION-04 c1/c3: determinism unit + e2e + world.spec.
- SESSION-05 c1/c4: runtime.test + character.test + character.spec.
- SESSION-06 c0–c5: combat/replay units, storage/ipc B-2 tests, combat.spec + replay.spec (RNG words step 2).

<!-- loot-inventory SESSION-02 -->
### loot-inventory SESSION-02 delta — M17 tests
- `e2e/inventory.spec.ts` (CAP-02 journey); inventory cases added to `tests/engine/runtime.test.ts` and `tests/store/character.test.ts`.

### loot-inventory SESSION-02 delta — New test ids
`char-inventory`, `char-inventory-empty`, `char-item-<id>`, `char-item-qty-<id>`, `char-drop-amount-<id>`, `char-drop-<id>`, `char-grant-item`, `char-grant-qty`, `char-grant`, `char-loot-table`, `char-loot-seed`, `char-loot-seed-randomize`, `char-loot`, `char-loot-empty`, `char-inventory-error`, `char-inventory-event-<n>`.

<!-- loot-inventory SESSION-03 -->
### loot-inventory SESSION-03 delta — fourth mood `wild`
- **M17 tests**: `contrast.test.ts` `MOODS` gains `'wild'`. `designTable()` reads the 5th column (after archive). The gate asserts 12 non-empty tokens per mood.


<!-- combat-complete SESSION-02 --> M17
### combat-complete SESSION-02 delta — M17 tests — `e2e/combat.spec.ts`, `e2e/replay.spec.ts`
- The reference fights take the positions read from `fight-place-<id>` before Begin.
- New e2e tests: "CAP-06: grid fight …", "theater-of-mind: …" (combat.spec) and "CAP-06 / CA-14: … recorded, then replays complete after a restart" (replay.spec).


<!-- combat-complete SESSION-03 --> M17
### combat-complete SESSION-03 delta — M17 tests — new test ids
- `combat-order` (panel), `combat-order-<id>` (row, `data-active` true/false), `combat-order-position`, `combat-initiative`,
  `combat-action-detail`, `combat-ledger-<id>` (chips `<slot> <remaining>/<grant>`), `combat-pools-<id>`,
  `combat-bound-<id>` (only when the library reports bound slots), `combat-conditions-<id>`, `combat-spatial-caption`.
- Unit: `tests/engine/combat.test.ts` describe 'slot grants and action detail (CA-02, CA-03)' (3 tests);
  `tests/store/combat.test.ts` describe 'initiative provenance (CAP-01, CA-01)' (1 test).
- e2e: `e2e/combat.spec.ts` test 'CAP-01/02: turn order, initiative, slot ledgers, conditions and action detail, in lockstep with the library'; theater test also asserts the caption.


<!-- combat-complete SESSION-04 --> M17
### combat-complete SESSION-04 delta — M17 tests — new test ids and proofs
- New ids: `fight-ally-spawn-<instanceId>`, `fight-ally-spawn-remove-<instanceId>`, `fight-add-ally` (select), `fight-add-ally-submit`.
- `e2e/combat.spec.ts` 'CAP-03 …': `referenceFight(pack, wights, positions?, allySpawns = [])` now spawns ally spawns too.
- `e2e/replay.spec.ts` 'CAP-03 / CA-04b …': `FightFile.start.allySpawns?`.


<!-- combat-complete SESSION-05 --> M17
### combat-complete SESSION-05 delta — M17 tests / test ids
- New ids: `fight-assemble-budget`, `fight-assemble-seed`, `fight-assemble-seed-randomize`, `fight-assemble`,
  `fight-encounter-summary`, `fight-assemble-error`.
- `tests/engine/combat.test.ts` 'threat-budget assembly (CAP-04, CA-07, CA-08)' (5); `tests/store/combat.test.ts`
  'threat-budget assembly (CAP-04, CA-05, CA-07, CA-08)' (5, incl. restart leg); `e2e/combat.spec.ts` 'CAP-04: …'.
