# M09 — store (`src/renderer/src/store/`)

**Status:** realized. **Imports (mechanical, non-test):** `zustand`, M06 (`../engine/*`), M07 (`../persistence/client`), M01 (`../../../shared/*`, type-only), intra-module `./worlds`/`./character`. Stores never throw to views; failures land as `AppError` fields. Views reach the engine only through store re-exports (combat-complete kept this: `spatialOf`/`distance` were routed through `store/combat`, S02 lease r2).

| File | Realized by | Responsibility |
|---|---|---|
| `worlds.ts` | v1-shell S01 c3 (core), S03 (manage/import/export) | themes, world list + skipped docs, `active {meta, packJson, pack, runtime}`, session-scoped `corrupt` map, forge/open/startup; rename/delete/import/export. |
| `ui.ts` | v1-shell S02 c3 | `type Surface = 'roll'|'world'|'character'|'fight'|'combat'`; `useUiStore {surface, navigate(surface)}`, initial `'roll'`. Session-scoped, never persisted. |
| `determinism.ts` | v1-shell S04 c1 `33481cf` | rerun-same-seed state per world id (D-11). |
| `character.ts` | v1-shell S05 c2 `18119f9`; loot-inventory S02 c2 `831ed2b` | active character, progression/pools/spells/conditions/inventory actions, snapshots. |
| `combat.ts` | v1-shell S06 c2 `8ac723d` + c5; combat-complete S01–S06 | fight assembly (rosters, placement, threat), live fight mirror, event log, record/replay/resume. The feature spine: every combat-complete session held it (CX-D8, effective concurrency 1). |

## `store/worlds.ts`
- `createWorldsStore()` (fresh store per call, for restart-style tests) plus `useWorldsStore`, `ActiveWorld {meta, packJson, pack, runtime}`, `WorldsState`, `ExportOutcome = {status:'saved'|'cancelled'} | {status:'error'; error}`, `DeleteCounts {snapshots, fights}`.
- `startup()` — themes (`listThemes()`), world list + skipped docs, then reopen `settings.lastWorldId` if still listed (pack re-validated through the gate).
- `forge({themeId, seed, knobs})` — engine gate → persist → activate (`active.packJson` is the saved string, never re-stringified, CA-01) → `rememberLast` → `refresh()`. Inputs stay in the view on failure.
- `open(worldId)` — `world:open` → `openPack` gate (CA-02); failures land in `openError` **and** the session-scoped `corrupt[worldId]` verdict (D-15); a successful open drops the verdict.
- `exportPack(worldId)` — `pack:export`; exports exactly the stored bytes.
- `importError`, `forgeMs`, `rename(worldId, name)`, `deleteCounts(worldId)`, `remove(worldId)` (main cascades; `active = null` if it was open), `importFromText(text)` (`importPackText` gate → `world:save` with provenance params or all `null` (D-03), canonical bytes (D-05), `suggestedName` (D-17) → `open` → `refresh`), `importFromFile()`.
- Every user action first clears `forgeError`, `openError` and `importError` (one current action error).

## `store/determinism.ts`
- `createDeterminismStore(worlds = useWorldsStore)`, `useDeterminismStore`: `{byWorld: Record<worldId, RerunResult | 'running'>; rerun()}`. Reads `worlds.active` (`packJson` verbatim, CA-01), stores `'running'`, yields one macrotask, stores the result. No durable write. Exports `RerunResult` (re-export), `RerunState`, `DeterminismState`.

## `store/character.ts`
Imports M06 (`engine/runtime` as `rules`, `engine/errors`, type `engine/schema`), M07, M01 types, intra-module `store/worlds` (reads `active.runtime`, `active.meta.id`).
- `createCharacterStore(worlds = useWorldsStore)` and `useCharacterStore` (type `CharacterStore`).
- State: `worldId`, `character: Character | null` (live library object — the combat ally source), `view: CharacterView | null`, `poolsAtRest`, `lastEvents`, `errors: Partial<Record<CharacterSection, AppError>>` with `CharacterSection = 'create'|'progress'|'pools'|'spells'|'conditions'|'inventory'|'snapshots'` (a new rejection replaces the record: one error card per screen), `snapshots: SnapshotMeta[]`.
- Actions: `checkBuild`, `create`, `awardXp`, `setLevels`, `spend`, `prepare`, `cast`, `rest`, `apply`, `remove`, `tick`, `grant(itemId, qty)`, `drop(itemId, qty)`, `loot(tableId, seed)` (FR-18; each `mutate('inventory', …)`, rejections land in `errors.inventory` with the view unchanged), `refreshSnapshots`, `saveSnapshot`, `loadSnapshot`, `deleteSnapshot`. Inventory persists inside the verbatim snapshot envelope (no DB change, CA-06).
- Reset: a change of `active.meta.id` **or** of `active.runtime` identity clears character/view/errors and reloads snapshots; a rename keeps it.

## `store/combat.ts`
Imports `engine/combat` (as `combat`, plus types), `engine/combat-profile`, `engine/errors`, `engine/replay` (`recordingOf`, `replay`, `resume`), `engine/runtime` (`serialize`), `persistence/client`, `store/character`, `store/worlds`; shared types.

`createCombatStore(worlds?, characters?)` — `characters` is `Pick<StoreApi, 'getState'|'subscribe'>`, so a character change (new ally id) relayouts. `useCombatStore`.

