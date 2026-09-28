# Final Report — Ruleswright (UI) / combat-complete (plan revision 2)

## Summary
The Combat and Fight screens now cover the combat features the installed engine (`../Ruleswright` `dadf461`) supports:
grid placement and a board, reach and validity rejections shown verbatim, host repositioning, turn order and initiative,
the action economy (slot ledgers, pools, bound slots, conditions, action detail), ally-side bestiary spawns,
threat-budget encounters, and resuming a recorded fight. Grid fights and ally spawns are also recorded and replayed.
All 6 sessions are **done**. All in-scope capabilities (CAP-01..06, CAP-09, CAP-10) are **verified** against the
current sources in the built app. Whole-repo `pnpm verify` rc 0 at `c22426a`: check:engine ok, typecheck 0, lint 0,
unit 254/254, e2e 26/26. Orchestrator ran it on a clean build (identity `dirty: false`).

Before this feature, engine `dadf461` had made combat unusable on every newly forged world, and the unit gates were
red: 18 failing tests and 1 typecheck error. SESSION-01 closed the unit red window and SESSION-02 closed the e2e red
window.

- **Sessions:** 6 of 6 done, plus 3 Author workers (AUTHOR-DB-CX, AUTHOR-SPEC-CX, DESIGN-CX = DF-CX-1 + AUTHOR-DESIGN-CX) and 1 planning-completeness Archivist pass.
- **Human decisions used:** "q4 a-i, q1 a, q2 a, q3 a" (2026-09-27).
- **One new product question, not blocking, carried forward:** B-CX-7 (see Follow-up).

## Files
- **M01 shared:** `src/shared/model.ts` (`GridPosition`, `FightStartDoc.positions?`, `allySpawns?`, script `move`).
- **M02 main:** `src/main/storage.ts` (`isPositions`, `isSpawns`, refusal text `…declare/respond/step/move entry`).
- **M06 engine:**
  - `engine/combat.ts`: `LiveFight`, `Sides`, `begin → Outcome<LiveFight>`, `reposition`, `perform(live, entry)`, `spatialOf`, `distance`, `SpawnSpec`, CA-05 refusal, `slotGrants`, `actionInfo`, `assemble`.
  - `engine/replay.ts`: positions, moves and ally spawns; `resume` / `ResumeResult`; a shared `rebuild`.
- **M09 store:** `store/combat.ts`:
  - placement state: `positions`, `defaultPositions`, `setPosition`, `resetPositions`, `move`, `live`;
  - rosters: ally roster and one shared id allocator;
  - selectors and actions: `initiativeOf`, `encounter` / `assembleEnemies`, `resume`.
- **M08 ui:** `ui/Combat.tsx`, `ui.css`, `index.ts` (`Board`, `TokenMark`, `BoardPiece`).
- **M14 views/fight:**
  - `index.tsx`, `fight.css`: PlacementPanel, Allies spawn rows, Assemble by threat row;
  - `records.tsx`: Resume on Fight → Records only.
- **M15 views/combat:** `board.tsx` (new: CombatBoard and Reposition), `order.tsx` (new: TurnOrderPanel and initiative), `controls.tsx` (rejection card, Action/Combatant detail), `index.tsx` (spatial caption), `combat.css`.
- **M17 tests:**
  - unit: `tests/{main/storage,main/ipc,engine/combat,engine/replay,store/combat}.test.ts`;
  - e2e: `e2e/{combat,replay}.spec.ts`.
- **Author (human-approved):**
  - `specs/database.md` `af47822`;
  - `specs/requirements.md` `24601f4`;
  - `specs/design.md`, `mocks/combat.html`, `mocks/fight.html` `9cb5aa8`.

## Architecture impact
- There are no new modules and no new module edges. Arch deltas are appended per session under
  `<!-- combat-complete SESSION-NN -->` markers:
  - S01 `268a2f1`
  - S02 `c02ec42`
  - S03 `e033c16`
  - S04 `79fe4fc`
  - S05 `a19a902`
  - S06 `acfc1fa`
- Engine boundary kept (Custom Rule 1): the grep for `ruleswright` imports outside `engine/` is empty after every session.
- Views reach `spatialOf` / `distance` only through store re-exports (S02 lease r2).
- UI rule decisions: none added. The UI shows reach, validity, initiative and economy exactly as the library reports
  them (Custom Rule 2).

