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
