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
| 01 | Grid spine: positions, reposition, record/replay, unit gates | M01 M02 M06 M09 M17 | `src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/{combat,replay}.ts`, `src/renderer/src/store/combat.ts`, `tests/main/{storage,ipc}.test.ts`, `tests/engine/{combat,replay}.test.ts`, `tests/store/combat.test.ts` | **done** | 3/3 | 2026-09-28 | lease r2; `afdd9dc` c1, `bb1af82` c2, `3ec636e` c3; arch `268a2f1`. Unit red window **closed** (Orchestrator re-run: typecheck 0, lint 0, test 217/217) |
| 02 | Grid UI: placement, board, reposition; e2e green | M14 M15 M08? M17 | `src/renderer/src/views/fight/{index.tsx,fight.css}`, `src/renderer/src/views/combat/{index,controls,board}.tsx`, `src/renderer/src/views/combat/combat.css`, `src/renderer/src/ui/{Combat.tsx,ui.css,index.ts}`, `e2e/{combat,replay}.spec.ts` | pending | — | — | **done** | 3/3 | 2026-09-28 | lease r2; `58fb329` c1, `bde3bd2` c2, `f8ef15c` c3; arch `c02ec42`. e2e red window **closed** (Orchestrator re-run: unit 217/217, e2e combat+replay 7/7 on fresh build of `f8ef15c`, dirty false) |
| 03 | Turn order, initiative, economy, conditions | M06 M09 M15 M08? M17 | `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/combat/{index,controls,order}.tsx`, `src/renderer/src/views/combat/combat.css`, `src/renderer/src/ui/{Combat.tsx,ui.css,index.ts}`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts` | pending | — | — | **done** | 3/3 | 2026-09-28 | `229cd74` c1, `462e296` c2, `a62ee03` c3; arch `e033c16`. Orchestrator re-run: unit 221/221, e2e combat 6/6 on clean build of `a62ee03` |
| 04 | Ally-side spawns | M01 M02 M06 M09 M14 M17 | `src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/{combat,replay}.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{index.tsx,fight.css}`, `tests/main/storage.test.ts`, `tests/engine/{combat,replay}.test.ts`, `tests/store/combat.test.ts`, `e2e/{combat,replay}.spec.ts` | pending | — | — | **done** | 4/4 | 2026-09-28 | `497ab84` c1, `d88b071` c2, `9324268` c3, `bd10c7b` c4; arch `79fe4fc`. Orchestrator re-run: unit 234/234, e2e combat+replay 10/10 on clean build of `bd10c7b` |
| 05 | Threat-budget encounters | M06 M09 M14 M17 | `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{index.tsx,fight.css}`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts` | pending | — | — | ready (S04 ✓; Spec ✓ `24601f4`, Design ✓ `9cb5aa8`); must use the store's shared `spawnOf` allocator (CA-05) |
| 06 | Resume a recorded fight | M06 M09 M14 M17 | `src/renderer/src/engine/replay.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{records.tsx,fight.css}`, `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`, `e2e/replay.spec.ts` | pending | — | — | waits on S05 (Spec ✓ `24601f4`, Design ✓ `9cb5aa8`); Resume on Fight → Records only (`recordable` false), F5 note in SESSION-06 |

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
| `pnpm test` | `vitest run` | **actual** @ `268a2f1` (2026-09-28): **GREEN** 18 files, 217/217 (was RED 181/18 failed @ `7802c19`) | Orchestrator re-run at S01 receive |
| `pnpm typecheck` | per PROGRAM-CONFIG | **actual** @ `268a2f1`: **GREEN** rc 0 (was RED at `tests/engine/combat.test.ts(119,25)` @ `7802c19`) | Orchestrator re-run at S01 receive |
| `pnpm lint` | per PROGRAM-CONFIG | **actual** @ `268a2f1`: GREEN rc 0 | Orchestrator re-run at S01 receive |
| `pnpm e2e` | `playwright test` | **actual** @ `f8ef15c`: GREEN 21/21 in 8 files (S02 `pnpm verify`); Orchestrator re-run combat+replay 7/7 on fresh build, identity dirty false. (c0 baseline: 4/4 combat/replay failed) | S02 + Orchestrator |
| `pnpm verify` | all of the above | **actual** @ `bd10c7b`: rc 0 (S04 c4; unit 234/234, e2e 24/24) | SESSION-04 |

Commits since `7802c19` touch only `program/` files **except `9ea30c4`**, which changes only the `dev` script in `package.json` (no effect on test/typecheck/lint/e2e/verify). Re-run by Archivist 2026-09-28 @ `2b6e063`: identical (18 failed / 181 passed; typecheck single error at `tests/engine/combat.test.ts:119`).

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
| CAP-06 | FR-11 (rev, **approved Q4 a-i**): grid fight — placement, board, reach/validity rejections, reposition, record/replay | `startCombat` positions, restore seam, `rt.spatial` (engine, ready); FightDoc `start.positions` + `move` (DB committed `af47822`) | CA-12..15 | S01 c3 (unit restart leg), **S02 c3** (packaged) | **verified** (unit S01 `3ec636e`; packaged S02 `f8ef15c`, Orchestrator e2e re-run 7/7) | probe-grid, probe-grid2; `runtime.d.ts` | Author inputs landed: DB ✓ `af47822`, Spec ✓ `24601f4`, Design ✓ `9cb5aa8` (Placement board, Combat board, Reposition control, Board token rows) |
| CAP-01 | FR-11/12: turn order + initiative | `combat:start`, `state.order/turn/active/round` (ready) | CA-01; DF-CX-1 ✓ `9cb5aa8`; S02 | S03 c3 | **verified** S03 c3 `a62ee03` (e2e 'CAP-01/02', Orchestrator re-run) | — |
| CAP-02 | FR-12/16: ledger, pools, bound slots, conditions, action detail | engine state + `resolveSlotGrants` + `pack.actions` (ready) | CA-02..04; DF-CX-1 ✓ `9cb5aa8` | S03 c3 | **verified** S03 c3 `a62ee03` (e2e 'CAP-01/02', Orchestrator re-run) | Library behavior noted: slots refill on the first Step of a turn (shown, not changed) |
| CAP-03 | FR-11: ally-side spawns, recorded + replayed | multi-ally `startCombat` (ready); FightDoc `start.allySpawns` (DB committed `af47822`) | CA-04b, CA-05, CA-06 | S04 c4 | **verified** S04 c4 `bd10c7b` (e2e 'CAP-03' + 'CAP-03 / CA-04b'; unit restart leg) | Library accepts a `positions` key naming no combatant (negative control: replay `diverged at event 0`, not a refusal) → engine-program note |
| CAP-04 | FR-11 (amendment, **approved Q2 a**): threat-budget encounter | `assembleEncounter`/`spawnEncounter` (ready) | CA-07, CA-08, CA-05 | S05 c3 | planned | probe (rev 1) | Spec ✓ `24601f4`, Design ✓ `9cb5aa8` (Assemble by threat row) |
| CAP-05 | FR-14 (amendment, **approved Q3 a**): resume | FightDoc (ready after S01/S04); shared rebuild path (S01) | CA-09..11 | S06 c3 | planned | `replay.ts`, `database.md` | Spec ✓ `24601f4`, Design ✓ `9cb5aa8` (Resume action — Fight → Records only) |
| CAP-10 | FR-14 (existing): record + replay | existing | CA-14 | S01 c2–c3 (unit), S02 c3 (e2e) | **verified** (unit S01; e2e S02 `f8ef15c` CAP-10 setup-only repair, tamper leg unchanged) | Orchestrator re-run e2e 7/7 @ `f8ef15c` | — |
| CAP-09 | FR-11/12/13 (existing): combat loop | existing | CA-12 | S01 c3 (unit), S02 c3 (e2e) | **verified** (unit S01; e2e S02 `f8ef15c` CAP-09/keyboard/500-event setup-only repair) | Orchestrator re-run e2e 7/7 @ `f8ef15c` | — |