## Verification
| Gate | Result | Where |
|---|---|---|
| `pnpm check:engine` | ok (`ruleswright@0.1.0`, engine `dadf461` clean, never rebuilt) | every receive |
| `pnpm typecheck` / `pnpm lint` | rc 0 | Orchestrator re-run at every receive |
| `pnpm test` | 254/254 (baseline 181 passed / 18 failed) | Orchestrator, `c22426a` |
| `pnpm e2e` | 26/26 (c0 baseline: combat/replay 4/4 failed) | Orchestrator `pnpm verify`, `c22426a` |
| `pnpm verify` | rc 0, build identity head `c22426a`, dirty false | Orchestrator wave close |

Each session proved its capability in the packaged app: the real Electron build, isolated userData, a restart on the
same directory, and a Node reference on the same installed engine and stored pack. Each packaged proof also had an
uncommitted negative control that was confirmed to fail.

## Residual gaps (owner: the engine program `../Ruleswright`, unless noted)
- **EG-1:** `startCombat` silently merges duplicate ids. Mitigated in the UI by CA-05 (refused before the call).
- **EG-2:** `isDowned` / `defeatedSide` are not exported, so there is no "down" label (CX-D3).
- **EG-3:** combat conditions never tick, and character conditions are not carried into combat. The UI shows what the library holds.
- **EG-4:** reach overrides are keyed by combatant id, while packs key them by statblock id. There is no "in reach" hint.
- **EG-5:** there is no movement verb, and restore after a declare grants a second action. Reposition is limited to `awaiting-declare` with no offers (CX-D10).
- **EG-6:** `serializeCombat` keeps only the first open offer per combatant, so reposition is blocked while any offer is open.
- **EG-7:** bursts are not declarable from generated packs, so there is no burst targeting UI.
- **EG-8 (new, S04 negative control):** `startCombat` / restore accepts a `positions` key naming no combatant. A record whose `allySpawns` was removed replays as `diverged at event 0` rather than as a library refusal.
- **Verification debt (UI, S05):** the CA-07 length-mismatch guard is not exercised, because it needs a library mock that no current test lease covers.
- **Library behavior noted (S03):** turn slots refill on the first Step of a turn, not at turn handover. The UI shows this and does not change it.

## Follow-up
- **B-CX-7 (human, via Author Spec/Design re-entry):** the approved Resume rule adopts a fight when the replayed events
  are identical (CX-D6). A tampered **trailing** `move` emits no events, so it is not refused.
  - **Question:** should Resume also require the rebuilt snapshot to equal the record's `combat`?
  - **Recommendation:** yes, with a refusal "resume refused · snapshot differs from the record". It then needs a small UI session in `replay.ts`, `store/combat.ts` and `records.tsx`.
- `combat.html` and `fight.html` have no `wild` mood block. This predates the feature; the owner is the next Designer pass.
- The design does not cover `unavailable` / `error` Resume refusals. S06 reused the designed status line; the next Designer pass should confirm it.

## PROGRAM-CONFIG deltas (for Archivist)
- **FR-11 wording:** grid when the pack declares `spatial`, theater-of-mind otherwise. Also placement, host repositioning, and threat-budget assembly (requirements `24601f4`).
- **FightDoc:** `start.positions`, `start.allySpawns`, and the script `move` op (database `af47822`, additive, `formatVersion` 1).
- **New test ids:**
  - `fight-placement`, `fight-spatial-def`, `fight-place-<id>`(`-x|-y`), `fight-token-<id>`, `fight-place-reset`;
  - `combat-board`, `combat-spatial-def`, `combat-token-<id>`, `combat-distance-<id>`;
  - `combat-move`(`-banner|-apply|-cancel|-unavailable`);
  - `combat-order`, `combat-order-<id>`, `combat-order-position`, `combat-initiative`, `combat-action-detail`;
  - `combat-ledger-<id>`, `combat-pools-<id>`, `combat-bound-<id>`, `combat-conditions-<id>`;
  - `fight-ally-spawn-<instanceId>`, `fight-ally-spawn-remove-<instanceId>`, `fight-add-ally`(`-submit`);
  - `fight-assemble-budget`, `fight-assemble-seed`(`-randomize`), `fight-assemble`, `fight-encounter-summary`, `fight-assemble-error`;
  - `fight-resume-<name>`, `fight-resume-status`.
