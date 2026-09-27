# State Tracker — Ruleswright (UI) / combat-complete

## Program / Feature / Intent / Sessions
- **Program:** Ruleswright (UI) (`ruleswright-ui`) · **Feature:** `combat-complete` · **Plan revision 2**
- **Intent:** the Combat and Fight surfaces cover what the installed engine supports for combat: grid
  placement/positions/reach (new in engine `dadf461`), turn order + initiative, action economy,
  pools/bound slots, conditions, action costs/validity, both-sided assembly, threat-budget encounters, resume.
- **Human requests (verbatim, 2026-09-27):** "can you make the combat section fully implment what ruleswrights
  supports, turn order, spatial location, etc" · "Ruleswright has been updated, please check again".
- **Human decision (verbatim, 2026-09-27):** "q4 a-i, q1 a, q2 a, q3 a". All four questions answered on the
  recommendation; `AUTHOR-REQUEST-CX.md` is now **APPROVED work orders**. No session is skipped and none needs
  a replan. The conditional "On Qn = (b)/(c)" notes in the session prompts are resolved and do not apply.
- **Sessions:** 6 (SESSION-01..06) + four Author workers (DF-CX-1, AUTHOR-DB-CX, AUTHOR-SPEC-CX,
  AUTHOR-DESIGN-CX), all dispatchable under the approval.
- **Plan base (rev 2):** UI HEAD `0acfd0d` (source = `01d2457`); engine `../Ruleswright` HEAD `dadf461`,
  clean, last `src/` commit `38c017e`; dist built after it; installed copy hard-linked; `check:engine` ok.
- **Rev 1 (`7802c19`) superseded:** its "spatial not implementable" premise is disproved by `dadf461`.
  Sessions renumbered: rev-1 S01→S03, S02→S04, S03→S05, S04→S06.

## Session Status
| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|------------|-----------|-------|
| 01 | Grid spine: positions, reposition, record/replay, unit gates | M01 M02 M06 M09 M17 | `src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/{combat,replay}.ts`, `src/renderer/src/store/combat.ts`, `tests/main/storage.test.ts`, `tests/engine/{combat,replay}.test.ts`, `tests/store/combat.test.ts` | pending | — | — | waits on AUTHOR-DB-CX commit (approved) |
| 02 | Grid UI: placement, board, reposition; e2e green | M14 M15 M08? M17 | `src/renderer/src/views/fight/{index.tsx,fight.css}`, `src/renderer/src/views/combat/{index,controls,board}.tsx`, `src/renderer/src/views/combat/combat.css`, `src/renderer/src/ui/{Combat.tsx,ui.css,index.ts}`, `e2e/{combat,replay}.spec.ts` | pending | — | — | waits on S01 + AUTHOR-SPEC-CX + AUTHOR-DESIGN-CX commits |
| 03 | Turn order, initiative, economy, conditions | M06 M09 M15 M08? M17 | `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/combat/{index,controls,order}.tsx`, `src/renderer/src/views/combat/combat.css`, `src/renderer/src/ui/{Combat.tsx,ui.css,index.ts}`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts` | pending | — | — | waits on S02 + DF-CX-1 |
| 04 | Ally-side spawns | M01 M02 M06 M09 M14 M17 | `src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/{combat,replay}.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{index.tsx,fight.css}`, `tests/main/storage.test.ts`, `tests/engine/{combat,replay}.test.ts`, `tests/store/combat.test.ts`, `e2e/{combat,replay}.spec.ts` | pending | — | — | waits on S03 + AUTHOR-DB-CX (`allySpawns`) + AUTHOR-DESIGN-CX |
| 05 | Threat-budget encounters | M06 M09 M14 M17 | `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{index.tsx,fight.css}`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts` | pending | — | — | waits on S04 + Spec + Design (Q2 parts) |
| 06 | Resume a recorded fight | M06 M09 M14 M17 | `src/renderer/src/engine/replay.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{records.tsx,fight.css}`, `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`, `e2e/replay.spec.ts` | pending | — | — | waits on S05 + Spec + Design (Q3 parts) |

Brace globs here are shorthand; each SESSION-NN.md `Owns` line is the lease.