First narrow journey: **S02 checkpoint 3** — built app → Roll → Character → placement → Begin → reach
rejection → reposition → hit → record → restart → replay `complete`. S03–S06 build on it.

## Contract Agreements
| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|----|----|----|----|----|----|----|
| CA-12 | Positions are host input passed verbatim; the library judges | store `positions` → `engine.begin` → `startCombat` → `state.combatants[id].position` → board | `{x,y}` integers; default layout CX-D9; theater → none; no reach math | S01 c1–c3, S02 c3 | agreed | **landed** S01 `afdd9dc`/`3ec636e` (engine `begin` positions verbatim; store CX-D9 `defaultPositions`) | **verified**: unit S01 c3 `3ec636e`; packaged S02 c3 `f8ef15c` (e2e 'CAP-06: grid fight …': tokens = reference positions after Begin/move/over; `combat-spatial-def` = pack.spatial) — Orchestrator re-run 7/7 |
| CA-13 | Reposition preserves everything but positions; no extra action | store `move` → `engine.reposition` → `serializeCombat`/`deserializeCombat` | preconditions CX-D10; live balances CX-D11; zero events | S01 c1, S02 c3 | agreed | **landed** S01 c1 `afdd9dc` (`reposition`; precondition order spatial → offer → phase) | **verified**: unit S01 c1; packaged S02 c3 `f8ef15c` (Apply → tokens moved, 0 new `combat-event`, reference restore 0 events, lockstep to combat-over; disabled after declare/over) |
| CA-14 | Recorded placement + moves replay exactly | store → IPC → main → disk → replay | `start.positions`, `{op:'move', positions}` (proposed names) | DB; S01 c2–c3; S02 c3 | agreed; names **committed** `af47822`: `start.positions: {[id]:{x:int,y:int}}`, script `{op:'move', positions}` (complete map), replay step (3) + integrity rules | **landed** S01 c1–c3 (`model.ts` `GridPosition`/`move`/`start.positions`, `storage.ts` `isPositions`, replay `move`) | unit **passed** S01 c2–c3 (storage.test 'CX placement and moves'; replay.test move complete / tampered diverged / missing positions → E-SPAT-01; store restart leg via real main handlers on temp dir → replay complete); **verified** packaged S02 c3 `f8ef15c` (replay.spec 'CAP-06 / CA-14': stored `start.positions` = placement, exactly one `move`, restart → replay complete, 0 divergences) |
| CA-15 | Distance is the library's | `rt.spatial.distance` → `engine.distance` → board | number only; no reach judgement | S02 c3 | agreed | **landed** S02 `58fb329` (store re-export, `CombatBoard`) | **verified** S02 c3 `f8ef15c`: each `combat-distance-<id>` = `ref.fight.runtime.spatial.distance` before and after the move |
| CA-01..04 | (rev 1; CA-03 adds `valid`) | see SESSION-03 | — | S03 | agreed | **landed** S03 `229cd74`/`462e296` (`slotGrants`, `actionInfo`, `initiativeOf`, TurnOrderPanel, Action/Combatant detail) | **verified** S03 c3 `a62ee03`: e2e 'CAP-01/02' lockstep — order/initiative verbatim, ledgers `remaining/grant` after every call, conditions + pack `restricts` (hexbound), action detail cost JSON/`valid`, slot-exhausted card = reference; Orchestrator re-run 6/6 |
| CA-04b, CA-05, CA-06 | (rev 1; CA-05 also protects position keys) | see SESSION-04 | — | S04 | CA-04b names committed `af47822`: `start.allySpawns?: [{statblockId, instanceId}]` (non-empty only, ally order after the character) | **landed** S04 `497ab84`/`d88b071` (`SpawnSpec`, `begin(…, allySpawns)`, `isSpawns`, shared `spawnOf` allocator, CA-05 refusal before `startCombat`) | **verified** S04 c4 `bd10c7b`: e2e 'CAP-03' lockstep to combat-over; replay.spec 'CAP-03 / CA-04b' stored `start.allySpawns` = panel rows, restart → complete; CA-05 unit (4 collisions, replay error, store no side effects); CA-06 legacy unit; Orchestrator re-run 10/10 |
| CA-07, CA-08 | (rev 1) | see SESSION-05 | — | S05 | agreed | ready | planned |
| CA-09..11 | (rev 1; CA-09 adds positions) | see SESSION-06 | — | S06 | agreed | planned | planned |

## Planning Completeness Review
- 2026-09-28, Archivist h-yz-7 (attempt 2; attempt 1 h-raWl aborted by an orchestrator runtime restart), base `2b6e063`, sources af47822 / 24601f4 / 9cb5aa8, engine dadf461. Engine surface, DB mapping, design/requirements vs S02–S06, wrapper callers, harness, serial plan: confirmed.
- F1 (blocker) `tests/main/ipc.test.ts:113` pins the old script-entry refusal text → S01 lease r2 adds that file (assertion only). **Closed in plan.**
- F2 (blocker for S02) no store source for the default layout → S01 c3 r2: `defaultPositions` + `resetPositions()` + store test. **Closed in plan.**
- F3 (advisory) `views/fight/records.tsx:28` reads `s.fight` → S01 r2 keeps `fight` alongside `live`. **Closed in plan.**
- F4 (advisory) baseline text omitted `9ea30c4` → corrected above.
- F5 (advisory) Resume only on Fight → Records → SESSION-06 Orchestrator note. **Closed in plan.**

## Current Blockers
Human decisions: **none open** (Q1–Q4 answered 2026-09-27).

