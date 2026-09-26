# M03 — preload (`src/preload/`)

**Status:** planned (SESSION-01 c2). **Imports:** M01, electron (`contextBridge`, `ipcRenderer`).

## Public API
- Exposes exactly one object: `contextBridge.exposeInMainWorld('ruleswright', api)` where `api: RuleswrightApi` is built from the `IPC` table (`(payload) => ipcRenderer.invoke(channel, payload)`). No logic, no fs, no engine. Output must be CommonJS (sandboxed preload).
- `src/renderer/src/env.d.ts` (owned with M16) declares `window.ruleswright: RuleswrightApi`.

## Change history
- v1-shell plan: created (planned).
