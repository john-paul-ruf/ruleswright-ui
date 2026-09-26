# M01 — shared (`src/shared/`)

**Status:** planned (SESSION-01 c2). **Imports:** nothing (hard rule).

## Public API (planned)
- `ipc-contract.ts`: `IPC` channel constant table (`world:list|open|save|rename|delete`, `settings:get|set`, `snapshot:list|save|load|delete`, `fight:list|save|load|delete|set-outcome` (save body derived from `FightDoc`; set-outcome per database.md "updated if a replay later diverges", STATE D-21), `pack:export|import`); `IpcResult<T> = {ok:true,value:T} | {ok:false,error:IpcError}`; `IpcError {code, message, operation}` with `code ∈ invalid-input | not-found | name-collision | io | too-large`; `RuleswrightApi` (the exact shape of `window.ruleswright`); per-channel request/response types.
- `model.ts`: realization of `specs/database.md` — `FORMAT_VERSION = 1`, `Settings`, `WindowBounds`, `WorldDoc` (= `WorldMeta`), `NewWorld`, `SnapshotDoc`, `SnapshotMeta`, `PackIdentity`, `FightDoc`, `FightRecordMeta`, `FightOutcome`, `SkippedDoc`.

## Rules
- Pure types + constants. Document shapes are **DB-owned** (Custom Rule 8): shape changes are DB re-entries.
- Snapshot/fight bodies are typed `unknown` here (shared cannot import `ruleswright` types).

## Change history
- v1-shell plan: created (planned).
