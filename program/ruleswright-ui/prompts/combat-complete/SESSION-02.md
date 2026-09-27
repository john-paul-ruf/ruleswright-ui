# SESSION-02 — Both-sided fight assembly: ally-side bestiary spawns, recorded and replayed

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete
> **Modules:** M01, M02, M06, M09, M14, M17
> **Depends on:** SESSION-01; AUTHOR-DB-CX (Q1 = a) committed to `specs/database.md`
> **Concurrent with:** —
> **Owns:** `src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/combat.ts`, `src/renderer/src/engine/replay.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/index.tsx`, `src/renderer/src/views/fight/fight.css`, `tests/main/storage.test.ts`, `tests/engine/combat.test.ts`, `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts`, `e2e/replay.spec.ts`
> **Reads:** `program/ruleswright-ui/specs/database.md`, `program/ruleswright-ui/specs/requirements.md` (FR-11, FR-14), `program/ruleswright-ui/mocks/fight.html`, `program/ruleswright-ui/specs/design.md`, `src/main/ipc.ts`, `src/renderer/src/views/fight/records.tsx`, `tests/support/in-process-bridge.ts`, `e2e/fixtures.ts`
> **Resources:** `e2e:out` (checkpoint 4 only)
> **Checkpoints:** 4

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | shared | `model.ts` | `FightStartDoc.allySpawns?`, the DB-approved additive field (Custom Rule 8: realized only after DB) |
| M02 | main | `storage.ts` (FightDoc validation, lines ~142–166) | Validate the new field as the integrity rule says |
| M06 | engine | `combat.ts`, `replay.ts` | `begin` takes ally spawns; replay spawns them |
| M09 | store | `combat.ts` | Ally roster, unique ids across sides (CA-05), `start.allySpawns` |
| M14 | views/fight | `index.tsx`, `fight.css` | Allies panel "+ Add bestiary spawn…" (already in `mocks/fight.html`) |
| M17 | tests | the six test files | Proofs |

## Context
FR-11 says "either side may hold multiple bestiary-spawned combatants", and `mocks/fight.html` draws
"+ Add bestiary spawn…" in the Allies panel. The app only lets the character stand on the ally side. The
engine's `startCombat` takes any number of allies. The blocker was recording: `FightDoc.start` could not
describe ally spawns, so a replay would diverge silently. AUTHOR-DB-CX (Q1 = a) adds
`start.allySpawns?: [{statblockId, instanceId}]` (additive, `formatVersion` 1). **Before starting, read the
committed `database.md` wording and use its field name.** `allySpawns` is the proposed name. If DB chose
another, use DB's everywhere below.

Affected consumers of `FightStart`/`EnemySpec` (grep at plan HEAD `01d2457`, all in this lease):
`src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/{combat,replay}.ts`,
`src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/index.tsx`,
`tests/{main/storage,engine/combat,engine/replay,store/combat}.test.ts`, `e2e/replay.spec.ts`.

## Capabilities
- **CAP-03 Ally-side spawns (owned here, complete).** Entry: Fight → Allies panel → pick a bestiary id
  → "+ Add bestiary spawn" → Begin combat. Path: store `allySpawns` → `start = {ally, enemies,
  allySpawns}` captured **before** `startCombat` → `engine.begin(rt, ally, enemies, allySpawns)` →
  `startCombat({allies: [character, ...spawns], enemies})` → Combat surface (SESSION-01 panels show them as
  `allies`). Durable: Record → `fight:save` → main validates → `fights/<worldId>/<name>.json`
  `start.allySpawns`. Read after restart: `fight:list`/`fight:load` → replay spawns the same allies in the
  same order → events equal → `complete`.
- Required facts:
  - spawn profiles come from `spawnMonster` (existing `spawnProfile`)
  - order matters: initiative ties break by the order entries were declared (`combat.ts` sort `tieBreaker`),
    so `[character, ...allySpawns]` order is part of the contract
  - legacy records without the field replay as "no ally spawns"

