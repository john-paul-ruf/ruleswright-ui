# M01 — shared (`src/shared/`)

**Status:** realized (SESSION-01 c2 `77d8e63`; B-2 fields SESSION-06 c5 `98a14e3`). **Imports:** nothing outside the module (hard rule; the only intra-module reference is `ipc-contract.ts` → `./model`).

## Public API (realized)
- `ipc-contract.ts` — the whole IPC surface (CA-04). Request/response only; ids and names cross the bridge, never filesystem paths (Custom Rule 7).
  - `IpcContract` — channel → `{req, res}` map over 18 channels: `world:list|open|save|rename|delete`, `settings:get|set`, `snapshot:list|save|load|delete`, `fight:list|save|load|delete|set-outcome` (set-outcome per `database.md` "updated if a replay later diverges", STATE D-21), `pack:export|import`. `world:list` returns `{worlds, skipped}` (D-06).
  - `IpcResult<T> = {ok:true,value:T} | {ok:false,error:IpcError}`; `IpcError {code, message, operation}` with `code ∈ invalid-input | not-found | name-collision | io | too-large`.
  - Caps and patterns: `MAX_DOC_BYTES` (16 MiB), `MAX_WORLD_NAME` (80), `MAX_RECORD_NAME` (64), `RECORD_NAME_PATTERN` (`[\w- ]+`).
  - `IPC` — API method name → channel (`worldList: 'world:list'`, …), so `RuleswrightApi` is one method per channel; compile-time guard `IPC_COVERS_EVERY_CHANNEL` proves the table names every channel.
  - Per-channel request/response types (`IpcRequest<C>`, `IpcResponse<C>`, `ApiMethod<C>`, `Deleted`).
- `model.ts` — realization of `specs/database.md` (DB-owned, Custom Rule 8): `FORMAT_VERSION = 1`, `Settings`, `WindowBounds`, `WorldDoc` (= `WorldMeta`), `NewWorld`, `PackIdentity`, `SnapshotDoc`/`SnapshotMeta` (`snapshot` is verbatim `serializeCharacter` output), the B-2 additions `FightStartDoc`, `FightScriptEntry`, `FightDoc.start?/script?/events?` (additive; `formatVersion` stays 1; legacy records without them list and load, replay reports unavailable), `FightRecordBody` (D-21: the renderer-supplied part of a FightDoc), `FightOutcome` + `FIGHT_OUTCOMES`, `FightRecordMeta`, `SkippedDoc`.

## Rules
- Pure types + constants, no runtime behavior. Document shapes are **DB-owned** (Custom Rule 8): shape changes are DB re-entries, not session scope adjustments.
- Snapshot/fight bodies are typed `unknown` here — shared cannot import `ruleswright` types.

## Change history
- v1-shell plan: created (planned).
- SESSION-01 c2 (`77d8e63`): realized as planned; adds `IpcContract`/`Channel`/`IpcRequest`/`IpcResponse`/`ApiMethod`/`Deleted`/`IpcErrorCode`, the byte/name caps, `FightRecordBody` (D-21) and `FIGHT_OUTCOMES`.
- SESSION-06 c5 (`98a14e3`): `FightDoc` gains optional `start?: FightStartDoc`, `script?: FightScriptEntry[]`, `events?: unknown[]` (B-2, D-19); new `FightScriptEntry`, `FightStartDoc`; `FightRecordMeta` = envelope + outcome + `rng` (stored `combat.rng` verbatim) + `round` (`combat.round`) + `eventCount` (`events.length`) — no `start`/`script`/`events`/`declarations`/`combat` in list metadata.

<!-- combat-complete SESSION-01 --> M01
### combat-complete SESSION-01 delta — M01 shared — `src/shared/model.ts` (DB `af47822` names)
- New `GridPosition { x: number; y: number }` (integers; validated by M02).
- `FightScriptEntry` gains `{ op: 'move'; positions: Record<string, GridPosition> }`: the complete post-reposition map, every combatant.
- `FightStartDoc.positions?: Record<string, GridPosition>`: the positions passed to `startCombat`, present iff the pack declares a spatial model.
- `start.allySpawns` is NOT realized yet (SESSION-04).


<!-- combat-complete SESSION-04 --> M01
### combat-complete SESSION-04 delta — M01 shared — `src/shared/model.ts`
- `FightStartDoc.allySpawns?: { statblockId: string; instanceId: string }[]`. This is the DB name (`specs/database.md` `af47822`), in `startCombat` ally order after the character, written only when non-empty.
