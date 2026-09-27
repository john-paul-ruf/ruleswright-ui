# SESSION-03 — Encounter assembly by threat budget

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete
> **Modules:** M06, M09, M14, M17
> **Depends on:** SESSION-02; AUTHOR-SPEC-CX (Q2 = a) + AUTHOR-DESIGN-CX (Q2 part) committed
> **Concurrent with:** —
> **Owns:** `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/index.tsx`, `src/renderer/src/views/fight/fight.css`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts`
> **Reads:** `program/ruleswright-ui/specs/requirements.md` (FR-11 amended), `program/ruleswright-ui/specs/design.md`, `program/ruleswright-ui/mocks/fight.html`, `../Ruleswright/src/runtime/encounter.ts`, `node_modules/ruleswright/dist/runtime.d.ts`, `src/renderer/src/views/character/inventory.tsx` (the seed ⟳ pattern), `e2e/fixtures.ts`
> **Resources:** `e2e:out` (checkpoint 3 only)
> **Checkpoints:** 3

**Skip this session entirely if the human answers Q2 = (b).** Orchestrator marks it `skipped` and CAP-04 is
removed by an approved scope change.

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M06 | engine | `combat.ts` | `assemble()` over `assembleEncounter` + `spawnEncounter` |
| M09 | store | `combat.ts` | `assembleEnemies(budget, seed)`, encounter summary, CA-05 ids |
| M14 | views/fight | `index.tsx`, `fight.css` | "Assemble by threat" row + summary |
| M17 | tests | three files | Proofs |

## Context
The engine assembles an enemy side from a threat budget, deterministically per seed
(`assembleEncounter(rt, {budget, seed})`, heuristic `threat-weighted-uniform`, max 12 bodies), and spawns
it with `spawnEncounter`. It throws `Error('encounter assembly needs at least one bestiary statblock
(FR-16).')` on an empty bestiary. Probe (dark-fantasy · 42, budget 3, seed 7): `groups [{barrow-wight ×1}]`,
threat 3. zombie-urban · 42, same inputs: `grave-shambler ×2`.

## Capabilities
- **CAP-04 Encounter assembly (owned here, complete).** Entry: Fight → Enemies panel → budget + seed (typed
  or ⟳) → Assemble. Path: `store.assembleEnemies(budget, seed)` → `engine.assemble(rt, budget, seed)` →
  library → `{encounter, spawns}` → enemy roster replaced (when `groups` is non-empty) → Begin combat (the
  existing path). Durable: the roster is a plain `SpawnSpec[]`, so `FightDoc.start.enemies` records and
  replays it with **no DB change**. The encounter seed is user-initiated randomness (the Constraints line as
  amended by AUTHOR-SPEC-CX).

## Contract Agreements
- **CA-07 encounter pairing.** `spawnEncounter` returns profiles whose `id` is the instance id. The
  `statblockId` for each is paired by expanding `encounter.groups` in order (`group.id` repeated
  `group.count` times). This follows the library's own loop (`encounter.ts`). The **instance id always comes
  from the returned `profile.id`** and is never rebuilt by the UI. Proof: for every pair,
  `spawnMonster(rt, statblockId, instanceId)` deep-equals the returned profile. If lengths differ, return an
  `unexpected` error and never guess.
- **CA-08 verbatim summary.** Render `groups` (`id ×count`), `threat`, `budget`, `seedUsed`, `heuristic`
  exactly as the library returned them. Library throw → `toAppError('fight:assemble', e)` → ErrorCard.
  Empty `groups` (budget below the cheapest threat) → show the summary and leave the roster unchanged
  (CX-D5).
- **CA-05 (from SESSION-02) holds.** Assembled instance ids that collide with an ally-spawn id → refuse the
  assembly with the CA-05 message and leave the roster unchanged.
- Budget/seed input: numbers only. Budget accepts decimals (threats like 1.5 exist). An unparseable field
  disables Assemble. The UI does no range judgement beyond "is a finite number".

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `src/renderer/src/engine/combat.ts` | modify | Import `assembleEncounter`, `spawnEncounter`, type `Encounter`. `assemble(rt, budget, seed): Outcome<{encounter: Encounter; spawns: SpawnSpec[]}>` |
| `src/renderer/src/store/combat.ts` | modify | `encounter: Encounter \| null`, `assembleEnemies(budget, seed)`; world reset clears it |
| `src/renderer/src/views/fight/index.tsx` | modify | Assemble row per AUTHOR-DESIGN-CX (`fight-assemble-budget`, `fight-assemble-seed`, `fight-assemble-seed-randomize`, `fight-assemble`, `fight-encounter-summary`) |
| `src/renderer/src/views/fight/fight.css` | modify | Tokens-only |
| `tests/engine/combat.test.ts` | modify | Probe cases, CA-07 pairing, determinism (same seed → same spawns), empty-bestiary error shape |
| `tests/store/combat.test.ts` | modify | Roster replaced; empty groups leave the roster alone; collision refusal; record → replay `complete` with an assembled roster |
| `e2e/combat.spec.ts` | modify | CAP-04 journey |

## Implementation

### Checkpoint 0 — recheck (no commit)
Read the amended FR-11 criterion and the design rows. If either is absent, return `blocked`. Reproduce both
probe results with `.program/` scratch. Confirm `assembleEncounter`, `spawnEncounter` and `Encounter` in
the installed `runtime.d.ts`.

### Checkpoint 1 — engine + store
```ts
/** FR-11 (amended): threat-budget assembly, verbatim; spawns paired by the library's group order (CA-07). */
export function assemble(rt: Runtime, budget: number, seed: number): Outcome<{ encounter: Encounter; spawns: SpawnSpec[] }>;
```
Store `assembleEnemies(budget, seed)` sets `encounter` and, when `spawns.length > 0` and CA-05 holds,
`enemies = spawns`. Errors go to `error`.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass.

### Checkpoint 2 — UI
The Enemies panel row per AUTHOR-DESIGN-CX. The ⟳ copies the `inventory.tsx` pattern
(`crypto.getRandomValues(new Uint32Array(1))[0]`, user-initiated only). The summary line goes in
`fight-encounter-summary`. Keep every existing `fight-*` id.
**Commit when:** typecheck, lint and test pass, and `pnpm build` exits 0 (under `e2e:out`).

### Checkpoint 3 — CAP-04 e2e
dark-fantasy · 42, Brynn:
1. type budget `3`, seed `7` → Assemble
2. `fight-encounter-summary` contains the reference `assembleEncounter` result's `groups`/`threat`/`seedUsed`
   verbatim, computed in Node by the spec
3. the enemy rows equal the reference `spawnEncounter` ids
4. Begin → `combat-order` rows equal the reference `startCombat` order
5. record → restart → replay `complete`

Negative control (not committed): seed `8` in the reference only → the assertion fails.
**Commit when:** `pnpm verify` exits 0.

## Verification
- Per checkpoint: `pnpm typecheck && pnpm lint && pnpm test`. Checkpoint 2: build. Checkpoint 3:
  `pnpm verify` under `e2e:out`.
- Integration proof CAP-04 (CA-07/08/05): the built app via `e2e/fixtures.ts` (isolated userData, `restart()`
  on the same dir). The Node reference uses the installed engine on the pack the spec reads from userData
  (`worlds/<id>/pack.json`, as `e2e/replay.spec.ts` does). The build identity is recorded.

## State Update
Report: the Spec/Design revisions, CA-07 pairing proof, the probe values reproduced, the negative control,
and the build identity. Arch delta: M06 `assemble`, M09 `encounter`/`assembleEnemies`, M14 row. Report new
test ids.