## Contract Agreements
- **CA-04b FightStart allies (provisional until AUTHOR-DB-CX lands; recheck its text at checkpoint 0).**
  | Boundary | Mapping |
  |---|---|
  | store → engine | `FightStart.allySpawns: SpawnSpec[]` (rename `EnemySpec` → `SpawnSpec`, keep `export type EnemySpec = SpawnSpec`) |
  | engine → library | `allies: [{id: ally.profile.id, ...ally}, ...allySpawns.map(s => ({id: s.instanceId, profile: spawnMonster(rt, s.statblockId, s.instanceId)}))]` |
  | store → IPC | `record.start.allySpawns` is written **only when non-empty**. Records with no ally spawns stay byte-identical in shape to today's |
  | main | `'allySpawns' in start` → an array of `{statblockId: string, instanceId: string}`, else a named refusal like the existing `start.enemies must be [...]` |
  | replay | `rec.start.allySpawns ?? []` → `begin` |

  Absent means empty, never guessed.
- **CA-05 unique combatant ids.** The engine silently merges duplicate ids across sides (probe: allies
  `[x]`, enemies `[x]` → one combatant, `order x,x`). The store refuses `begin()` when the ally id, any
  ally-spawn instance id and any enemy instance id collide. It sets `error` to `{kind:'unexpected',
  operation:'fight:begin', message:'combatant id "<id>" is used twice — ids must be unique across both
  sides'}` and never calls `startCombat`. New spawn ids use one allocator over **both** rosters:
  `${statblockId}-${n}`, the smallest `n` unused on either side. Replay re-checks the same condition on
  `start` and returns `error`, never a merged fight.
