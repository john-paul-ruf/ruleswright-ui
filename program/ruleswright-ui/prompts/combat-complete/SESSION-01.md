# SESSION-01 — Grid spine: positions, reposition, record/replay, unit gates green again

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete (plan rev 2)
> **Modules:** M01, M02, M06, M09, M17
> **Depends on:** human Q4 = (a); AUTHOR-DB-CX committed to `specs/database.md` (the `positions` / `move` parts)
> **Concurrent with:** —
> **Owns:** `src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/combat.ts`, `src/renderer/src/engine/replay.ts`, `src/renderer/src/store/combat.ts`, `tests/main/storage.test.ts`, `tests/engine/combat.test.ts`, `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`
> **Reads:** `program/ruleswright-ui/PROGRAM-CONFIG.MD`, `program/ruleswright-ui/specs/database.md`, `program/ruleswright-ui/specs/requirements.md` (FR-11, FR-14), `program/ruleswright-ui/prompts/combat-complete/AUTHOR-REQUEST-CX.md`, `program/ruleswright-ui/arch/M06-engine.md`, `node_modules/ruleswright/dist/runtime.d.ts`, `node_modules/ruleswright/dist/schema.d.ts`, `../Ruleswright/src/runtime/combat/combat.ts`, `../Ruleswright/src/runtime/snapshots.ts`, `src/main/ipc.ts`, `src/renderer/src/views/fight/index.tsx`, `src/renderer/src/views/combat/*.tsx`, `tests/support/in-process-bridge.ts`, `.program/probe-grid.mjs`, `.program/probe-grid2.mjs`
> **Resources:** —
> **Checkpoints:** 3

**On Q4 = (b)** this prompt does not apply: Planner replans SESSION-01 as a test repair that proves the
refusal (grid pack → `E-SPAT-01` cards at `begin`, theater path on a spatial-stripped pack).

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M01 | shared | `model.ts` | `FightStartDoc.positions?`, `FightScriptEntry` `move` — **only as AUTHOR-DB-CX wrote them** (Custom Rule 8) |
| M02 | main | `storage.ts` FightDoc validation (`'script' in doc` ~l.142, `'start' in doc` ~l.157) | Accept the DB-approved shapes; refuse malformed ones by name |
| M06 | engine | `combat.ts`, `replay.ts` | Positions into `startCombat`; the reposition seam; `move` in scripts; replay |
| M09 | store | `combat.ts` | Placement state, default layout, `move`, record body |
| M17 | tests | four unit files | Repair the 18 red tests + the typecheck error; new proofs |

## Context
Engine `dadf461` (feature `grid-combat`) makes every bundled theme emit a grid, and `startCombat` refuses a
spatial pack unless every combatant has a position (AUTHOR-REQUEST-CX, "What changed"). The UI's `begin`
passes none, so combat is dead on every new world, and the unit gates are red: `pnpm test` 181/199 (18
failing in `tests/{engine/combat,engine/replay,store/combat}.test.ts`), `pnpm typecheck` fails at
`tests/engine/combat.test.ts:119` (old `{defaultReach: 1}` spatial shape vs `SpatialDef`). This session
restores a working, recorded, replayable grid fight **below the views**, and repairs those gates. Views
(placement board, combat board) are SESSION-02; until then the store fills the default layout so the
existing Fight → Begin button works again with no view change.

Engine surface used (all verified in the installed `runtime.d.ts` / `schema.d.ts` at plan time):
`startCombat` (`StartCombatRequest.positions?`), `serializeCombat`, `deserializeCombat`,
`CombatRestoreRequest` (`positions?`), `type Position`, `Runtime.spatial` (`distance`), `type SpatialDef`
(from `ruleswright/schema`).

## Capabilities
- **CAP-06 Grid fight (producer + unit integration here; views + packaged proof in SESSION-02).**
  Path: store roster → `positions` (default layout, editable through `setPosition`) → `engine.begin(rt, ally,
  enemies, positions)` → `startCombat({…, positions})` → `fight.state.combatants[id].position`. Reposition:
  `store.move(positions)` → `engine.reposition(live, positions)` → `serializeCombat` → `deserializeCombat`
  with the begin-time sides, **live** balances and the new positions → the store swaps `fight`. Durable:
  `record()` → FightDoc `start.positions` + `script` `move` entries (+ `combat` with positions, verbatim) →
  main validation → disk → `fight:load` → `replay` → `complete`.