| ID | Affects | Next action | Owner | Evidence to clear |
|----|---------|-------------|-------|-------------------|
| ~~B-CX-0~~ | cleared 2026-09-27: DESIGN-CX `9cb5aa8` (DF-CX-1 rows: Turn order panel, Initiative provenance block, Combatant detail, Action detail, Spatial caption) | — | — | — |
| ~~B-CX-4~~ | cleared 2026-09-27: AUTHOR-DB-CX `af47822` (database.md only; `start.positions`, `start.allySpawns`, `move` op, replay step 3, integrity, Migration History row 3) | — | — | — |
| ~~B-CX-5~~ | cleared 2026-09-27: AUTHOR-SPEC-CX `24601f4` (requirements.md only; FR-11 grid + threat, FR-12, FR-14 replay + resume, Constraints, Glossary Grid) | Orchestrator → Spec | commit touching only `specs/requirements.md` |
| ~~B-CX-6~~ | cleared 2026-09-27: DESIGN-CX `9cb5aa8` (design.md +16/-0; mocks/combat.html, mocks/fight.html; Board token, Placement/Combat board, Reposition control, rejection examples, Ally spawn row, Assemble by threat row, Resume action) | — | — | — |

## Handoff Notes
(Orchestrator writes here after each session, from Coder's Handoff section, verbatim.)

### AUTHOR-DB-CX — done 2026-09-27 (`af47822`)
- notes: Commit af47822 on main, exactly one file (5 insertions / 4 deletions), staged and committed with explicit pathspec per wave-common.md. Exact committed field names/shapes for items 1–3 — item 1: `start.positions?: { [combatantId]: { x: int, y: int } }`, documented as the positions passed to `startCombat`, present iff the pack declares a spatial model; item 2: `start.allySpawns?: [{ statblockId: string, instanceId: string }]`, in `startCombat` ally order after the character, written only when non-empty; item 3: `script` entry kind `{ op: 'move', positions: { [combatantId]: { x: int, y: int } } }`, the complete positions map after the reposition (every combatant). No field names changed — the proposed names `positions`, `allySpawns`, `move` match the file's conventions and were kept verbatim. Item 4 (replay step 3): restore ally, spawn `start.allySpawns` (absent = none), spawn `start.enemies`, begin with `start.positions` (absent = none); a `move` entry re-applies the reposition through the engine's serialize → restore seam with the same sides, the live balances and the entry's positions; plus the sentence 'A record on a spatial pack without `start.positions` replays as the library's refusal, never guessed.' Item 5 (integrity): `script[].op` ∈ `declare | respond | step | move`; `start.allySpawns[]` items `{statblockId, instanceId}` strings; `start.positions` values `{x, y}` integers keyed by strings; a `move` entry's `positions` same shape. Item 6: Migration History row 3 (additive, `formatVersion` stays 1), citing the human decision verbatim.
- followUp: None for DB. The approved DB content is complete; Coder (under main's module contract, via SESSION-01) implements the store changes in src/main/storage.ts and src/shared/model.ts per this document. Any later change to these shapes is a DB re-entry, not a session scope adjustment.
- Orchestrator receive: `git show --stat af47822` = database.md only; diff matches work order items 1–6; accepted.

### AUTHOR-SPEC-CX — done 2026-09-27 (`24601f4`)
- notes: This is Spec, running under an orchestration envelope — SPEC.md says stop in that case, but the stop rule targets unapproved rewrites of requirements. Here the content is human-approved verbatim (decision 2026-09-27, recorded in the commit subject of 3793f8c), which is exactly AUTHOR.md's requirements-change re-entry path with builder approval in hand, so I ran it as the dispatched owner of requirements.md. Applied all six work-order items: FR-11 spatial bullet replaced verbatim (theater-of-mind-when-pack-declares-none, grid otherwise, pre-combat placement, board display, verbatim reach/validity rejections, between-declaration host repositioning); FR-11 Q2 threat-budget criterion added (assembleEncounter/spawnEncounter, explicit numeric encounter seed, user-initiated randomize, library result shown verbatim); FR-12 initiative/economy criterion added; FR-14 replay criterion gained 'placements and repositions included' plus the Q3 resume criterion (refused on divergence, first divergent event shown); Constraints nondeterminism line gained 'the encounter seed'; Glossary gained Grid after Theater-of-mind (kept). Matched the file's existing `- [ ]` criterion style; no prose changes outside the six items.
- followUp: AUTHOR-DESIGN-CX must run strictly after DF-CX-1 (per the request file's dispatch order); it inherits FR-11/12/14 as now worded — the board, threat-assembly row, reposition control and resume ghost are its files, not mine. Planner's next Step 0c will re-read requirements.md at commit 24601f4.
- Orchestrator receive: `git show 24601f4` = requirements.md only (+7/-3); six deltas match the approved text verbatim; accepted. followUp retired: DF-CX-1 and AUTHOR-DESIGN-CX run as one merged worker DESIGN-CX (permitted by AUTHOR-REQUEST-CX), so the ordering holds by construction.

### DESIGN-CX (DF-CX-1 + AUTHOR-DESIGN-CX) — done 2026-09-27 (`9cb5aa8`)
- notes: DESIGN-CX (DF-CX-1 + AUTHOR-DESIGN-CX) committed 9cb5aa8 (one commit, three files, base 3793f8c). New Component Inventory rows: Turn order panel (DF-CX-1); Initiative provenance block (DF-CX-1); Combatant detail (DF-CX-1); Action detail (DF-CX-1); Spatial caption (DF-CX-1); Board token (CX); Placement board (CX); Combat board (CX); Reposition control (CX); Declare rejection examples (CX); Ally spawn row (CX); Assemble by threat row (CX); Resume action (CX). New Screen Inventory rows: Combat — turn order & economy (DF-CX-1); Combat — grid board & reposition (CX); Fight assembly — placement, ally spawns, threat, resume (CX). Placement board viewport 12 × 8 squares, display only (combat board 8 × 6); origin = (min(0, min x), min(0, min y)); no clamping, off-viewport combatants listed with coordinates; shared squares stack with a ×n badge. Keys: Tab / Shift+Tab through tokens then the x/y inputs; Arrow keys move the focused token one square; Home = that token's default square (in reposition: the square it held when the mode opened); Esc = clear selection (in reposition: Cancel); x/y inputs accept any integer (non-integer → danger border, nothing moves). Pointer: click a token then a square, or drag. Reposition label: 'host repositioning — the engine has no movement rule'; disabled line: 'Reposition is unavailable after a declare / while offers are open.'
- surprises: (1) The existing Combatants panel's example data was changed: the old mock glowed Brynn as active while the Phase panel and log said the wight was active. It now matches the probe (barrow-wight-1 active 15/15, barrow-wight-2 at 0/15, Brynn 19/27); the Phase panel, log and trigger offers still say 'wight'/'w-1'. Meaning and structure unchanged. (2) combat.html and fight.html have no 'wild' mood block (pre-existing; out of scope). (3) The pack's shapes list includes 'burst', but no burst targeting UI was designed (EG-7).
- followUp: S02: placement panel and combat board positions, keys and reposition behaviour are in the 'Placement board', 'Combat board', 'Reposition control' and 'Board token' rows (Board token is the M08 candidate); the combat board sits after Trigger offers so Declare → Step stays first in Tab order. S03: 'Turn order panel', 'Initiative provenance block', 'Combatant detail', 'Action detail', 'Spatial caption'; turn display is state.turn + 1; the bound-slots row is omitted when the library reports none. S04: 'Ally spawn row'. S05: 'Assemble by threat row' (non-empty groups replace the roster, empty leaves it unchanged). S06: 'Resume action' — Fight → Records only; the refusal is a status line with chip-danger 'resume refused' + 'first divergence at event <n>'.
- Orchestrator receive (crash recovery): handle h-SXqc unknown to the new runtime; worker termination and its verbatim final message recovered from the runtime session log (`runs/r-v-g8/sessions/DJRal.log`, "session ended"). `git show --numstat 9cb5aa8` = design.md +16/-0, mocks/combat.html +300/-16, mocks/fight.html +172/-3; every mock deletion is a replaced line (example data, spatial caption chip, record rows gaining Resume), no flow/hierarchy change. Accepted. Surprise (1) accepted as example-data alignment inside the approved work order; Coders render real engine ids/names, not mock strings. Surprise (2) carried (pre-existing, outside this feature). Surprise (3) = EG-7, already a named engine gap. followUp routed to S02–S06 envelopes.

### SESSION-01 — done 2026-09-28 (3/3: `afdd9dc`, `bb1af82`, `3ec636e`; lease r2)
- notes: Lease revision r2 acknowledged (r1 = plan rev 2 `0acfd0d`, nothing accepted under r1). Grid spine below the views: CAP-06 producer + unit integration landed (store → engine.begin(positions) → startCombat; reposition seam; record/replay with `start.positions` + `move`); CAP-09/CAP-10 unit legs restored. CA-12/CA-13/CA-14 producer + unit proofs done here; the packaged proofs are still SESSION-02 c3. Names from DB `af47822` (`start.positions`, `{op:'move', positions}` with the complete map). Producers: `engine/combat.ts` `begin`→`Outcome<LiveFight>`, `reposition`, `perform(live, entry)`, `spatialOf`, `distance`, `Sides`, `LiveFight`; `replay.ts` begins with `rec.start.positions`; `storage.ts` `isPositions`; store `positions`/`defaultPositions`/`setPosition`/`resetPositions`/`move`/`live` (`fight` kept). Commits `afdd9dc` c1, `bb1af82` c2, `3ec636e` c3.
- verification: c0: probe-grid/probe-grid2 reproduced (E-SPAT-01 cards `positions.<id>`, far `cut-down` → kind `valid` E-REF-01, `shambler-claw` → kind `spatial` E-SPAT-01, restore → awaiting-declare, 0 events, rng equal, pools 16 kept). Baseline red set matched exactly: 18 failed / 181 passed (combat 8, replay 6, store 4); typecheck single error at combat.test.ts:119. c1: `pnpm typecheck` 0 errors, `pnpm lint` exit 0, `pnpm exec vitest run tests/engine/combat.test.ts` → 1 file, 19/19 (whole repo then 10 failed / 197 passed, replay+store only, stated in the commit body). c2: typecheck/lint green; `pnpm exec vitest run tests/engine` → 7 files, 73/73 (7 files is the intended directory scope); replay file alone 9/9. c3: `pnpm typecheck` exit 0, `pnpm lint` exit 0, `pnpm test` → 18 files, 217/217 (199 baseline + 18 new, 0 failures); `pnpm exec vitest run tests/main/storage.test.ts tests/main/ipc.test.ts` → 2 files, 45/45. Custom Rule 1 grep empty. CA-12 evidence: combat.test 'begin … positions land verbatim', 'fail-closed … E-SPAT-01 per combatant', 'far apart …', store 'begin passes the edited placement verbatim'. CA-13: combat.test 'reposition' describe (full equality list: rng/order/turn/active/round + per-combatant hp, slots.remaining, conditions, pools, boundSlots; zero events; ember-surge spent pool kept; three precondition refusals; incomplete map → library E-SPAT-01; perform move). CA-14: storage.test 'fights — CX placement and moves' (accept + verbatim load; non-integer x, missing y, move without positions, string y each refused by name); replay.test move complete / tampered move diverged at `eventsBeforeMove` with actual `declare:rejected` / missing start.positions → error E-SPAT-01; store restart leg (real main handlers via tests/support/in-process-bridge.ts on a temp dir, fresh bridge + new worlds/character/combat stores → `replay` complete, stored `start.positions` == begin's == CX-D9). Real boundaries: installed engine `dadf461`, real storage/IPC handlers, real fs temp dir; only the Electron transport and dialogs are stand-ins (harness). Negative controls (not committed, files restored, diffs verified clean): drop live balances in `reposition` → 2 engine tests fail; no-op `move` in `perform` → 2 replay tests fail; drop the ally from the default layout → 9 store tests fail, begin error = library `E-SPAT-01` `positions.brynn`.
- surprises: (1) Checkpoint boundary drawn slightly wrong: adding `move` to the engine `ScriptEntry` at c1 broke the store's `record` body type against `FightScriptEntry`, so the model.ts type change (DB names, types only) landed at c1 instead of c3, with a mechanical store `begin` unpack and a replay.test `LiveFight` fix; storage validation stayed at c3. (2) Reposition precondition order is spatial → open offer → phase (the prompt listed phase first). The first declare in a test fight often opens an offer, so checking the phase first would hide the offer refusal; all three stay distinct and named. (3) The store's `characters` parameter is widened to include `subscribe`, so a character change (new ally id) relayouts. The prompt listed only enemy/world roster changes, but otherwise the placement would be keyed to a stale ally id. (4) `move` does not change store `positions` (placement for the next Begin); live positions are in `state.combatants[id].position`. (5) Far-apart probe: in dark-fantasy the wight acts first, so the `valid` rejection is proven on the wight's `cut-down`; zombie-urban's `shambler-claw` gives the `spatial` case.
- followUp: SESSION-02: Placement board reads `defaultPositions`/`positions`, calls `setPosition`/`resetPositions`; the combat board reads positions from `state.combatants[id].position` and distance via an engine `distance` re-export (the store currently re-exports `listSpawnable`, `spatialLabel`, `spawnProfile` and type `Position`; exposing `distance`/`spatialOf` to views needs a store re-export in S02's lease or a store lease). Reposition control → `store.move(completeMap)`; refusals arrive in `error` (`operation 'combat:move'`). Packaged CAP-06/CA-12/CA-13/CA-14 proofs + e2e combat/replay repair remain SESSION-02 c3 (e2e not run here, still red). SESSION-04 adds `start.allySpawns` to model/storage/replay and must extend `Sides`/`begin` for multiple allies (`reposition` already re-states every ally). SESSION-06 Resume can reuse `perform(live, entry)` over the stored script.
- Orchestrator receive: 3 commits = handoff checkpoint 3; `git show --name-only` of each ⊂ lease r2; `tests/main/ipc.test.ts` diff = the one assertion (F1). Orchestrator re-ran `pnpm typecheck` rc 0, `pnpm lint` rc 0, `pnpm test` 18 files 217/217 @ `3ec636e`; Custom Rule 1 grep empty. Arch delta consumed → `268a2f1` (M01, M02, M06, M09). Accepted. Surprise (1) c1/c3 boundary → Granularity feedback for Planner. Surprises (2)–(4) accepted as recorded (named refusals kept distinct; character subscription keeps ally id current; `move` leaves the next-Begin placement). followUp routed: views need `spatialOf`/`distance` → SESSION-02 lease r2 (store re-export only); multi-ally `Sides`/`begin` → SESSION-04 (already its scope); Resume via `perform` → SESSION-06.

### SESSION-02 — done 2026-09-28 (3/3: `58fb329`, `bde3bd2`, `f8ef15c`; lease r2)
- notes: - Lease revision r2 acknowledged (r1 = plan rev 2; nothing accepted under r1).
  - Grid UI and packaged proofs landed: `58fb329` c1, `bde3bd2` c2, `f8ef15c` c3. The e2e failures that remained after SESSION-01 are fixed: the combat and replay specs pass.
  - CAP-06 is proven in the packaged app. The Electron app is real, the engine runs in the renderer, and main storage, IPC and restart are real. CAP-09 and CAP-10 e2e legs are restored.
  - CA-12, CA-13 and CA-15 are proven in the packaged app. CA-14 has its packaged record → restart → replay proof, with `start.positions` and exactly one `move`.
  - Producers landed:
    - M08 `Board`, `TokenMark`, `BoardPiece` (the design's Board token row).
    - M14 `PlacementPanel` in `views/fight/index.tsx`.
    - M15 `views/combat/board.tsx` `CombatBoard` (Combat board + Reposition control).
    - The `controls.tsx` rejection card now matches the design row.
    - The store re-exports `distance`, `spatialOf` and type `SpatialDef` (the only store edit).
  - Design sources: `9cb5aa8` rows Board token, Placement board, Combat board, Reposition control, Declare rejection examples. The Spatial caption row is left to SESSION-03 (DF-CX-1 scope).
- verification: - **c0 baseline:** `pnpm exec playwright test --list` gave 18 tests in 8 files. `pnpm e2e e2e/combat.spec.ts e2e/replay.spec.ts` gave 4/4 failed. The CAP-09 run expected `theater-of-mind · seed 42` but saw `grid · seed 42`. The other three failed on reference `startCombat` E-SPAT-01 "brynn has no position". The app's own Begin worked with the default layout.
  - **c1 and c2:** `pnpm typecheck` rc 0, `pnpm lint` rc 0, `pnpm test` 18 files 217/217, `pnpm build` rc 0 (under `e2e:out`).
  - **c3:**
    - `pnpm e2e e2e/combat.spec.ts e2e/replay.spec.ts`: 7 selected. First run was 6 passed and 1 failed (a test-selector bug); after the fix, `-g theater` selected 1 and passed.
    - Final gate `pnpm verify` rc 0: check:engine ok, typecheck/lint 0, unit 217/217, e2e 21/21 in 8 files. That is the 18 existing tests plus 3 new ones, as intended.
    - `test-results/build-identity.json`: head `f8ef15cbcd0fb9f1005bbebb4fe6a3b788132e66`, dirty false (committed before verify).
  - **CA-12 assertions** ("CAP-06: grid fight …"):
    - Every `combat-token-<id>` `data-x`/`data-y` equals the reference fight's `state.combatants[*].position`, after Begin, after the move and at combat-over.
    - `combat-spatial-def` contains `JSON.stringify(pack.spatial)`, with the pack read from userData.
    - The Placement board's positions after the x-input edit equal the wight at x+5.
  - **CA-13 assertions:**
    - Reposition is enabled after rejected declares.
    - After Apply: tokens moved, `combat-event` count unchanged, and the reference `serializeCombat` → `deserializeCombat` (live balances re-stated) emitted 0 events. No error card appears.
    - The next declare is accepted and the log stays in lockstep until combat-over. Reposition is disabled after the declare and after the fight ends, with `combat-move-unavailable` text equal to the design line.
  - **CA-15:** each `combat-distance-<id>` equals `ref.fight.runtime.spatial.distance(active, c)`, before and after the move.
  - **Rejections:** the active combatant's declares produce kinds including `valid` and `spatial`. The card contains `declare:rejected · <kind>`, the payload message verbatim and `why.rule`.
  - **CA-14** (replay.spec "CAP-06 / CA-14 …"):
    - The stored `start.positions` equals the placement read before Begin.
    - `script.filter(op === 'move')` equals exactly `[{ op: 'move', positions: moved }]`, and the whole script equals the UI's calls.
    - Stored events equal the reference byte for byte, and outcome is `complete`.
    - After `rw.restart()`: Replay gives `data-status` `complete`, `fight-replay-event` count equals `doc.events.length`, and there are 0 divergences.
  - **Theater path:** the dark-fantasy·42 pack with `spatial` removed is pasted through Import. There is no `fight-placement`, the chip reads `theater-of-mind`, Begin works, there is no `combat-board`, and the rows equal the reference without positions.
  - **Negative control** (not committed): the expected Brynn x after the move was changed from +4 to +3. CAP-06 then failed (`toEqual` expected 3, received 4). The file was restored and confirmed identical with `cmp`.
  - **Rendering checks (DOM geometry and computed style), dark-fantasy mood, wide (1280) and narrow (900):**
    - Fight and Combat have 0 horizontal overflow.
    - Below 1024px the placement rows stack under the board.
    - The combat board (256px) fits in the 320px column.
    - Colours: token sides use `--accent` / `--accent2`; the active glow matches the combatant-row glow; an invalid input gets the `--danger` border.
    - Tab order after Step is `combat-move` then records.
  - **Rule checks:** Custom Rule 1 lint passes. No reach or adjacency math in the UI (Rule 2). No paths over IPC (Rule 7).
- surprises: - **Premise correction:** the prompt put the rejection on Brynn's turn, but in dark-fantasy·42 the wight acts first. At distance 5 its turn cannot end, since both its actions are refused and `step()` never ends a turn at `awaiting-declare`. The journey therefore declares with the active combatant (the wight): `cut-down` → `valid · E-REF-01`, `grave-gaze` → `spatial · E-SPAT-01`. After Brynn is moved 4 right, the next declare hits. All asserted facts are unchanged.
  - **Unused test id:** `combat-move-<id>` is not used. The design moves the tokens themselves (`combat-token-<id>`) and has no per-combatant inputs, so I didn't invent any. Reposition ids are `combat-move`, `combat-move-apply`, `combat-move-cancel`, `combat-move-banner`, `combat-move-unavailable`.
  - **Unplanned change in `controls.tsx`:** the rejection card kicker changed from `combat:declare · DeclareRejection` to `declare:rejected · <kind>` to honor the design row. Existing assertions on message and `why.rule` still pass.
  - **CAP-10 has no move:** CAP-10 was fixed through setup only. The requested recorded move lives in the new replay test instead, to keep CAP-10's script and tamper assertions unchanged.
  - **Literal px values:** px geometry with no token (16px axis, 36/28 squares, 28/22/24 tokens, 2px gap, 9px badge, 52px inputs) is taken verbatim from design.md and the mocks; no tokens were minted.
  - **Lease slip:** I created `src/renderer/src/ui/Board.tsx` (outside the lease) by mistake and deleted it before any commit. No commit touched it, and all three commits contain only lease paths.
  - **Placement ids:** placement test ids go on the rows (`fight-place-<id>`), which always exist, so off-viewport combatants are still readable. I added `fight-token-<id>` for the board tokens.
  - **Leftovers:** the scratch inspection driver `.program/s02-look.mjs` (gitignored) was removed. No image viewer was available; screenshots were checked by DOM geometry only.
- followUp: - SESSION-03:
    - The Combat header has no spatial caption yet (DF-CX-1 "Spatial caption" row).
    - The Turn order panel goes between the Board and Combatants. The column order is Phase → Offers → Board → [Turn order] → Combatants → Records.
    - `.combat-dl` in `combat.css` is available for the detail grids.
  - SESSION-04: ally spawns will need `A2…` tokens. The Placement board takes its roster from `defaultPositions` keys and treats non-enemy ids as allies; the Combat board uses `live.sides`, so multiple allies already render.
  - SESSION-06: the Resume path should keep the board reading `live.sides`.
  - EG-4 (per-id reach) and EG-7 (burst targeting) remain engine gaps. There is no "in reach" hint and no burst targeting, by design.
- Orchestrator receive: 3 commits = handoff checkpoint 3; `git show --name-only` of each ⊂ lease r2 (store diff = the two re-export lines only). `src/renderer/src/ui/Board.tsx` (reported lease slip, deleted before commit) absent from tree and from every commit — no lease violation. Orchestrator re-ran `pnpm typecheck` rc 0, `pnpm lint` rc 0, `pnpm test` 217/217, and `pnpm e2e e2e/combat.spec.ts e2e/replay.spec.ts` 7/7 under `e2e:out` on a fresh build (identity head `f8ef15c`, dirty false). Arch delta consumed → `c02ec42` (M08, M09, M14, M15, M17). Accepted. CAP-06, CAP-09, CAP-10 verified; CA-12/13/14/15 verified. Surprises accepted: journey declares with the active wight (facts unchanged); `combat-move-<id>` not used (design moves tokens); rejection-card kicker per design row; CAP-10 kept move-free, the move is in the new replay test. followUp routed: Spatial caption + Turn order panel position → SESSION-03 envelope; A2… ally tokens → SESSION-04; Resume keeps `live.sides` → SESSION-06; EG-4/EG-7 remain engine gaps.

### SESSION-03 — done 2026-09-28 (3/3: `229cd74`, `462e296`, `a62ee03`)
- notes: Lease r1 (plan rev 2), design `9cb5aa8` DF-CX-1 rows, all honoured: Turn order panel, Initiative provenance block, Combatant detail, Action detail, Spatial caption. Commits: `229cd74` c1, `462e296` c2, `a62ee03` c3. CAP-01 and CAP-02 are proven in the built app, in lockstep with a Node reference fight on the same installed engine and stored pack. Producers landed:
  - M06 `slotGrants(rt)` (= `resolveSlotGrants(rt.pack).slots`) and `actionInfo(pack, id)` / `ActionInfo`; type `ActionCost` re-exported from `ruleswright/schema`.
  - M09 re-exports these plus `initiativeOf(log)`.
  - M15 new `order.tsx` `TurnOrderPanel`, `ActionDetail` and `CombatantDetail` in `controls.tsx`, and the spatial caption in `index.tsx`.
  - CA-01, CA-02, CA-03, CA-04 and CX-D3 are all verified.
- verification: - **Checkpoint 0:** probe facts reproduced on dark-fantasy·42:
    - `economy.turnSlots` = grants = `{main:1,move:1,reaction:1}` (`fromPackEconomy` true);
    - hexer balances `{pools:{ember:18},boundSlots:{"1":0}}`;
    - `turn:began.payload.slots` equals the refilled ledger;
    - `combat:start` = order `[w1,w2,brynn]`, initiative `["barrow-wight-1 +2",…]`, 3 roll strings, rule `combat.startCombat`.
    - `resolveSlotGrants` is present in `runtime.d.ts`; SESSION-02's board ids are present at HEAD.
  - **Checkpoint 1:** `pnpm typecheck` rc 0, `pnpm lint` rc 0.
    - `pnpm exec vitest run tests/engine/combat.test.ts tests/store/combat.test.ts` → 2 files, 34 tests (22 + 12; +3 and +1 new, as intended).
    - `pnpm test` → 18 files, 221/221.
    - Tests: slotGrants = `resolveSlotGrants(pack).slots` on dark-fantasy; zombie-urban (no economy) = the library default; `turn:began.slots` = grants; parry `triggerOn` `attack:rolled[target=self]`; cut-down `valid` `hasTarget(adjacent)`; ember-surge points `{pool:'ember',amount:2}`; no `effect`; unknown id and `constructor` → null; `initiativeOf(log).payload.order` = `state.order` after `begin()` and after a `move`, same event object.
  - **Checkpoint 2:** unit gates green; `pnpm build` rc 0 under the `e2e:out` lock.
  - **Checkpoint 3:** `pnpm e2e e2e/combat.spec.ts` → 6 selected, 6 passed (5 existing + 1 new).
    - Final `pnpm verify` rc 0: check:engine ok, typecheck/lint 0, unit 221/221, e2e 22/22 (21 baseline + 1).
    - `test-results/build-identity.json`: head `a62ee0335e3739b2aed401ec710af6ea5e82f784`, dirty false (committed before verify).
  - **CA-01 e2e:** order rows `[id, data-active]` = `ref.fight.state.order` with active = `ref.state.active`; `combat-initiative` contains every reference `why.rolls` string, the joined `payload.initiative` and `why.rule`; checked again after the reposition.
  - **CA-02 / CA-04 e2e:** after every UI host call, in lockstep with the reference:
    - `combat-ledger-<id>` chips exactly equal `name remaining/grant` for every grant key;
    - `combat-pools-<id>` and `combat-bound-<id>` match (or are absent), and `combat-conditions-<id>` holds each `conditionId · duration` (or "no conditions");
    - `combat-order-position` = `round R · turn T+1 of K`.
    - A wight's Step emits `turn:began` with slots equal to the refilled ledger (`main 1/1`).
    - After the wight's `grave-gaze`, Brynn's conditions show `restricts spells.tagged:casting` from the pack.
  - **CA-03 e2e:** on Brynn's turn, one square from barrow-wight-1 (library distance = `reach.default`):
    - `cut-down` → detail shows `Action · cut-down`, the cost JSON (`"main":1`) and `hasTarget(adjacent)`;
    - declare at barrow-wight-1 → accepted, ledger `main 0/1`;
    - declare again → the `combat-rejection` card holds `declare:rejected · slot-exhausted`, the reference message, resource and `why.rule`, and the ledger text is unchanged.
  - **Reposition leg:** SESSION-02 control, Brynn moved one square down. Tokens = reference positions; 0 new events; order panel, ledger and condition texts identical before and after.
  - **Layout:** no horizontal overflow at 1280 (column right of the log) or 900 (column below the log).
  - **Negative control (not committed):** expected `main 0/` changed to `main 1/` → test failed (`Expected substring "main 1/1"`, `Received "main 0/1move 1/1reaction 1/1"`); file restored and confirmed identical with `cmp`.
  - **Boundary:** grep for `from 'ruleswright` outside `engine/` is empty.
  - Real boundaries: built Electron app via `e2e/fixtures.ts` with isolated userData; engine in the renderer; real main storage/IPC; world and character created in the app. The reference is the installed engine in the test process on the stored `pack.json`.
- surprises: - **Slots refill on the first Step:** the engine refills the ledger and emits `turn:began` on the first `step()` at `awaiting-declare`, not when the turn changes. barrow-wight-1's round-2 `grave-gaze` was therefore refused `slot-exhausted` (`main 0/1`). The journey now steps first; no assertion was weakened.
  - **"main 1" wording:** the prompt's step 3 says the Action detail shows `main 1`. The design renders the cost as JSON verbatim, so the test asserts `JSON.stringify(pack.actions['cut-down'].cost)` and `"main":1`.
  - **Absent action fields:** "absent parts omitted" (CA-03) versus the design's "absent field = `—`". The data carries null and the view renders `—` per the mock.
  - **Condition step added:** the journey adds barrow-wight-1's `grave-gaze` (hexbound) so CA-04's non-empty and `restricts` path is proven, not only "no conditions".
  - **Step 3 not rearranged:** it ran literally: the default placement already puts Brynn one square from barrow-wight-1, and the lockstep reaches Brynn's turn after both wights.
  - **Accessibility:** each `summary` gets `aria-label="Detail · <name>"` so the three disclosures are distinguishable; the visible text stays "Detail". Real engine names render (the ally's library name is `brynn`, not the mock's "Brynn").
  - **Untokened geometry:** px values with no token are taken verbatim from the mock (10px row gap/padding, 18px glow, 86px label column, which comes from the existing `.combat-dl`). No tokens were minted and there is no `!important`.
  - **At the 320px column** the `restricts spells.tagged:casting` line wraps to two lines inside the detail; it does not overflow.
  - No image viewer: the renders were checked by DOM geometry and computed style. The scratch probes and inspection driver in `.program/` were removed.
- followUp: - SESSION-04: ally spawns will add `combat-order-<id>` and `combat-ledger-<id>` rows automatically (both keyed from `state.order`).
  - EG-3 (conditions never tick in combat) is shown honestly as whatever duration the library holds.
  - The fact that slots only refill on the first Step (see surprises) may deserve a design or requirements note. It is the library's behavior; the UI shows it and does not change it.
  - No remaining proof owners for CAP-01, CAP-02 or CA-01..04.
- Orchestrator receive: 3 commits = handoff checkpoint 3; `git show --name-only` of each ⊂ lease r1 (ui/* untouched). Orchestrator re-ran `pnpm typecheck` rc 0, `pnpm lint` rc 0, `pnpm test` 221/221, `pnpm e2e e2e/combat.spec.ts` 6/6 under `e2e:out` (identity head `a62ee03`, dirty false); Custom Rule 1 grep empty. Arch delta consumed → `e033c16`. Accepted. CAP-01, CAP-02 and CA-01..04 verified. Surprises accepted: step-first for the slot refill (library behavior, no assertion weakened); cost asserted as verbatim JSON per design; `—` for absent fields per mock; condition leg added. followUp routed: ally rows in order/ledger are automatic → SESSION-04 envelope; slot-refill-on-first-Step → Final Report follow-up (product note for Author/Spec, no UI change); EG-3 stays an engine gap.

### SESSION-04 — done 2026-09-28 (4/4: `497ab84`, `d88b071`, `9324268`, `bd10c7b`)
- notes: CAP-03 (ally-side spawns) complete: unit restart leg at c2, packaged proof at c4. Lease r1 (plan rev 2), DB `af47822` name `start.allySpawns` used verbatim, design `9cb5aa8` "Ally spawn row (CX)". Commits: `497ab84` c1, `d88b071` c2, `9324268` c3, `bd10c7b` c4. CA-04b: producer `engine/combat.ts` `SpawnSpec` (with `EnemySpec = SpawnSpec`), `FightStart.allySpawns?`, `begin(rt, ally, enemies, positions?, allySpawns = [])`; `replay.ts` passes `rec.start.allySpawns ?? []`; model `FightStartDoc.allySpawns?`; storage `isSpawns`. CA-05: `begin` duplicate-id refusal before `spawnMonster`/`startCombat`; store `spawnOf` is one allocator over both rosters plus the ally id. CA-06: legacy records unchanged. CA-12 extended: store `relayout` puts `[character, ...allySpawns]` at x=0.
- verification: - **c1:**
    - `pnpm typecheck` rc 0 and `pnpm lint` rc 0.
    - `pnpm exec vitest run tests/main/storage.test.ts tests/engine/combat.test.ts tests/engine/replay.test.ts` → 3 files, 57/57: storage 20 (+2), combat 25 (+3), replay 12 (+3).
    - `pnpm test` → 18 files, 229/229.
    - Negative control, not committed: disabling the CA-05 guard failed exactly the 2 CA-05 tests. File restored.
  - **c2:**
    - `pnpm exec vitest run tests/store/combat.test.ts` → 1 file, 17/17 (+5).
    - `pnpm test` → 234/234; lint rc 0.
    - Negative control, not committed: dropping ally spawns from the layout failed 3 store tests. File restored.
  - **c3:**
    - Unit gates green; `pnpm build` rc 0 under the `e2e:out` lock.
    - Render check by DOM geometry and computed style in dark-fantasy·42 at `setViewportSize` 1280 and 900 (a first attempt with window `setSize` did not resize, because the window has a 1280 minimum width):
      - 0 horizontal overflow; nothing overflows the Allies panel.
      - Spawn rows 62px tall and 8px apart, after the character row.
      - The remove button is `btn btn-ghost btn-s` and its computed style equals the enemy remove button.
      - The note sits above the add row; Tab from the picker reaches the submit button.
      - Placement rows: brynn (0,0) A1, hill-spider-1 (0,1) A2 "hill-spider", grave-shambles-1 (0,2) A3, barrow-wight-1 (1,0) E1.
      - After Begin the Combat board has an A2 ally token and the order list includes the spawn.
  - **c4:**
    - `pnpm e2e e2e/combat.spec.ts e2e/replay.spec.ts -g CAP-03` → 2 selected, 2 passed.
    - Final `pnpm verify` rc 0: check:engine ok, typecheck and lint 0, unit 18 files 234/234, e2e 24/24 (22 baseline + 2).
    - `test-results/build-identity.json`: head `bd10c7bbad79306ae17755e575187e689151810a`, dirty false.
  - **CA-04b evidence:**
    - combat.test 'ally spawns (CA-04b)': `sides.allies` ids = [brynn, hill-spider-1]; spider side `allies` at (0,1).
    - combat.test reposition test: CA-13 equality list holds with the spider, 0 events.
    - replay.test 'CA-04b': complete with identical events; removing `allySpawns` gives a result other than complete.
    - store.test 'restart leg': real main handlers via `tests/support/in-process-bridge.ts` on a temp dir; stored `start.allySpawns` = `[{hill-spider, hill-spider-1}]`; the spider acted; a new bridge and new stores replay `complete` with byte-equal events.
    - e2e replay.spec 'CAP-03 / CA-04b': stored `start.allySpawns` equals the Allies panel rows `[{statblockId:'hill-spider', instanceId:'hill-spider-1'}]`; `start.positions` = placement; script = the UI's calls; events equal the reference; after `rw.restart()` replay `data-status` complete, event count = doc, 0 divergences.
  - **CA-05 evidence:**
    - combat.test: 4 collision cases, each with the exact message and 0 events.
    - replay.test: `error` with `fight:begin` and 0 events.
    - store.test: `begin()` false, the exact error, fight/live/start null, log/script empty, runtime event count unchanged.
    - Allocator: the next hill-spider gets hill-spider-2 or hill-spider-3 across sides, and a freed n is reused.
  - **CA-06 evidence:** replay.test legacy record complete with no `allySpawns` key; storage.test a start without the field saves, loads and lists; the store's begin without spawns writes no key.
  - **CA-12 evidence:** store.test default layout and key order; e2e placement keys [brynn, hill-spider-1, barrow-wight-1] with token A2.
  - **e2e combat.spec 'CAP-03':** order rows = `ref.fight.state.order` with active; `combat-order-hill-spider-1` shows `allies`; tokens = reference positions; lockstep row count after every call; spider declared at least once; `combat-over` banner winner/defeated = reference `combat:ended`.
  - **Negative control at c4 (not committed):** after recording, `start.allySpawns` was deleted from the stored file and the app restarted → replay **diverged at event 0**, not a library refusal. The file was restored, confirmed by grep, and committed clean.
  - Real boundaries: the built Electron app via `e2e/fixtures.ts` (isolated userData, restart on the same dir), real main storage/IPC, and the installed engine `dadf461`. The reference fight is the installed engine in the test process on the stored `pack.json`.
- surprises: - **Mapping result, negative control:** with `allySpawns` removed, the library accepted a `positions` map that names a combatant not in the fight. Replay reports diverged at event 0 rather than a refusal.
  - **Design over plan:** the spawn row meta follows the design row (`spawnMonster · <instanceId> · ally side`), not the plan's `spawnMonster · <statblockId> · hp · ac · actions`; the plan's test ids are kept. The add control mirrors the enemy panel (Field "Ally bestiary spawn" + Select + "+ Add bestiary spawn", without the mock's "…"), because the mock draws only the button.
  - **Placement board fix inside the lease:** `index.tsx` `PlacementPanel` treated every non-enemy id as the character for naming, so a spawn would have shown the character's name. Sides are now decided by enemy-roster membership, and names come from both rosters.
  - **No `fight.css` change:** the rows reuse `.fight-stack` and `.fight-row`, and no new px values were added.
  - The scratch inspection driver `.program/s04-look.mjs` and the `/tmp` captures were deleted.
- followUp: - SESSION-05: `assembleEnemies` must use the store's shared `spawnOf` allocator (CA-05) and keep `allySpawns` in the layout. `begin` still refuses collisions.
  - SESSION-06: Resume should call `begin(..., rec.start.allySpawns ?? [])` through the same seam as `replay.ts`.
  - No remaining proof owners for CAP-03, CA-04b, CA-05 or CA-06.
- Orchestrator receive: 4 commits = handoff checkpoint 4; `git show --name-only` of each ⊂ lease r1 (`fight.css` untouched). Orchestrator re-ran `pnpm typecheck` rc 0, `pnpm lint` rc 0, `pnpm test` 234/234, `pnpm e2e e2e/combat.spec.ts e2e/replay.spec.ts` 10/10 under `e2e:out` (identity head `bd10c7b`, dirty false); Custom Rule 1 grep empty. Arch delta consumed → `79fe4fc`. Accepted. CAP-03, CA-04b, CA-05, CA-06 verified. Surprises accepted: design row governs spawn meta text (plan test ids kept); add button without "…" mirrors the enemy panel; PlacementPanel naming fix inside the lease. Negative-control finding (library accepts a `positions` key for a missing combatant; replay diverges at event 0 instead of refusing) → Final Report residual gap, engine program as owner (EG class, alongside EG-1). followUp routed: shared `spawnOf` allocator → SESSION-05 envelope; Resume passes `rec.start.allySpawns ?? []` through the replay seam → SESSION-06 envelope.
