# SESSION-04 — Both-sided fight assembly: ally-side bestiary spawns, placed, recorded and replayed

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete (plan rev 2; this was SESSION-02 in rev 1)
> **Modules:** M01, M02, M06, M09, M14, M17
> **Depends on:** SESSION-03; human Q1 = (a); AUTHOR-DB-CX (`allySpawns` part) committed to `specs/database.md`
> **Concurrent with:** —
> **Owns:** `src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/combat.ts`, `src/renderer/src/engine/replay.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/index.tsx`, `src/renderer/src/views/fight/fight.css`, `tests/main/storage.test.ts`, `tests/engine/combat.test.ts`, `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts`, `e2e/replay.spec.ts`
> **Reads:** `program/ruleswright-ui/specs/database.md`, `program/ruleswright-ui/specs/requirements.md` (FR-11, FR-14), `program/ruleswright-ui/mocks/fight.html`, `program/ruleswright-ui/specs/design.md`, `src/main/ipc.ts`, `src/renderer/src/views/fight/records.tsx`, `tests/support/in-process-bridge.ts`, `e2e/fixtures.ts`
> **Resources:** `e2e:out` (checkpoints 3–4)
> **Checkpoints:** 4

**On Q1 = (c)** mark `skipped`. **On Q1 = (b)** Planner trims this to checkpoints 2–3 plus a record refusal.

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | shared | `model.ts` | `FightStartDoc.allySpawns?` — only as DB wrote it (Custom Rule 8) |
| M02 | main | `storage.ts` FightDoc `start` validation | Validate the field |
| M06 | engine | `combat.ts`, `replay.ts` | `begin` takes ally spawns (they join `sides.allies`, so reposition re-states them) |
| M09 | store | `combat.ts` | Ally roster; one id allocator over both sides (CA-05); default layout includes ally spawns |
| M14 | views/fight | `index.tsx`, `fight.css` | Allies panel "+ Add bestiary spawn…" (already in `mocks/fight.html`); placement board lists them (SESSION-02 board is roster-driven) |
| M17 | tests | six files | Proofs |

## Context
FR-11: "either side may hold multiple bestiary-spawned combatants"; the fight mock draws "+ Add bestiary
spawn…" on the ally side. `startCombat` takes any number of allies. Recording needs `start.allySpawns`
(AUTHOR-DB-CX, Q1 = a). **Use DB's committed field name** (`allySpawns` is the proposal).

## Capabilities
- **CAP-03 Ally-side spawns (owned here, complete).** Fight → Allies panel → add spawn → placement (grid
  worlds) → Begin → Combat (SESSION-03 panels show them on `allies`) → reposition includes them → Record →
  restart → replay `complete`.
- Order matters: initiative ties break by declaration order (`combat.ts` `tieBreaker`), so `[character,
  ...allySpawns]` order is part of the contract; `sides.allies` keeps it for the restore seam.

## Contract Agreements
- **CA-04b FightStart allies (provisional against AUTHOR-DB-CX; recheck its text at checkpoint 0).**
  | Boundary | Mapping |
  |---|---|
  | store → engine | `FightStart.allySpawns: SpawnSpec[]` (`EnemySpec` → `SpawnSpec`, keep `export type EnemySpec = SpawnSpec`) |
  | engine → library | `allies: [{id: ally.profile.id, ...ally}, ...allySpawns.map(s => ({id: s.instanceId, profile: spawnMonster(rt, s.statblockId, s.instanceId)}))]`; `sides.allies` in the same order |
  | store → IPC | `record.start.allySpawns` only when non-empty |
  | main | array of `{statblockId: string, instanceId: string}`, else a named refusal |
  | replay | `rec.start.allySpawns ?? []` |