- **Theater path stays.** Packs without `spatial` (worlds forged before `dadf461`, imported packs) begin with
  no positions and never offer reposition. Proof uses a generated pack with the `spatial` key deleted — the
  exact shape of such a world — the same technique the engine's own journey uses for theater parity.

## Contract Agreements
Recheck each at checkpoint 0 against `database.md` (AUTHOR-DB-CX) and the installed dist.

- **CA-12 positions are host input, passed verbatim.** `Position = {x, y}` integers. `begin` passes the map
  unchanged to `startCombat`; the library decides everything (refusal cards, reach, validity). The UI never
  computes reach (`reachOf` is private; EG-4) and never forbids shared squares or bounds the grid (the engine
  does neither). Default layout (store, CX-D9): allies `x=0`, enemies `x=1`, `y` = index within that side's
  roster, in roster order (character first). **If AUTHOR-DESIGN-CX has landed, use its default instead.**
  Theater packs: `positions` is `null` and nothing is passed.
- **CA-13 reposition seam.** `reposition(live, positions)`:
  1. precondition (host pacing, CX-D10): `live.fight.state.phase === 'awaiting-declare'` and
     `live.fight.pendingTriggers.length === 0` and the pack declares spatial; otherwise
     `{kind:'unexpected', operation:'combat:move', message:'…'}` naming which condition failed. Reason: the
     engine's restore returns `awaiting-declare` even after a declare, which would grant a second action
     (probe-grid2), and `serializeCombat` keeps one offer per combatant (EG-6).
  2. `snap = serializeCombat(live.fight, {pairsWith: live.sides.allies[0].id})`
  3. `deserializeCombat(rt, snap, {allies, enemies, positions})` where each side entry is the begin-time
     `{id, profile}` plus `balances: {pools, boundSlots}` read from `live.fight.state.combatants[id]`
     (library values, copied, no arithmetic).
  4. library throw → `toAppError('combat:move', e)`; success replaces `live.fight`.
  Proof: rng words, hp, `slots.remaining`, conditions, pools, boundSlots, `order`, `turn`, `active`,
  `round` of the new fight equal the old; only `position`s differ; **zero events** emitted by the move.
- **CA-14 recorded placement + moves (provisional against AUTHOR-DB-CX — use its committed names).**
  | Boundary | Mapping |
  |---|---|
  | store → engine | `FightStart.positions?: Record<string, Position>`; `ScriptEntry` gains `{op:'move'; positions: Record<string, Position>}` (the complete map after the move) |
  | store → IPC | `record.start.positions` written **only** on spatial packs; `move` entries in `script` in call order |
  | main | `start.positions`: object of `{x: integer, y: integer}`; `script[i].op === 'move'` with the same `positions` shape; anything else → a named refusal in the existing style (`script[i] is not a valid declare/respond/step/move entry`) |
  | replay | `begin(…, rec.start.positions)`; `perform` re-applies `move` through `reposition`. A spatial pack with no `start.positions` → the library's `E-SPAT-01` refusal as `{status:'error'}`, never guessed |
  `declarations` stay derived from declare calls only (`move` is not a declaration).
- **CA-07b (existing CA-09 replay rule) unchanged in meaning:** re-roll → pack divergence first; events
  compared index by index. A move emits no events, so a tampered `move` shows up as the first later event that
  differs (e.g. a reach rejection instead of an `attack:rolled`).

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `src/shared/model.ts` | modify | `FightStartDoc.positions?`, `FightScriptEntry` `move` variant — DB's names |
| `src/main/storage.ts` | modify | Validate both; extend the script-entry refusal text |
| `src/renderer/src/engine/combat.ts` | modify | `Position`/`SpatialDef` re-exports; `LiveFight`; `begin(rt, ally, enemies, positions?)` → `Outcome<LiveFight>`; `reposition`; `perform(live, entry)`; `spatialOf(pack)`; `distance(rt, a, b)`; `spatialLabel` typed (drop the `as unknown as` cast now that `Pack.spatial` is typed) |
| `src/renderer/src/engine/replay.ts` | modify | Positions + `move` through the shared `perform`; `recordingOf` unchanged in shape except `start.positions` |
| `src/renderer/src/store/combat.ts` | modify | `positions: Record<string, Position> \| null`, `setPosition`, default layout on roster change, `begin` with positions, `move(positions)`, `live` handle, record body |
| `tests/engine/combat.test.ts` | modify | Fix l.119 to the `SpatialDef` shape; repair begin-based tests on grid packs with explicit positions; new cases below |
| `tests/engine/replay.test.ts` | modify | Repair on grid packs; move cases |
| `tests/store/combat.test.ts` | modify | Repair; placement/move/record cases; restart leg |
| `tests/main/storage.test.ts` | modify | Accept/refuse the new shapes |

