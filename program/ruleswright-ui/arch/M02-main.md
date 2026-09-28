# M02 — main (`src/main/`)

**Status:** realized (v1-shell S01 c1–c2 `ca1d972`, `77d8e63`; FightDoc projection v1-shell S06 c5 `98a14e3`; grid/ally-spawn validation combat-complete S01 c3 `3ec636e`, S04 c1 `497ab84`). **Imports (mechanical, non-test):** `electron`, `node:crypto`, `node:fs/promises`, `node:path`, and M01 (`../shared/model`, `../shared/ipc-contract`; intra-module `./dialogs`/`./storage`/`./window`/`./ipc`). **Never** `ruleswright`.

## Public API (realized)
- `index.ts` — app entry: honors `RULESWRIGHT_USER_DATA` (D-12 test-isolation hook) via `app.setPath('userData', …)` before `ready`; installs the main-side network block (`session.defaultSession.webRequest.onBeforeRequest` cancels any URL whose protocol is not `file:`/`devtools:`/`data:` and, in dev, is not the `ELECTRON_RENDERER_URL` origin — CSP meta plus block, D-13); registers IPC over `createStorage(app.getPath('userData'))` and `createDialogs(getWindow)`; creates one window with restored bounds.
- `window.ts` — `createMainWindow(bounds: WindowBounds | null, onClose: (b) => Promise<void>): BrowserWindow` (close is deferred until bounds are persisted). `contextIsolation:true, sandbox:true, nodeIntegration:false`, min 1280×800, `setWindowOpenHandler(()=>({action:'deny'}))`, `will-navigate` prevented.
- `storage.ts` — `createStorage(rootDir)` (no Electron import; node tests run it on real fs) → `Storage` with `listWorlds / openWorld / readPackBytes / saveWorld / renameWorld / deleteWorld / getSettings / setSettings / list|save|load|deleteSnapshot / list|save|load|deleteFight / setFightOutcome`. Exports `StorageError {code: IpcErrorCode}` and `sha256Hex`. Atomic temp+rename writes; UUID-v4 directory validation; path clamping (`under()` refuses anything escaping the store); unknown fields tolerated and preserved on rewrite; cascade delete `worlds/<id>` → `snapshots/<id>` → `fights/<id>` → clear `lastWorldId`; `packSha256` = sha256 of the exact bytes. `fightMeta` projects `rng / round / eventCount` from the stored document.
- `dialogs.ts` — `createDialogs(getWindow)`: `Dialogs` (`saveJson(defaultName)`, `openJson()` → path | null). `dialog.showSaveDialog/showOpenDialog` is looked up **at call time** (e2e stubs it through `electronApp.evaluate`).
- `ipc.ts` — `createIpcHandlers({storage, dialogs})` → `Record<Channel, handler>` (pure, node-testable; every payload shape-checked before any disk access, nothing throws across the bridge); exports `Handler`, `IpcHandlers`; `registerIpc(ipcMain, handlers)`.

## FightDoc save validation (`storage.ts`, per `database.md` `af47822`)
Optional replay fields are enforced when present (16 MiB cap on the whole document):
- `declarations` array; `outcome ∈ FIGHT_OUTCOMES`; `events` an array.
- `script[i]` is one of `declare | respond (choice take|decline) | step | move`; a `move` requires `isPositions(positions)`. Refusal text: `script[i] is not a valid declare/respond/step/move entry` (pinned by `tests/main/ipc.test.ts`; lease r2 of combat-complete S01, planning finding F1).
- `start.ally.snapshot.kind === 'character'`.
- `isSpawns` validates both `start.enemies` and `start.allySpawns` as `[{statblockId, instanceId}]` strings (`'start.allySpawns must be [{statblockId, instanceId}]'`).
- `isPositions`: an object whose values are all `{x: integer, y: integer}`; `start.positions` refusal `'start.positions must be {[id]: {x: integer, y: integer}}'`.
- Records without the combat-complete fields load and list unchanged (CA-06).

## Deviations from `specs/architecture.md` (recorded in v1-shell STATE)
- `settings:set` accepts only `lastWorldId` (window bounds are written through main's own path); other keys are `invalid-input`.
- `world:list` → `{worlds, skipped}` (D-06) vs architecture's `WorldMeta[]`.

## Change history
- v1-shell S01 c1 (`ca1d972`) scaffold; c2 (`77d8e63`) storage/dialogs/ipc/window realized.
- v1-shell S06 c5 (`98a14e3`): `fightMeta` list projection.
- combat-complete S01 c3 (`3ec636e`): `isPositions`, `move` entries, `start.positions`, new refusal text.
- combat-complete S04 c1 (`497ab84`): `isSpawns` for `start.enemies` + `start.allySpawns`.