## Wave Plan
| Wave | Sessions | Why |
|------|----------|-----|
| A0 | DF-CX-1 ∥ AUTHOR-DB-CX ∥ AUTHOR-SPEC-CX, then AUTHOR-DESIGN-CX | DF-CX-1 writes `design.md` + `mocks/combat.html`; DB `database.md`; Spec `requirements.md` (pairwise disjoint). AUTHOR-DESIGN-CX writes `design.md` + `mocks/{fight,combat}.html`: **after DF-CX-1** (or merged with it into one Designer worker) |
| 1 | SESSION-01 | Alone: every session holds `store/combat.ts` (the feature spine). Needs only the DB commit, so it may start while Spec/Design are still running |
| 2 | SESSION-02 | Alone: holds `views/combat/*`, `e2e/*.spec.ts` shared with 03/04/05/06 |
| 3–6 | SESSION-03 → 04 → 05 → 06, one per wave | Each shares `store/combat.ts` with every other |

No concurrency among sessions: all six hold `store/combat.ts` (CX-D8).

## Dependency Graph
```
AUTHOR-DB-CX ───────────────► S01 ─► S02 ─► S03 ─► S04 ─► S05 ─► S06
AUTHOR-SPEC-CX ─────────────────────┘ ▲            ▲      ▲      ▲
DF-CX-1 ─► AUTHOR-DESIGN-CX ──────────┘  (DF-CX-1)─┘ (Spec+Design parts for S04–S06)
```

## Architecture Reference (feature-specific)
- `engine/` stays the only `ruleswright` importer (Custom Rule 1). Views reach the engine through
  `store/combat` (existing convention).
- New engine surface used: `startCombat` `positions`, `serializeCombat`/`deserializeCombat` (reposition seam),
  `Position`, `SpatialDef`, `Runtime.spatial.distance` (S01/S02); `resolveSlotGrants` (S03);
  `assembleEncounter`/`spawnEncounter`/`Encounter` (S05). All verified in the installed `.d.ts` at plan time.