- **Changed test id text:** `fight-spatial` now prints `grid · seed 42` on new worlds.
- **Convention:** e2e reference fights read positions from `fight-place-<id>` before Begin.

## Orchestration

**Concurrency:** 3 (effective 1: all six sessions hold `store/combat.ts`, CX-D8). The A0 Author wave ran 3 in parallel.
**Wall clock:** 2026-09-27 18:16 → 20:05 local (−05:00), about 1 h 50 m. This includes a restart of the orchestrator runtime (about 18:25–18:48).
**Sessions run:** 6 Coder sessions, 3 Author workers, 1 planning Archivist (2 attempts).
**Checkpoints committed by Coder:** 19 (git log: S01 3, S02 3, S03 3, S04 4, S05 3, S06 3).

### Wave plan as executed
| Wave | Sessions | Notes |
|---|---|---|
| A0 | AUTHOR-DB-CX ∥ AUTHOR-SPEC-CX ∥ DESIGN-CX | DF-CX-1 and AUTHOR-DESIGN-CX merged into one Designer (permitted). DESIGN-CX was received from its session log after the runtime restart |
| review | Archivist planning-completeness | attempt 1 aborted by the runtime restart; attempt 2 found F1–F5, all closed in plan before S01 |
| 1 | SESSION-01 | lease r2 (F1–F3) |
| 2 | SESSION-02 | lease r2 (store re-export of `spatialOf` / `distance`) |
| 3–6 | SESSION-03 → 04 → 05 → 06 | serial, first dispatch each |

### Blocked
none

### Blocker escalations
| S | Class | Action / human ask | Disposition |
|---|---|---|---|
| 01..06 | B-CX-4 / B-CX-5 / B-CX-0 / B-CX-6: Author dependencies | dispatched the approved Author workers | cleared (`af47822`, `24601f4`, `9cb5aa8`) |
| 01 | planning F1: `tests/main/ipc.test.ts:113` pins the refusal text outside the lease | Controlled Lease Revision r2 (assertion only) | cleared |
| 02 | planning F2: no store source for the default layout | S01 r2 added `defaultPositions` / `resetPositions` | cleared |
| 02 | S01 followUp: views need `spatialOf` / `distance` | S02 lease r2 (store re-export only) | cleared |
| — | transport: the `await_subagent_result` 300 s MCP idle timeout | re-attached to the same handle | degraded, continuing |
| — | runtime restart: handles h-SXqc / h-raWl lost | DESIGN-CX received from its session log; Archivist relaunched once | cleared |
| 06 | B-CX-7: product question (trailing-move tamper) | carried to the human via Author re-entry; not auto-decided | open, non-blocking |

### Interim Archivist checks
| After wave | Sessions received | Result | Drift found | Actions |
|---|---|---|---|---|
| A0 (planning completeness) | Author workers | done (attempt 2) | F1–F5 (2 blockers, 3 advisories) | S01 r2, S06 note, STATE baseline text (`1714926`) |

### Lease violations
none. S02 created `ui/Board.tsx` outside its lease and deleted it before any commit. It is absent from every commit and from the tree.

### Checkpoint shortfalls
none

### Wave plan corrections
none. The sessions were fully serial, as planned (CX-D8).

### Granularity feedback for Planner
- S01: the c1/c3 boundary was drawn slightly wrong. Adding `move` to the engine `ScriptEntry` at c1 needed the `model.ts` types at c1, not at c3.
- Several premises were corrected by the Coders against the real engine: the wight acts first in dark-fantasy·42, and slots refill on the first Step. Future probe notes should record who acts first and the refill point.

### Process effectiveness
- **First-dispatch completion:** 6/6. No session was redispatched.
- **Unplanned corrections:** 2 same-context lease revisions before dispatch (S01 r2 for F1–F3, CAP-06 / CAP-09 / CAP-10; S02 r2, CAP-06). There were no separate owner-correction workers.
- **Integration rework:** 0 corrective commits after acceptance.
- **Environment failures:** the orchestrator runtime restart and the MCP idle timeout. Neither is a planning defect.
- **Product decisions raised:** 1 (B-CX-7).