## Implementation

### Checkpoint 0 — recheck (no commit)
1. Read the AUTHOR-DB-CX commit (field names, integrity rule, replay step). Absent → return `blocked`.
2. `node .program/probe-grid.mjs` and `node --max-old-space-size=512 .program/probe-grid2.mjs`: reproduce
   the refusal cards, the `valid`/`spatial` rejection events, and the restore facts (phase, zero events, rng
   equal). If any differs, stop and report — the engine moved again.
3. `pnpm exec vitest run` → record the exact red set (expected: the 18 tests named in STATE Verification
   Baseline). `pnpm typecheck` → expected the single error at `tests/engine/combat.test.ts:119`.
4. Grep consumers of `begin(`, `perform(`, `FightStart`, `ScriptEntry` under `src/` and `tests/`. The views
   (`views/fight/index.tsx`, `views/combat/*.tsx`) call only store actions (`begin()`, `declare`, `step`,
   `respond`) — verify that no view touches `fight`/`perform` directly. If one does, request a Controlled Lease
   Revision rather than editing outside the lease.

### Checkpoint 1 — engine: positions, reposition, typed spatial
```ts
// engine/combat.ts (additions; keep every existing export)
import { deserializeCombat, serializeCombat, /* existing */ } from 'ruleswright/runtime';
import type { Pack, SpatialDef } from 'ruleswright/schema';
export type { Position, CombatRestoreRequest } from 'ruleswright/runtime';
export type { SpatialDef } from 'ruleswright/schema';

/** The sides exactly as `startCombat` took them (the restore seam re-states them). */
export interface Sides { allies: { id: string; profile: CombatantProfile }[]; enemies: { id: string; profile: CombatantProfile }[] }
/** A running fight plus what re-positioning needs; `fight` is replaced by a move. */
export interface LiveFight { fight: Combat; sides: Sides }

export function begin(rt: Runtime, ally: AllyCombatant, enemies: readonly EnemySpec[],
  positions?: Readonly<Record<string, Position>>): Outcome<LiveFight>;
/** FR-11 (rev 2), CA-13: host repositioning through the engine's serialize → restore seam. */
export function reposition(live: LiveFight, positions: Readonly<Record<string, Position>>): Outcome<Combat>;
/** Re-issue one recorded host call; `move` replaces `live.fight`. */
export function perform(live: LiveFight, entry: ScriptEntry): Outcome<unknown>;
/** FR-11: the pack's spatial section verbatim, or null (theater-of-mind). */
export function spatialOf(pack: Pack): SpatialDef | null;
/** FR-11: the library's grid distance (`rt.spatial.distance`), never computed UI-side. */
export function distance(rt: Runtime, a: Position, b: Position): number;
```
`begin` keeps the ally's initial `balances` in the call to `startCombat` exactly as today; `sides` stores
`{id, profile}` only (balances are read live at move time, CA-13).

Tests (`tests/engine/combat.test.ts`), all on the installed engine, no hand-written events:
- l.119 fix: `spatialLabel({...pack, spatial: {model:'grid', reach:{default:1}}})` → `'grid'`; the generated
  dark-fantasy·42 pack → `'grid'`; the same pack with `spatial` deleted → `'theater-of-mind'`.
- grid pack, `begin` with no positions → `ok:false`, `error.kind 'library'`, one `E-SPAT-01` card per
  combatant with `jsonPath positions.<id>` (fail-closed proof).
