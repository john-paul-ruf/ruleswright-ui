# M03 — preload (`src/preload/`)

**Status:** realized (SESSION-01 c2 `77d8e63`), exactly as planned. **Imports (mechanical, non-test):** `electron` (`contextBridge`, `ipcRenderer`), M01 (`../shared/ipc-contract`).

## Public API (realized)
- Exposes exactly one object: `contextBridge.exposeInMainWorld('ruleswright', api)` where `api: RuleswrightApi` is built from the `IPC` table — one method per channel, `(payload) => ipcRenderer.invoke(channel, payload)`. No logic, no fs, no engine. The module is CommonJS (sandboxed preload; hazard H-4: no `"type": "module"` in `package.json`).
- `src/renderer/src/env.d.ts` (owned with M16) declares `window.ruleswright: RuleswrightApi` (readonly on `Window`).

## Change history
- v1-shell plan: created (planned).
- SESSION-01 c2 (`77d8e63`): realized as planned.