### Capability completion
| CAP | Status | Proof |
|---|---|---|
| CAP-06 grid fight | verified | S01 `3ec636e` (unit), S02 `f8ef15c` (packaged) |
| CAP-09 combat loop | verified | S01 unit, S02 e2e |
| CAP-10 record + replay | verified | S01 unit, S02 e2e |
| CAP-01 turn order + initiative | verified | S03 `a62ee03` |
| CAP-02 economy + action detail | verified | S03 `a62ee03` |
| CAP-03 ally-side spawns | verified | S04 `bd10c7b` |
| CAP-04 threat-budget encounter | verified | S05 `8612519` |
| CAP-05 resume | verified within the approved rule | S06 `c22426a`; edge B-CX-7 open |

### Follow-up closure ledger
| Source | Item | Disposition |
|---|---|---|
| AUTHOR-DB-CX | none; Coders implement per database.md | closed (S01 `3ec636e`, S04 `497ab84`) |
| AUTHOR-SPEC-CX | DESIGN-CX must run after DF-CX-1 | retired: merged into one worker |
| DESIGN-CX surprise 1 | Combatants panel example data changed | closed: accepted at receive (`2b6e063`) |
| DESIGN-CX surprise 2 | no `wild` mood in combat/fight mocks | carried: next Designer pass |
| DESIGN-CX surprise 3 | no burst UI (EG-7) | carried: engine program |
| DESIGN-CX followUp | design rows routed to S02–S06 | closed (S02–S06 done) |
| S01 surprise 1 | c1/c3 boundary | closed: Granularity feedback above |
| S01 surprises 2–5 | precondition order, character subscription, `move` keeps placement, far-apart probe | closed: accepted (`a0e0b66`) |
| S01 followUp | views need `spatialOf` / `distance` | closed: S02 r2 `58fb329` |
| S01 followUp | multi-ally `Sides` / `begin` | closed: S04 `497ab84` |
| S01 followUp | Resume via `perform` | closed: S06 `1951f76` |
| S02 surprises | wight acts first; `combat-move-<id>` unused; rejection kicker; CAP-10 move-free; px from design; Board.tsx slip; placement ids | closed: accepted (`592e636`) |
| S02 followUp | spatial caption and Turn order position | closed: S03 `462e296` |
| S02 followUp | A2 ally tokens | closed: S04 `9324268` |
| S02 followUp | Resume keeps `live.sides` | closed: S06 `1951f76` |
| S02 followUp | EG-4 / EG-7 | carried: engine program |
| S03 surprises | refill on first Step; cost JSON; `—` fields; condition leg; aria-labels; px; wrap | closed: accepted (`4bc3db3`) |
| S03 followUp | ally rows automatic | closed: S04 e2e |
| S03 followUp | EG-3 | carried: engine program |
| S03 followUp | refill-on-first-Step note | carried: Author/Spec (optional product note) |
| S04 surprises | positions key for a missing combatant accepted | carried: engine program (EG-8) |
| S04 surprises | design meta text; button text; PlacementPanel naming fix | closed: accepted (`a2ecbd1`) |
| S04 followUp | shared allocator in S05 | closed: S05 `650668d` |
| S04 followUp | Resume passes `allySpawns` | closed: S06 `1951f76` |
| S05 surprises | bare-id naming; seed-8 control; error card under the row; summary kept on refusal | closed: accepted (`55ff8de`) |
| S05 surprises | length-mismatch guard untested | carried: verification debt (owner: the next session leasing `tests/engine/combat.test.ts` with a mock seam) |
| S05 followUp | begin seam; `encounter` survives `end()` | closed: S06 `1951f76` |
| S06 surprise | tampered trailing move not refused | carried: B-CX-7, human via Author re-entry |
| S06 surprises | no nav to Combat (store-test proof); undesigned refusal kinds; fresh Runtime | closed: accepted; undesigned kinds carried to the next Designer pass |

### Archivist's Note
(pending: appended below after the final Archivist pass)
