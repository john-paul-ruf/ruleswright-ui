# M02 — main (`src/main/`)

**Status:** planned (SESSION-01 c1–c2; FightDoc adaptation possibly SESSION-06 per B-2). **Imports:** M01, electron, node:fs/promises, node:crypto, node:path. **Never** `ruleswright`.

## Public API (planned)
- `index.ts` — app entry: honors `RULESWRIGHT_USER_DATA` (test isolation hook) via `app.setPath('userData', …)` before ready; single window; registers IPC; installs network block (`webRequest.onBeforeRequest` cancels any non-`file:`/`devtools:` request, allowing the dev server origin only in dev).
- `window.ts` — `createMainWindow(settings)`: `contextIsolation:true, sandbox:true, nodeIntegration:false`, min 1280×800, bounds restore/save, `setWindowOpenHandler(()=>({action:'deny'}))`, `will-navigate` prevented.
- `storage.ts` — `createStorage(rootDir)` (no electron import): worlds/settings/snapshots/fights per `specs/database.md`; atomic temp+rename writes; UUID dir validation; path clamping; unknown-field preservation; cascade delete; `packSha256` (node:crypto over exact bytes).
- `dialogs.ts` — `createDialogs()`; calls `dialog.showSaveDialog/showOpenDialog` **by property access at call time** (e2e stubs them).
- `ipc.ts` — `createIpcHandlers({storage, dialogs})` → `Record<Channel, (payload: unknown) => Promise<IpcResult<unknown>>>` (pure, node-testable); `registerIpc(ipcMain, handlers)`.

## Change history
- v1-shell plan: created (planned).
