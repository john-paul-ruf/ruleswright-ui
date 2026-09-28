# M09 — store (`src/renderer/src/store/`)

**Status:** realized. **Imports (mechanical, non-test):** `zustand`, M06 (`../engine/*`), M07 (`../persistence/client`), M01 (`../../../shared/*`), intra-module `./worlds`/`./character`. Stores never throw to views; failures land as `AppError` fields.

| File | Session | Responsibility (realized) |
|---|---|---|
| `worlds.ts` | S01 c3 (core), S03 (manage/import/export) | themes, world list + skipped docs, `active {meta, packJson, pack, runtime}`, session-scoped `corrupt` map, forge/open/startup; rename/delete/import/export — see below. |
| `ui.ts` | S02 c3 | `type Surface = 'roll'|'world'|'character'|'fight'|'combat'`; `useUiStore {surface, navigate(surface)}`, initial `'roll'`. Session-scoped, never persisted. |
| `determinism.ts` | S04 c1 `33481cf` | rerun-same-seed state per world id (D-11) — see below. |
| `character.ts` | S05 c2 `18119f9` | active character (session-scoped, D-07), progression/pools/spells/conditions actions, snapshots list/save/load/delete — see below. |
| `combat.ts` | S06 c2 `8ac723d` | fight assembly, combat state mirror, accumulated event log, record/replay — see below. |

## `store/worlds.ts`
- `createWorldsStore()` (a fresh store per call, for restart-style tests) plus `useWorldsStore`, `ActiveWorld {meta, packJson, pack, runtime}`, `WorldsState`, `ExportOutcome = {status:'saved'|'cancelled'} | {status:'error'; error}`.
- `startup()` — themes (`listThemes()`), world list + skipped docs (`world:list` → `{worlds, skipped}`), then reopen `settings.lastWorldId` if still listed (pack re-validated through the gate).
- `forge({themeId, seed, knobs})` — engine gate → persist → activate (`active.packJson` is the saved string, never re-stringified, CA-01) → `rememberLast` (`settings:set` `lastWorldId`) → `refresh()`. Inputs stay in the view on failure.
- `open(worldId)` — `world:open` string → `openPack` gate re-validates (CA-02); failures land in `openError` **and** the session-scoped `corrupt[worldId]` verdict (D-15, not persisted); a successful open drops the verdict.
- `exportPack(worldId)` — `pack:export` via main's native dialog; exports exactly the stored `pack.json` bytes.
- SESSION-03 additions (additive; existing members unchanged): `importError: AppError | null` (last import rejection — paste or file; nothing written when set), `forgeMs: number | null` (display-only generation time of the last successful forge), `rename(worldId, name): Promise<AppError | null>` (`world:rename` → `active.meta` follows if same id → `refresh()`), `deleteCounts(worldId): Promise<DeleteCounts | AppError>` (`snapshot:list` + `fight:list` lengths for the delete confirm), `remove(worldId): Promise<AppError | null>` (`world:delete`; main cascades + clears `lastWorldId` → `active = null` if it was open, verdict dropped from `corrupt` → `refresh()`), `importFromText(text): Promise<boolean>` (`importPackText` gate → `world:save` with `theme/seed/knobs` = provenance params or all `null` (D-03), canonical bytes (D-05), name = `suggestedName` (D-17) → `open(newId)` → `refresh()`), `importFromFile(): Promise<boolean | 'cancelled'>` (`pack:import` native dialog → `importFromText(packText)`).
- New export `interface DeleteCounts { snapshots: number; fights: number }`.
- Behavior: every user action (`forge`, `open`, `importFromText`, `importFromFile`, `rename`, `deleteCounts`, `remove`) first clears `forgeError`, `openError` and `importError`, so only one action error is current at a time.

## `store/determinism.ts` (SESSION-04 c1 `33481cf`)
- `createDeterminismStore(worlds: StoreApi<WorldsState> = useWorldsStore)`, `useDeterminismStore`: `{byWorld: Record<worldId, RerunResult | 'running'>; rerun(): Promise<void>}`. `rerun` reads `worlds.active` (`meta`, `packJson` verbatim, CA-01), stores `'running'`, yields one macrotask, then stores the result under the world id. No durable write. Reads `useWorldsStore` only.
- Types exported: `RerunResult` (re-export), `RerunState`, `DeterminismState`.

## `store/character.ts` (SESSION-05 c2 `18119f9`)
Imports M06 (`engine/runtime`, `engine/errors`, type `engine/schema`), M07, M01 types, and intra-module `store/worlds` (reads `active.runtime`, `active.meta.id` only).
- `createCharacterStore(worlds = useWorldsStore)` (fresh store per call, for tests) and `useCharacterStore`.
- State: `worldId`, `character: Character | null` (live library object — SESSION-06 ally source), `view: CharacterView | null`,
  `poolsAtRest` (pool values at create / restore / last rest), `lastEvents`, `errors: Partial<Record<'create'|'progress'|'pools'|'spells'|'conditions'|'snapshots', AppError>>`
  (a new rejection replaces the record: one error card per screen), `snapshots: SnapshotMeta[]`.
- Actions: `checkBuild(race, classes)`, `create(req): boolean`, `awardXp`, `setLevels`, `spend`, `prepare`, `cast`, `rest`, `apply`, `remove`, `tick`,
  `refreshSnapshots()`, `saveSnapshot(name)`, `loadSnapshot(name)`, `deleteSnapshot(name)` (async → boolean).
