# M01 — shared (`src/shared/`)

**Status:** realized (v1-shell S01 c2 `77d8e63`; B-2 fight fields v1-shell S06 c5 `98a14e3`; grid/ally-spawn fields combat-complete S01 `afdd9dc`–`3ec636e`, S04 `497ab84`). **Imports:** nothing outside the module (hard rule; the only intra-module reference is `ipc-contract.ts` → `./model`).

## Public API (realized)
- `ipc-contract.ts` — the whole IPC surface (CA-04). Request/response only; ids and names cross the bridge, never filesystem paths (Custom Rule 7).
  - `IpcContract` — channel → `{req, res}` map over 18 channels: `world:list|open|save|rename|delete`, `settings:get|set`, `snapshot:list|save|load|delete`, `fight:list|save|load|delete|set-outcome` (set-outcome per `database.md` "updated if a replay later diverges", D-21), `pack:export|import`. `world:list` returns `{worlds, skipped}` (D-06).
  - `IpcResult<T> = {ok:true,value:T} | {ok:false,error:IpcError}`; `IpcError {code, message, operation}` with `code ∈ invalid-input | not-found | name-collision | io | too-large`.
  - Caps and patterns: `MAX_DOC_BYTES` (16 MiB), `MAX_WORLD_NAME` (80), `MAX_RECORD_NAME` (64), `RECORD_NAME_PATTERN` (`[\w- ]+`).
  - `IPC` — API method name → channel (`worldList: 'world:list'`, …), so `RuleswrightApi` is one method per channel; compile-time guard `IPC_COVERS_EVERY_CHANNEL` proves the table names every channel.
  - Per-channel request/response types (`IpcRequest<C>`, `IpcResponse<C>`, `ApiMethod<C>`, `Deleted`).
- `model.ts` — realization of `specs/database.md` (DB-owned, Custom Rule 8; current source `af47822`): `FORMAT_VERSION = 1`, `Settings`, `WindowBounds`, `WorldDoc` (= `WorldMeta`), `NewWorld`, `PackIdentity`, `SnapshotDoc`/`SnapshotMeta` (`snapshot` is verbatim `serializeCharacter` output), `FightRecordBody` (D-21: the renderer-supplied part of a FightDoc), `FightOutcome` + `FIGHT_OUTCOMES`, `FightRecordMeta`, `SkippedDoc`, and the fight replay shapes below.

## FightDoc replay shapes (all additive; `formatVersion` stays 1)
- `FightDoc.start?`, `script?`, `events?` (B-2). Legacy records without them list and load; replay/resume report unavailable.
- `FightStartDoc`:
  - `ally {id, snapshot}` and `enemies: {statblockId, instanceId}[]` (B-2);
  - `positions?: Record<string, GridPosition>` — the positions passed to `startCombat`, present iff the pack declares a spatial model (combat-complete);
  - `allySpawns?: {statblockId, instanceId}[]` — bestiary spawns on the ally side, in `startCombat` ally order after the character, written only when non-empty (combat-complete S04).
- `GridPosition {x, y}` — integers (validated by M02).
- `FightScriptEntry` = `{op:'declare', actionId, targetId?}` | `{op:'respond', triggerId, choice:'take'|'decline', targetId?}` | `{op:'step'}` | `{op:'move', positions: Record<string, GridPosition>}` — a `move` carries the complete post-reposition map (every combatant).
- `FightRecordMeta` (list projection) = envelope + outcome + `rng` (stored `combat.rng` verbatim) + `round` (`combat.round`) + `eventCount` (`events.length`); no `start`/`script`/`events`/`declarations`/`combat` in list metadata.

## Rules
- Pure types + constants, no runtime behavior. Document shapes are **DB-owned** (Custom Rule 8): shape changes are DB re-entries, not session scope adjustments.
- Snapshot/fight bodies are typed `unknown` where they carry library payloads — shared cannot import `ruleswright` types.

## Change history
- v1-shell plan: created (planned).
- v1-shell S01 c2 (`77d8e63`): realized; `IpcContract`/`Channel`/`IpcRequest`/`IpcResponse`/`ApiMethod`/`Deleted`/`IpcErrorCode`, caps, `FightRecordBody`, `FIGHT_OUTCOMES`.
- v1-shell S06 c5 (`98a14e3`): B-2 `start?`/`script?`/`events?`; `FightRecordMeta` projection.
- combat-complete S01 (`afdd9dc` c1 types, `3ec636e` c3): `GridPosition`, `move` script entry, `start.positions` (DB `af47822` names; the types moved from c3 to c1 — see Granularity feedback in the combat-complete Final Report).
- combat-complete S04 c1 (`497ab84`): `start.allySpawns`.
