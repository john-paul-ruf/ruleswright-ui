# M09 — store (`src/renderer/src/store/`)

**Status:** planned. **Imports:** M06, M07, M01.

| File | Session | Responsibility |
|---|---|---|
| `worlds.ts` | S01 c3 (core), S03 (manage/import/export) | themes, world list + skipped docs, `active {meta, packJson, pack, runtime}`, session-scoped `corrupt` map, forge/open/startup; rename/delete/import/export |
| `ui.ts` | S02 | active surface (`roll|world|character|fight|combat`), `navigate(surface)` |
| `determinism.ts` | S04 | rerun-same-seed state per world id (D-11) |
| `character.ts` | S05 | active character (session-scoped, D-07), progression/pools/spells/conditions actions, snapshots list/save/load/delete |
| `combat.ts` | S06 | fight assembly, combat state mirror, accumulated event log, record/replay |

Stores never throw to views; failures land as `AppError` fields.

## Change history
- v1-shell plan: created (planned).


<!-- v1-shell SESSION-01 -->
## Realized — v1-shell SESSION-01

### M09 store — realized (`5fcf552`)
- `worlds.ts` exports `createWorldsStore()` (a fresh store per call, for restart-style tests) plus `useWorldsStore`, `ActiveWorld`, `WorldsState`, `ExportOutcome`.


<!-- v1-shell SESSION-02 -->
## Realized — v1-shell SESSION-02

### M09 store — `ui.ts` realized (`ae1c762`)
- `type Surface = 'roll'|'world'|'character'|'fight'|'combat'`; `useUiStore` `{ surface: Surface; navigate(surface): void }`, initial `'roll'`.


<!-- v1-shell SESSION-04 -->
## Realized — v1-shell SESSION-04

### M09 store — `determinism.ts` realized (SESSION-04 c1 `33481cf`)
- `createDeterminismStore(worlds: StoreApi<WorldsState> = useWorldsStore)`, `useDeterminismStore`: `{ byWorld: Record<worldId, RerunResult | 'running'>; rerun(): Promise<void> }`. `rerun` reads `worlds.active` (`meta`, `packJson` verbatim, CA-01), stores `'running'`, yields one macrotask, then stores the result under the world id. No durable write. Reads `useWorldsStore` only.
- Types exported: `RerunResult` (re-export), `RerunState`, `DeterminismState`.


<!-- v1-shell SESSION-05 -->
## Realized — v1-shell SESSION-05

### M09 store — `character.ts` realized (`18119f9`)
Imports M06 (`engine/runtime`, `engine/errors`, type `engine/schema`), M07, M01 types, and `store/worlds` (reads `active.runtime`, `active.meta.id` only).
- `createCharacterStore(worlds = useWorldsStore)` (fresh store per call, for tests) and `useCharacterStore`.
- State: `worldId`, `character: Character | null` (live library object — SESSION-06 ally source), `view: CharacterView | null`,
  `poolsAtRest` (pool values at create / restore / last rest), `lastEvents`, `errors: Partial<Record<'create'|'progress'|'pools'|'spells'|'conditions'|'snapshots', AppError>>`
  (a new rejection replaces the record: one error card per screen), `snapshots: SnapshotMeta[]`.
- Actions: `checkBuild(race, classes)`, `create(req): boolean`, `awardXp`, `setLevels`, `spend`, `prepare`, `cast`, `rest`, `apply`, `remove`, `tick`,
  `refreshSnapshots()`, `saveSnapshot(name)`, `loadSnapshot(name)`, `deleteSnapshot(name)` (async → boolean).
- Reset: a change of `active.meta.id` **or** of `active.runtime` identity (reopen) clears character/view/errors and reloads snapshots; a rename keeps it.


<!-- v1-shell SESSION-03 -->
## Realized — v1-shell SESSION-03

### M09 store — `store/worlds.ts` (additive; existing members unchanged)
- `WorldsState` gains:
  - `importError: AppError | null` — last import rejection (paste or file); nothing written when set.
  - `forgeMs: number | null` — display-only generation time of the last successful forge.
  - `rename(worldId: string, name: string): Promise<AppError | null>` — `world:rename` → `active.meta` follows if same id → `refresh()`.
  - `deleteCounts(worldId: string): Promise<DeleteCounts | AppError>` — `snapshot:list` + `fight:list` lengths for the delete confirm.
  - `remove(worldId: string): Promise<AppError | null>` — `world:delete` (main cascades + clears `lastWorldId`) → `active = null` if it was open, verdict dropped from `corrupt` → `refresh()`.
  - `importFromText(text: string): Promise<boolean>` — `importPackText` gate → `world:save` with `theme/seed/knobs` = provenance params or all `null` (D-03), canonical bytes (D-05), name = `suggestedName` (D-17) → `open(newId)` → `refresh()`.
  - `importFromFile(): Promise<boolean | 'cancelled'>` — `pack:import` (native dialog) → `importFromText(packText)`.
- New export `interface DeleteCounts { snapshots: number; fights: number }`.
- Behavior: every user action (`forge`, `open`, `importFromText`, `importFromFile`, `rename`, `deleteCounts`, `remove`) first clears `forgeError`, `openError` and `importError`, so only one action error is current at a time.