- grid pack, positions far apart → declaring `cut-down` yields `declare:rejected` `kind 'valid'`; a
  non-`valid` melee action (e.g. zombie-urban `shambler-claw`) yields `kind 'spatial'`, `why.rule
  'E-SPAT-01'`; state unchanged in both (deep-equal before/after).
- reposition (CA-13): the full equality list, zero events, and the three precondition refusals
  (after a declare; with an offer open; on a theater pack).
- Every previously green behavior test (determinism, slot-exhausted, declare returns own events, full fight to
  `combat-over`, zombie-urban ends) re-run on grid packs with positions **one step apart** (the default
  layout), plus one theater-path run on a spatial-stripped pack. Preserve each test's assertion; only its setup
  changes.

**Commit when:** `pnpm typecheck && pnpm lint && pnpm exec vitest run tests/engine/combat.test.ts` pass.
(Whole-repo `pnpm test` is still red in replay/store until checkpoints 2–3; say so in the commit body.)
Message: `combat-complete SESSION-01: checkpoint 1 — positions into startCombat, reposition seam, typed spatial`.

### Checkpoint 2 — replay carries placement and moves
`replay.ts`: `begin(rt, profile, rec.start.enemies, rec.start.positions)`; the script loop calls
`perform(live, entry)`. Extract nothing else; `replay`'s result shape is unchanged.
Tests (`tests/engine/replay.test.ts`, repaired on grid packs): record a fight with one `move` → replay
`complete`; tamper the `move`'s positions (far apart) → `diverged` at the first differing event; a spatial-pack
record without `start.positions` → `{status:'error'}` whose cards are `E-SPAT-01`; the existing pack-byte,
swapped-entries, null-params and legacy-no-script cases preserved.
**Commit when:** typecheck, lint and `pnpm exec vitest run tests/engine` pass.

### Checkpoint 3 — model + main + store; whole-repo unit gates green
- `model.ts`, `storage.ts` per CA-14 (DB's names). Storage tests: valid positions/move accepted and preserved
  on load; non-integer coordinate, missing `y`, `move` without `positions` each refused by name.
- Store: `positions` recomputed to the default layout whenever the roster changes (enemy add/remove, world
  change) on a spatial pack, `null` on a theater pack; `setPosition(id, pos)` for SESSION-02's board;
  `begin()` passes `positions` and captures `start.positions`; `move(positions)` runs `reposition`, appends
  `{op:'move', positions}` to `script`, republishes; `record()` writes `start.positions` only on spatial packs.
  Views are untouched: Fight → Begin now works again with the default layout.
- Store tests (repaired + new): the log/filters/rejection cases on a grid world with default layout; a
  move → `script` entry + no log rows; move refusals surface as `error`; **restart leg** through the real
  main handlers (`tests/support/in-process-bridge.ts`, temp dir): record a fight with a move → new store
  instance → `replay(name)` → `complete`; the stored JSON's `start.positions` equals what `begin` passed.
- Negative control (not committed): drop one entry from the default layout → the store test asserting
  begin succeeds fails with the library's `E-SPAT-01` card; restore.

**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` all pass (whole repo, 0 failures).

## Verification
- Checkpoint gates as above. No `pnpm e2e` in this session: `e2e/combat.spec.ts` and `e2e/replay.spec.ts`
  stay in the known red window (STATE Verification Baseline) until SESSION-02 checkpoint 3. Do not edit them.
- Integration proof CAP-06 unit leg: `tests/store/combat.test.ts` restart leg — real engine, real main
  storage handlers over the in-process bridge on a temp dir; no fixtures stand in for the library.
- Custom Rule 2: no arithmetic on positions or reach. Custom Rule 8: `model.ts` only as DB wrote it.
  Custom Rule 1: `grep -rn "from 'ruleswright" src/renderer/src --include=*.ts* | grep -v /engine/` empty.

## State Update
Report: the DB revision and names used; the c0 red set vs the baseline; CA-12/13/14 evidence (test names,
commits); the negative control; any view that needed a lease revision. Arch deltas: M01 fields, M02
validation, M06 (`LiveFight`, `Sides`, `begin` result type, `reposition`, `perform` signature, `spatialOf`,
`distance`, `spatialLabel` typed), M09 (`positions`, `setPosition`, `move`). Known window: e2e red until S02.