- **CA-06 legacy compatibility.** A FightDoc without `allySpawns` still loads, lists and replays as
  `complete` (the existing `e2e/replay.spec.ts` records must pass unchanged).

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `src/shared/model.ts` | modify | `FightStartDoc.allySpawns?: { statblockId: string; instanceId: string }[]` (DB's name) |
| `src/main/storage.ts` | modify | Validate `start.allySpawns` when present |
| `src/renderer/src/engine/combat.ts` | modify | `SpawnSpec` (+`EnemySpec` alias), `FightStart.allySpawns`, `begin(rt, ally, enemies, allySpawns = [])` |
| `src/renderer/src/engine/replay.ts` | modify | Pass `rec.start.allySpawns ?? []`; CA-05 id check |
| `src/renderer/src/store/combat.ts` | modify | `allySpawns`, `addAllySpawn`, `removeAllySpawn`, shared id allocator, CA-05 refusal, `start.allySpawns`, record body |
| `src/renderer/src/views/fight/index.tsx` | modify | AlliesPanel: spawn rows + add/remove per `mocks/fight.html` |
| `src/renderer/src/views/fight/fight.css` | modify | Tokens-only |
| `tests/main/storage.test.ts` | modify | Accept valid/absent `allySpawns`; refuse malformed |
| `tests/engine/combat.test.ts` | modify | `begin` with ally spawns → `state.combatants[id].side === 'allies'`; order includes them |
| `tests/engine/replay.test.ts` | modify | Record with ally spawn → replay `complete`; legacy (no field) `complete`; duplicate ids → error |
| `tests/store/combat.test.ts` | modify | Allocator across sides; CA-05 refusal (no `startCombat` call, no log); record body carries the field only when non-empty; restart leg through the in-process bridge |
| `e2e/combat.spec.ts` | modify | Ally spawn in assembly and combat (lockstep with the reference fight) |
| `e2e/replay.spec.ts` | modify | Record with ally spawn → app restart → replay `complete` |

## Implementation

### Checkpoint 0 — recheck (no commit)
Read the AUTHOR-DB-CX commit in `specs/database.md` (field name, integrity rule, replay step). If it is
absent, return `blocked` (schema-change is DB's). Reproduce the duplicate-id probe and the multi-ally
`startCombat` probe (`.program/probe-combat2.mjs` pattern). Grep the affected-consumer list above. The
lease covers every file that references `FightStart`/`EnemySpec`/`start.enemies`. If grep finds one outside
the lease, stop and request a Controlled Lease Revision.

### Checkpoint 1 — contract: model + main + engine + replay
Change `model.ts`, `storage.ts`, `engine/combat.ts` and `engine/replay.ts`, with their unit tests.
`begin` keeps its current call shape for existing callers (default `[]`). Every existing test passes
unchanged, apart from mechanical `EnemySpec` → `SpawnSpec` renames if you do them.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass.

### Checkpoint 2 — store
Add `allySpawns: SpawnSpec[]`, `addAllySpawn(statblockId)`, `removeAllySpawn(instanceId)`, and the shared
allocator (`addEnemy` uses it too). `begin()`:
1. build `start` with `allySpawns` (a copy)
2. run the CA-05 check (refuse with an error and no fight)
3. `combat.begin(rt, ally, start.enemies, start.allySpawns)`

`record()` puts `allySpawns` in `record.start` only when non-empty. The world-change reset clears
`allySpawns` alongside `enemies`.
Store tests include the restart leg: record through the in-process bridge (real main handlers on a temp
dir, `tests/support/in-process-bridge.ts`), then a new store instance → `replay(name)` → `complete`.
**Commit when:** typecheck, lint and test pass.

### Checkpoint 3 — Fight assembly UI
AlliesPanel per `mocks/fight.html`:
- the character row (unchanged, `fight-ally`)
- spawn rows `fight-ally-spawn-<instanceId>` with meta `spawnMonster · <statblockId> · hp · ac · actions`
  (same source as the enemy rows) and remove button `fight-ally-spawn-remove-<instanceId>`
- add row `fight-add-ally` select + `fight-add-ally-submit`, the mock's "+ Add bestiary spawn…"

Keep existing ids and texts (`fight-ally` meta asserted by `e2e/combat.spec.ts:148`).
**Commit when:** typecheck, lint and test pass, and `pnpm build` exits 0 (under `e2e:out`).

### Checkpoint 4 — CAP-03 e2e
- `e2e/combat.spec.ts`, new test: Brynn + ally `hill-spider` vs 1 `barrow-wight` (dark-fantasy · 42).
  The reference fight in Node uses the same allies order. Assert:
  - the SESSION-01 turn order rows equal `ref.fight.state.order`
  - the spider's `combat-combatant-<id>` meta shows side `allies`
  - drive to `combat-over` in lockstep; the banner winner equals the reference `combat:ended` payload
- `e2e/replay.spec.ts`, new test (or a new step in CAP-10's flow if it reads cleaner):
  1. record the ally-spawn fight
  2. restart the app on the **same** userData (the pattern the spec already uses)
  3. replay → `complete`
  4. read the stored JSON from userData and assert `start.allySpawns` equals `[{statblockId:'hill-spider',
     instanceId:'hill-spider-1'}]` (or the allocator's actual id; assert against what the UI showed)
- Negative controls (not committed): drop `allySpawns` from the stored file → replay `diverged`. Restore.
  Duplicate ids through the store test only (the UI cannot create them).

Run `pnpm verify`. Record the build identity.
**Commit when:** `pnpm verify` exits 0.

## Verification
- Per checkpoint: `pnpm typecheck && pnpm lint && pnpm test`. Checkpoint 3: `pnpm build`. Checkpoint 4:
  `pnpm verify` (holds `e2e:out`).
- Integration proof CAP-03 (CA-04b/05/06):
  - Unit leg: `tests/store/combat.test.ts` with the real main handlers through `in-process-bridge` on a
    temp dir (write → new store → load → replay).
  - Packaged leg: the built app via `e2e/fixtures.ts` (`_electron`, isolated temp userData). Restart reuses
    that userData dir, as `e2e/replay.spec.ts` CAP-10 does today. Check the fixture's restart mechanism at
    checkpoint 0 and do not assume it.
  - Real pieces: engine, main storage, IPC bridge, preload. No provider fixtures are involved.
  - Freshness: `global-setup.ts` build identity recorded.
- Custom Rule 8: `model.ts` changes only as DB wrote it. Custom Rule 7: no paths cross IPC.

## State Update
Report: the DB revision and field name used, CA-04b/05/06 evidence, the stored-JSON assertion output, the
negative-control results, and the build identity. Arch deltas: M01 (field), M02 (validation), M06
(`SpawnSpec`, `begin` signature), M09 (ally roster), M14 (Allies panel). Report new test ids.