- **CA-05 unique combatant ids.** The engine merges duplicate ids silently (EG-1), and positions are keyed by
  id. `begin()` refuses any collision among the ally id, ally-spawn ids and enemy ids with
  `{kind:'unexpected', operation:'fight:begin', message:'combatant id "<id>" is used twice — ids must be unique
  across both sides'}` and never calls `startCombat`. One allocator over both rosters: `${statblockId}-${n}`,
  smallest unused `n` on either side. Replay re-checks it and returns `error`.
- **CA-06 legacy compatibility.** FightDocs without `allySpawns` load, list and replay as before.
- **CA-12 (S01) extended.** The default layout puts ally spawns in the allies column after the character,
  in roster order.

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `src/shared/model.ts` | modify | `FightStartDoc.allySpawns?` (DB's name) |
| `src/main/storage.ts` | modify | Validate it when present |
| `engine/combat.ts` | modify | `SpawnSpec`; `FightStart.allySpawns`; `begin(rt, ally, enemies, positions?, allySpawns = [])` (append the parameter; S01's order stays) |
| `engine/replay.ts` | modify | Pass `allySpawns ?? []`; CA-05 check |
| `store/combat.ts` | modify | `allySpawns`, `addAllySpawn`, `removeAllySpawn`, shared allocator, CA-05, layout, record body, world reset |
| `views/fight/index.tsx`, `fight.css` | modify | AlliesPanel spawn rows + add/remove per `mocks/fight.html` |
| tests (4 unit + 2 e2e) | modify | As below |

## Implementation

### Checkpoint 0 — recheck (no commit)
Read the AUTHOR-DB-CX `allySpawns` text. Absent → `blocked`. Grep `FightStart`/`EnemySpec`/`start.enemies`
consumers; any outside the lease → Controlled Lease Revision request.

### Checkpoint 1 — model + main + engine + replay
With unit tests: storage accepts valid/absent, refuses malformed; `begin` with a `hill-spider` ally spawn →
`side 'allies'`, in `order`; a reposition re-states it (CA-13 equality list holds for it); replay of a record
with an ally spawn → `complete`; legacy record → unchanged result; duplicate ids → `error`.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass.

### Checkpoint 2 — store
Roster actions, allocator (used by `addEnemy` too), CA-05 refusal (no `startCombat` call, no log rows),
layout, `record()` body. Restart leg via `tests/support/in-process-bridge.ts`: record → new store → replay
`complete`.
**Commit when:** unit gates pass.

### Checkpoint 3 — Fight assembly UI
Rows `fight-ally-spawn-<instanceId>` (meta `spawnMonster · <statblockId> · hp · ac · actions`, same source as
enemy rows), remove `fight-ally-spawn-remove-<instanceId>`, add `fight-add-ally` + `fight-add-ally-submit`.
Keep `fight-ally` and its meta text. The placement board lists the spawn with no board change.
**Commit when:** unit gates pass and `pnpm build` exits 0 (`e2e:out`).

### Checkpoint 4 — CAP-03 e2e
- `e2e/combat.spec.ts`: Brynn + `hill-spider` vs 1 `barrow-wight` (grid, positions read from the board): order
  rows = `ref.fight.state.order`; spider shows `allies`; drive to `combat-over` in lockstep; banner winner =
  reference `combat:ended` payload.
- `e2e/replay.spec.ts`: record, `rw.restart()`, replay `complete`; stored `start.allySpawns` equals what the UI
  showed.
- Negative control (not committed): delete `allySpawns` from the stored file → replay `diverged` (or the
  library's refusal, since the spider's position then names a missing combatant — record which); restore.
**Commit when:** `pnpm verify` exits 0 (record build identity).

## Verification
Unit gates per checkpoint; build at 3; `pnpm verify` at 4. Integration proof CAP-03 (CA-04b/05/06): unit
restart leg over real main handlers; packaged leg through `e2e/fixtures.ts` (isolated userData, restart on the
same dir). Custom Rules 7, 8.

## State Update
DB revision + name used; CA evidence; stored-JSON assertion output; negative control; build identity. Arch
deltas M01, M02, M06 (`SpawnSpec`, `begin` signature), M09, M14. New test ids.