- Reset: a change of `active.meta.id` **or** of `active.runtime` identity (reopen) clears character/view/errors and reloads snapshots; a rename keeps it.

## `store/combat.ts` (SESSION-06 c2 `8ac723d`)
Imports engine/combat, engine/combat-profile, engine/errors, engine/replay, engine/runtime, persistence/client, store/character, store/worlds; shared ipc-contract/model types.
- `createCombatStore(worlds?, characters?)`, `useCombatStore` {enemies, addEnemy, removeEnemy, fight, state, hpAtStart, pending, log, rejection, error, over, filters, setFilters, start, script, declarations, records, recordsError, replayed, begin, declare, step, respond, end, refreshRecords, record, replay};
  selectors `roundsOf`, `typesOf`, `visibleLog`, `offerEvents`; re-exports `listSpawnable`, `spatialLabel`, `spawnProfile` + combat types for views.
- Event log (CA-07): every runtime event goes into the store `log` through `subscribe`; nothing is dropped or deduplicated. Store invariant: `log.length === eventsSince(0) − begin count` at every call (negative control: dropping `trigger:declined` fails).
- Record (c5): `record(name)` snapshots the ally (B-2: `start = {ally: {id, snapshot: serialize(rt, character)}, enemies}`), derives the profile (B-1), and saves `{…envelope, declarations, combat, outcome, start, script, events}` with `outcome: over ? 'complete' : 'abandoned'` via `fight:save` (D-21 `FightRecordBody`).
- Replay (c5): `fight:load` → `replay(active.meta, active.packJson, doc)`; a divergence also rewrites the record's `outcome` to `diverged` via `fight:set-outcome`, then `refreshRecords()`.

## Change history
- v1-shell plan: created (planned, per-file table above).
- SESSION-01 c3 (`5fcf552`): `worlds.ts` core realized.
- SESSION-02 c3 (`ae1c762`): `ui.ts` realized.
- SESSION-03 c1 (`511ec2b`): `worlds.ts` manage/import additions.
- SESSION-04 c1 (`33481cf`): `determinism.ts` realized.
- SESSION-05 c2 (`18119f9`): `character.ts` realized.
- SESSION-06 c2 (`8ac723d`) + c5 (`98a14e3`): `combat.ts` store realized; record/replay.

<!-- loot-inventory SESSION-02 -->
### loot-inventory SESSION-02 delta — M09 store
— `store/character.ts`
- `CharacterSection` gains `'inventory'`.
- New actions `grant(itemId, qty)`, `drop(itemId, qty)`, `loot(tableId, seed)`, each `mutate('inventory', …)`; rejections land in `errors.inventory`, the view is unchanged.


<!-- combat-complete SESSION-01 --> M09
### combat-complete SESSION-01 delta — M09 store — `src/renderer/src/store/combat.ts`
- `createCombatStore(worlds, characters)`: `characters` is now `Pick<StoreApi, 'getState' | 'subscribe'>`. A change of character name/presence changes the ally id, which relayouts.
- `positions: Record<string, Position> | null` is the placement for the next `begin`. It resets to the default layout on every roster change (enemy add/remove, world change, character change) and is `null` on theater packs. `move` does not change it.
- `defaultPositions: Record<string, Position> | null` is the CX-D9 layout (allies x=0, enemies x=1, y = index in own side, character first). Only roster changes change it.
- `setPosition(id, position)`, `resetPositions()`.
- `live: LiveFight | null` sits alongside `fight: Combat | null`; `fight` is kept readable and always equals `live.fight`.
- `begin()` passes `positions` and captures `start.positions` (spatial packs only).
- `move(positions)` runs `reposition`, appends `{op:'move', positions}` to `script`, and republishes. It adds no log rows or declarations; a refusal goes to `error`.
- `record()` writes `start.positions` through `start` (spatial packs only).
- The store now also re-exports the type `Position`.


<!-- combat-complete SESSION-02 --> M09
### combat-complete SESSION-02 delta — M09 store — `store/combat.ts` (lease r2, re-export only)
- The view-facing re-exports gain `distance`, `spatialOf` and type `SpatialDef` (from `engine/combat`).


<!-- combat-complete SESSION-03 --> M09
### combat-complete SESSION-03 delta — M09 store — `src/renderer/src/store/combat.ts`
- Re-exports added: `actionInfo`, `slotGrants`; types `ActionCost`, `ActionInfo`.
- `initiativeOf(log: readonly RuntimeEvent[]): RuntimeEvent | undefined` — the log's `combat:start` event (CA-01); survives a `move` (the log keeps it).


<!-- combat-complete SESSION-04 --> M09
### combat-complete SESSION-04 delta — M09 store — `store/combat.ts`
- New state: `allySpawns: SpawnSpec[]`. New actions: `addAllySpawn(statblockId)` and `removeAllySpawn(instanceId)`. The store re-exports type `SpawnSpec`.
- There is one allocator (`spawnOf`) over both rosters, used by `addEnemy` and `addAllySpawn`. Ids are `${statblockId}-${n}`, with the smallest `n` unused on either side; the character's ally id also counts as taken (CA-05).
- CX-D9 layout (CA-12 extended): allies are `[character, ...allySpawns]` at `x=0`, `y` = index; enemies stay at `x=1`.
- `begin` passes `start.allySpawns` to `engine.begin`. `start.allySpawns` is set only when non-empty, so the record body carries it only then. When `begin` refuses under CA-05, there is no fight, no log rows and no events.
- A world change clears `allySpawns` along with the enemy roster.