**Assembly state (before Begin).**
- `enemies: EnemySpec[]`, `addEnemy`, `removeEnemy`; `allySpawns: SpawnSpec[]`, `addAllySpawn(statblockId)`, `removeAllySpawn(instanceId)`.
- One allocator (`spawnOf`) over both rosters: ids `${statblockId}-${n}` with the smallest `n` unused on either side; the character's ally id also counts as taken. The CA-05 ally-id set (`allyIds()` = character id + ally spawns) is shared by `spawnOf` and `assembleEnemies`.
- `encounter: Encounter | null` — the last threat-budget assembly's library result verbatim (CA-08). `assembleEnemies(budget, seed): boolean`: non-empty groups replace `enemies` with the library ids and relayout (ally spawns kept); empty groups set `encounter` and leave roster/placement unchanged (CX-D5); an id already on the ally side is refused (`unexpected` `fight:assemble`, roster unchanged, CA-05); a throw → `toAppError('fight:assemble', …)`.
- `positions: Record<string, Position> | null` — placement for the next `begin` (CA-12); reset to `defaultPositions` on every roster change (enemy/ally-spawn add/remove, assembly, world change, character change); `null` on theater packs; a `move` does not change it. `defaultPositions` — the CX-D9 layout: allies `[character, ...allySpawns]` at `x=0`, enemies at `x=1`, `y` = index in own side. `setPosition(id, position)`, `resetPositions()`.
- A world change clears `enemies`, `allySpawns`, `encounter` and `resumed`.

**Live fight.**
- `live: LiveFight | null` and `fight: Combat | null` (kept readable, always `live.fight`; planning finding F3), `state` (structuredClone of `fight.state`), `hpAtStart`, `pending`, `log`, `rejection`, `error`, `over`, `filters`/`setFilters`, `start`, `script`, `declarations`.
- `begin()` passes `positions` and `allySpawns` to `engine.begin`; captures `start` (with `positions` on spatial packs only and `allySpawns` only when non-empty) before `startCombat`. A CA-05 refusal leaves no fight, no log rows, no events.
- `declare`, `step`, `respond`, `end`; `move(positions)` runs `reposition`, appends `{op:'move', positions}` to `script`, republishes, adds no log rows or declarations; a refusal goes to `error` (CA-13).
- Event log (CA-07 of v1-shell): every runtime event enters `log` through `subscribe`; nothing dropped or deduplicated.

**Records.**
- `records`, `recordsError`, `refreshRecords()`.
- `record(name)` — saves `{…envelope, declarations, combat, outcome: over ? 'complete' : 'abandoned', start, script, events}` via `fight:save` (D-21 `FightRecordBody`); `start` carries the ally snapshot, enemies, and the combat-complete `positions`/`allySpawns`.
- `replay(name)` → `replayed {name, result, events}`; a divergence also rewrites the record's `outcome` to `diverged` via `fight:set-outcome`, then `refreshRecords()`.
- `resume(name): Promise<boolean>` (FR-14, CX-D6, CA-09..11) — `fight:load` → `engine.resume(active.packJson, doc)`. On `resumed`: end the old subscription, subscribe the log sink to `live.fight.runtime` (CA-11 handoff), publish `{fight, live, start, script, declarations, log, hpAtStart}` from the record and the rebuild. Otherwise only `resumed {name, result}` is set (refusals only; success or a world change clears it). Never rewrites `outcome`; `enemies`, `allySpawns`, `positions`, `encounter` untouched. The adopted fight's runtime is a fresh `Runtime` on the stored pack, not `worlds.active.runtime` — views read `fight.runtime`.

**Selectors and re-exports.** `initiativeOf(log)` (the `combat:start` event, CA-01; survives a `move`), `roundsOf`, `typesOf`, `visibleLog`, `offerEvents`. Value re-exports from `engine/combat`: `actionInfo`, `distance`, `listSpawnable`, `slotGrants`, `spatialLabel`, `spatialOf`, `spawnProfile`. Type re-exports: `ActionCost`, `ActionInfo`, `CombatState`, `CombatantState`, `Encounter`, `EnemySpec`, `PendingTrigger`, `Position`, `RuntimeEvent`, `SpatialDef`, `SpawnSpec`.

## Change history
- v1-shell: S01 c3 worlds core; S02 c3 ui; S03 c1 worlds manage/import; S04 c1 determinism; S05 c2 character; S06 c2/c5 combat + record/replay.
- loot-inventory S02 c2 (`831ed2b`): `inventory` section, grant/drop/loot (arch `a8b78cb`).
- combat-complete S01 (`bb1af82`, `3ec636e`; lease r2): placement, `defaultPositions`/`resetPositions`, `live`, `move`, `start.positions` (arch `268a2f1`).
- combat-complete S02 (`58fb329`; lease r2): re-exports `distance`, `spatialOf`, `SpatialDef` (arch `c02ec42`).
- combat-complete S03 (`229cd74`): `initiativeOf`, re-exports `actionInfo`/`slotGrants` (arch `e033c16`).
- combat-complete S04 (`d88b071`): ally roster, shared allocator, CA-05, `start.allySpawns` (arch `79fe4fc`).
- combat-complete S05 (`650668d`): `encounter`/`assembleEnemies` (arch `a19a902`).
- combat-complete S06 (`1951f76`): `resume`/`resumed` (arch `acfc1fa`).
