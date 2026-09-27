# SESSION-05 — Encounter assembly by threat budget

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete (plan rev 2; this was SESSION-03 in rev 1)
> **Modules:** M06, M09, M14, M17
> **Depends on:** SESSION-04 (or SESSION-03 when SESSION-04 is `skipped`); human Q2 = (a); AUTHOR-SPEC-CX + AUTHOR-DESIGN-CX (Q2 parts) committed
> **Concurrent with:** —
> **Owns:** `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/index.tsx`, `src/renderer/src/views/fight/fight.css`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts`
> **Reads:** `program/ruleswright-ui/specs/requirements.md` (FR-11 amended), `program/ruleswright-ui/specs/design.md`, `program/ruleswright-ui/mocks/fight.html`, `../Ruleswright/src/runtime/encounter.ts`, `node_modules/ruleswright/dist/runtime.d.ts`, `src/renderer/src/views/character/inventory.tsx` (the seed ⟳ pattern), `e2e/fixtures.ts`
> **Resources:** `e2e:out` (checkpoints 2–3)
> **Checkpoints:** 3

**On Q2 = (b)** Orchestrator marks this `skipped`; CAP-04 leaves scope by approved decision.

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M06 | engine | `combat.ts` | `assemble()` over `assembleEncounter` + `spawnEncounter` |
| M09 | store | `combat.ts` | `assembleEnemies(budget, seed)`, `encounter`, CA-05, default layout refresh |
| M14 | views/fight | `index.tsx`, `fight.css` | Assemble-by-threat row + summary |
| M17 | tests | three files | Proofs |

## Context
`assembleEncounter(rt, {budget, seed})` (heuristic `threat-weighted-uniform`, ≤ 12 bodies, deterministic per
seed) + `spawnEncounter`. Empty bestiary → `Error('encounter assembly needs at least one bestiary statblock
(FR-16).')`. Probe (rev 1, unchanged files since): dark-fantasy·42 budget 3 seed 7 → `barrow-wight ×1`;
zombie-urban·42 → `grave-shambler ×2`. Reconfirm at checkpoint 0 (the bestiary did not change in `dadf461`,
but the pack bytes did).

## Capabilities
- **CAP-04 Encounter assembly (owned here, complete).** Fight → budget + seed (typed or ⟳) → Assemble →
  roster replaced when `groups` is non-empty → default layout refreshed on grid worlds (S01 CA-12) → Begin.
  Durable with no DB change: the roster is a `SpawnSpec[]` in `start.enemies`; positions in `start.positions`.

## Contract Agreements
- **CA-07 encounter pairing.** Instance ids come from the returned `profile.id` only; statblock ids by
  expanding `encounter.groups` in order (the library's own loop). Proof: `spawnMonster(rt, statblockId,
  instanceId)` deep-equals each returned profile. Length mismatch → `unexpected` error, never a guess.
- **CA-08 verbatim summary.** `groups` (`id ×count`), `threat`, `budget`, `seedUsed`, `heuristic`. Throw →
  `toAppError('fight:assemble', e)`. Empty `groups` → summary shown, roster unchanged (CX-D5).
- **CA-05 holds.** Collision with an ally-spawn id → refuse, roster unchanged.
- Inputs: finite numbers only (budget may be decimal); anything else disables Assemble.

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `engine/combat.ts` | modify | Import `assembleEncounter`, `spawnEncounter`, type `Encounter`; `assemble(rt, budget, seed): Outcome<{encounter; spawns: SpawnSpec[]}>` |
| `store/combat.ts` | modify | `encounter`, `assembleEnemies`; world reset clears it; layout refresh |
| `views/fight/index.tsx`, `fight.css` | modify | `fight-assemble-budget`, `fight-assemble-seed`, `fight-assemble-seed-randomize`, `fight-assemble`, `fight-encounter-summary` |
| tests | modify | Probe cases, CA-07, determinism, empty-bestiary error; store roster/refusal/record→replay; e2e |

## Implementation
### Checkpoint 0 — recheck (no commit)
Amended FR-11 + design rows present, else `blocked`. Reproduce both probes. Confirm the three exports in
`runtime.d.ts`.
### Checkpoint 1 — engine + store
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass.
### Checkpoint 2 — UI
⟳ copies `inventory.tsx` (`crypto.getRandomValues(new Uint32Array(1))[0]`, user-initiated). Keep every
existing `fight-*` id. **Commit when:** unit gates pass and `pnpm build` exits 0 (`e2e:out`).
### Checkpoint 3 — CAP-04 e2e
dark-fantasy·42, Brynn: budget 3, seed 7 → summary equals the Node reference `assembleEncounter` result;
enemy rows = reference `spawnEncounter` ids; the placement board shows them; Begin → `combat-order` =
reference `startCombat` order (reference uses the board's positions); record → restart → replay `complete`.
Negative control (not committed): seed 8 in the reference only → fails. **Commit when:** `pnpm verify` exits 0.

## Verification
Unit gates; build at 2; `pnpm verify` at 3. Packaged proof via `e2e/fixtures.ts` (isolated userData,
`restart()`); Node reference on the pack read from `worlds/<id>/pack.json`; build identity recorded.

## State Update
Spec/Design revisions; CA-07 proof; probe values; negative control; build identity. Arch: M06 `assemble`, M09
`encounter`/`assembleEnemies`, M14 row. New test ids.