- Engine surface deliberately **not** used: `canReach`/`checkReach`/`inBurst` from the UI (reach is the
  engine's decision; EG-4); `checkCost` as a pre-judgement (CX-D4); `deserializeCombat` as resume (CX-D6).
- S01 changes the engine wrapper shapes: `begin` → `Outcome<LiveFight>`, `perform(live, entry)`.

## Scope Summary
| ID | Module | Change |
|----|--------|--------|
| M01 | shared | S01 `start.positions?`, `move` script entry; S04 `start.allySpawns?` (DB-approved, names from the DB commit) |
| M02 | main | S01, S04 validation |
| M06 | engine | S01 positions/`LiveFight`/`reposition`/`spatialOf`/`distance`; S03 `slotGrants`/`actionInfo`; S04 ally spawns; S05 `assemble`; S06 `resume` |
| M08 | ui | S02/S03 only if the design names a component |
| M09 | store | S01 placement/`move`; S03 `initiativeOf`; S04 ally roster + CA-05; S05 `assembleEnemies`; S06 `resume` |
| M14 | views/fight | S02 placement; S04 Allies panel; S05 Assemble row; S06 Resume |
| M15 | views/combat | S02 `board.tsx`; S03 `order.tsx` + detail panels |
| M17 | tests | S01 unit repair; S02 e2e repair; every session's proofs |
| — | engine repo | none (never edited). Gaps EG-1..EG-7 in AUTHOR-REQUEST-CX |

Dispositions of inherited/rev-1 items:
- **Rev-1 "spatial not implementable"**: **disproved** by engine `dadf461`. Replaced by CAP-06 "grid fight".
- **Q4 (b) "leave grid worlds unplayable"** and **(a-ii) placement only**: not chosen (human, 2026-09-27).
- **Downed labels**: withheld (CX-D3, EG-2). **Condition ticking in combat**: engine gap (EG-3).
- **Burst targeting UI**: not planned (EG-7). Reopen when the engine makes spells combat-declarable.
- **Per-combatant reach display / "in reach" hint**: not planned (EG-4).
- **Multiple player characters**: not requested; FR-11 "Ally side is the active character".
- **Pre-`dadf461` worlds**: rerun fails honestly; fights stay theater; records replay pack-diverged (LI-D4 class).

## Design Decisions
| ID | Choice | Rationale |
|----|--------|-----------|
| CX-D2 | Turn order + economy display is **design-fill** (DF-CX-1) | FR-11/12/16 already require the information; no new behavior |
| CX-D3 | No "down"/"skipped" labels | `isDowned` is an unexported engine rule (EG-2) |
| CX-D4 | Action detail shows `cost`/`tags`/`trigger.on`/`valid` verbatim; no affordability preview | Declare is the authority |
| CX-D5 | Empty threat assembly leaves the roster unchanged | Narrowest reversible behavior |
| CX-D6 | Resume = re-apply the script on the stored pack; adopt only on identical events | **Human-approved (Q3 = a).** Lossless |
| CX-D7 | One id allocator over both rosters; `begin` refuses duplicates | EG-1; positions are keyed by id |
| CX-D8 | All sessions serial | Shared `store/combat.ts` spine |
| CX-D9 | Default placement: allies `x=0`, enemies `x=1`, `y` = index in own roster | Everyone starts where melee is legal; editable before Begin; host input, not a rule. Carried into AUTHOR-DESIGN-CX |
| CX-D10 | Reposition only at `awaiting-declare` with no open offers | **Human-approved (Q4 = a-i).** Probe-grid2: restore after a declare grants a second action; EG-6 |
| CX-D11 | Reposition uses the engine's serialize → restore seam with **live** balances re-stated | Re-stating begin-time balances would refund spent pools |
| CX-D12 | Placement board is a viewport; shared squares allowed; no bounds enforced | The engine bounds nothing |
| CX-D13 | Theater-path tests use a generated pack with `spatial` deleted | Same shape as pre-`dadf461` worlds and imported packs |
| CX-D14 | Unit repair (S01) and e2e repair (S02) owned by the grid sessions | A fix-only session would build the same seam twice |
| CX-D15 | Ally spawns (Q1 = a) and threat encounters (Q2 = a) are in scope | **Human-approved 2026-09-27** |

## Verification Baseline
Inspected: PROGRAM-CONFIG verification table; `e2e/fixtures.ts` (isolated `RULESWRIGHT_USER_DATA`,
`rw.restart()`); `e2e/global-setup.ts`; `src/main/storage.ts` FightDoc validation (script ops limited to
declare/respond/step, l.142–154); engine grid-combat FINAL-REPORT; loot-inventory STATE baseline.

| Command | Effective | Evidence | Source |
|---|---|---|---|
| `pnpm check:engine` | `node scripts/check-engine.mjs` | **actual** 2026-09-27 @ `7802c19`: `engine ok: ruleswright@0.1.0` | Planner run |
| `pnpm test` | `vitest run` | **actual** @ `7802c19`: **RED** 181 passed / **18 failed** — `tests/engine/combat.test.ts` (8), `tests/engine/replay.test.ts` (6), `tests/store/combat.test.ts` (4) | Planner run |
| `pnpm typecheck` | per PROGRAM-CONFIG | **actual** @ `7802c19`: **RED**, `tests/engine/combat.test.ts(119,25)` TS2352 | Planner run |
| `pnpm lint` | per PROGRAM-CONFIG | inherited green @ `0452776`; not re-run | loot-inventory STATE |
| `pnpm e2e` | `playwright test` | **not run**. Expected red: `e2e/combat.spec.ts` (3 tests), `e2e/replay.spec.ts` (CAP-10) | inference, unverified |
| `pnpm verify` | all of the above | red | — |

Commits since `7802c19` (`0acfd0d`, this one) touch only `program/` files; the actual results stand.

**Known red window:** now → SESSION-01 checkpoint 3 (unit + typecheck) → SESSION-02 checkpoint 3 (e2e).
Sessions before those checkpoints use lease-scoped gates (`pnpm exec vitest run <files>`) and record the
whole-repo result without claiming green.

Hazards: H-1 `e2e:out` exclusive · H-2 e2e needs a GUI · H-3 `file:` engine copy; **do not rebuild
`../Ruleswright/dist` while a session runs** · H-5 `prompts/` gitignored → `git add -f` · build identity
`dirty: true` whenever uncommitted files exist. Probe scripts that drive combat must bound their loops
(`step()` at `awaiting-declare` never ends a turn; an unbounded loop exhausted the heap during planning).

## Capability Readiness
| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|----|----|----|----|----|----|----|
| CAP-06 | FR-11 (rev, **approved Q4 a-i**): grid fight — placement, board, reach/validity rejections, reposition, record/replay | `startCombat` positions, restore seam, `rt.spatial` (engine, ready); FightDoc `start.positions` + `move` (DB, approved, **not yet committed**) | CA-12..15 | S01 c3 (unit restart leg), **S02 c3** (packaged) | planned | probe-grid, probe-grid2; `runtime.d.ts` | AUTHOR-DB-CX, AUTHOR-SPEC-CX, AUTHOR-DESIGN-CX commits |
| CAP-01 | FR-11/12: turn order + initiative | `combat:start`, `state.order/turn/active/round` (ready) | CA-01; DF-CX-1; S02 | S03 c3 | planned | probe (rev 1) | DF-CX-1 |
| CAP-02 | FR-12/16: ledger, pools, bound slots, conditions, action detail | engine state + `resolveSlotGrants` + `pack.actions` (ready) | CA-02..04; DF-CX-1 | S03 c3 | planned | probe (rev 1) | DF-CX-1 |
| CAP-03 | FR-11: ally-side spawns, recorded + replayed | multi-ally `startCombat` (ready); FightDoc `allySpawns` (DB, approved Q1 a, not yet committed) | CA-04b, CA-05, CA-06 | S04 c4 | planned | probe (rev 1) | AUTHOR-DB-CX |
| CAP-04 | FR-11 (amendment, **approved Q2 a**): threat-budget encounter | `assembleEncounter`/`spawnEncounter` (ready) | CA-07, CA-08, CA-05 | S05 c3 | planned | probe (rev 1) | Spec + Design commits |
| CAP-05 | FR-14 (amendment, **approved Q3 a**): resume | FightDoc (ready after S01/S04); shared rebuild path (S01) | CA-09..11 | S06 c3 | planned | `replay.ts`, `database.md` | Spec + Design commits |
| CAP-10 | FR-14 (existing): record + replay | existing | CA-14 | S01 c2–c3 (unit), S02 c3 (e2e) | **stale** | red since engine `dadf461` | S01, S02 |
| CAP-09 | FR-11/12/13 (existing): combat loop | existing | CA-12 | S01 c3 (unit), S02 c3 (e2e) | **stale** | red since `dadf461` | S01, S02 |

First narrow journey: **S02 checkpoint 3** — built app → Roll → Character → placement → Begin → reach
rejection → reposition → hit → record → restart → replay `complete`. S03–S06 build on it.

## Contract Agreements
| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|----|----|----|----|----|----|----|
| CA-12 | Positions are host input passed verbatim; the library judges | store `positions` → `engine.begin` → `startCombat` → `state.combatants[id].position` → board | `{x,y}` integers; default layout CX-D9; theater → none; no reach math | S01 c1–c3, S02 c3 | agreed | ready (engine) | planned. probe-grid |
| CA-13 | Reposition preserves everything but positions; no extra action | store `move` → `engine.reposition` → `serializeCombat`/`deserializeCombat` | preconditions CX-D10; live balances CX-D11; zero events | S01 c1, S02 c3 | agreed | ready (engine) | probe-grid2: pools 16 kept, rng equal, 0 events |
| CA-14 | Recorded placement + moves replay exactly | store → IPC → main → disk → replay | `start.positions`, `{op:'move', positions}` (proposed names) | DB; S01 c2–c3; S02 c3 | agreed in substance; **names provisional** until AUTHOR-DB-CX commits | planned | Orchestrator re-checks the committed names before S01 dispatch; dispatch against the committed text |
| CA-15 | Distance is the library's | `rt.spatial.distance` → `engine.distance` → board | number only; no reach judgement | S02 c3 | agreed | ready | probe-grid2 |
| CA-01..04 | (rev 1; CA-03 adds `valid`) | see SESSION-03 | — | S03 | agreed | ready | planned |
| CA-04b, CA-05, CA-06 | (rev 1; CA-05 also protects position keys) | see SESSION-04 | — | S04 | CA-04b names provisional until AUTHOR-DB-CX | planned | re-check before S04 dispatch |
| CA-07, CA-08 | (rev 1) | see SESSION-05 | — | S05 | agreed | ready | planned |
| CA-09..11 | (rev 1; CA-09 adds positions) | see SESSION-06 | — | S06 | agreed | planned | planned |

## Current Blockers
Human decisions: **none open** (Q1–Q4 answered 2026-09-27).

| ID | Affects | Next action | Owner | Evidence to clear |
|----|---------|-------------|-------|-------------------|
| B-CX-0 | S03, CAP-01/02; gates AUTHOR-DESIGN-CX | Dispatch DF-CX-1 | Orchestrator → Designer | commit touching only `specs/design.md`, `mocks/combat.html` |
| B-CX-4 | **S01** (and so every later session), CAP-06/09/10, CA-14, CA-04b | Dispatch AUTHOR-DB-CX (approved) | Orchestrator → DB | commit touching only `specs/database.md`, with `start.positions`, `start.allySpawns`, `move` op, replay step, integrity rules, Migration History row 3 |
| B-CX-5 | S02, S05, S06 | Dispatch AUTHOR-SPEC-CX (approved) | Orchestrator → Spec | commit touching only `specs/requirements.md` |
| B-CX-6 | S02, S04, S05, S06 | Dispatch AUTHOR-DESIGN-CX after DF-CX-1 | Orchestrator → Designer | commit touching only `specs/design.md`, `mocks/fight.html`, `mocks/combat.html` |

## Handoff Notes
(Orchestrator writes here after each session, from Coder's Handoff section, verbatim.)
