# State Tracker — Ruleswright (UI) / combat-complete

## Program / Feature / Intent / Sessions
- **Program:** Ruleswright (UI) (`ruleswright-ui`)
- **Feature:** `combat-complete`
- **Intent:** the Combat and Fight surfaces cover everything the installed Ruleswright engine supports for
  combat: turn order + initiative, per-turn action economy, pools/bound slots, conditions, action costs,
  both-sided assembly, threat-budget encounters, and resume. Spatial play is reported honestly: the engine
  cannot enable it today.
- **Human request (verbatim, 2026-09-27):** "can you make the combat section fully implment what
  ruleswrights supports, turn order, spatial location, etc"
- **Sessions:** 4 (SESSION-01..04) + Author re-entries (DF-CX-1 design-fill; AUTHOR-DB-CX, AUTHOR-SPEC-CX,
  AUTHOR-DESIGN-CX pending human answers). See `AUTHOR-REQUEST-CX.md`.
- **Plan base:** UI HEAD `01d2457`; engine `../Ruleswright` HEAD `f792f49` (clean); installed dist current.

## Session Status
| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---------|---------|------|--------|------------|-----------|-------|
| 01 | Combat surface: turn order, initiative, action economy, conditions | M06 M09 M15 M08? M17 | `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/combat/{index,controls,order}.tsx`, `src/renderer/src/views/combat/combat.css`, `src/renderer/src/ui/{Combat.tsx,ui.css,index.ts}`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts` | pending | — | — | waits on DF-CX-1 (design-fill, no human) |
| 02 | Both-sided assembly: ally-side spawns, recorded + replayed | M01 M02 M06 M09 M14 M17 | `src/shared/model.ts`, `src/main/storage.ts`, `src/renderer/src/engine/{combat,replay}.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{index.tsx,fight.css}`, `tests/main/storage.test.ts`, `tests/engine/{combat,replay}.test.ts`, `tests/store/combat.test.ts`, `e2e/{combat,replay}.spec.ts` | pending | — | — | waits on Q1 = (a) → AUTHOR-DB-CX |
| 03 | Encounter assembly by threat budget | M06 M09 M14 M17 | `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{index.tsx,fight.css}`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts` | pending | — | — | waits on Q2 = (a) → AUTHOR-SPEC-CX + AUTHOR-DESIGN-CX; `skipped` on Q2 = (b) |
| 04 | Resume a recorded fight | M06 M09 M14 M17 | `src/renderer/src/engine/replay.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/{records.tsx,fight.css}`, `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`, `e2e/replay.spec.ts` | pending | — | — | waits on Q3 = (a) → Spec + Design; `skipped` on (c); **replan** on (b) |

Brace globs in this table are shorthand. Each SESSION-NN.md `Owns` line lists exact paths, and that line is
the lease.

## Wave Plan
| Wave | Sessions | Why concurrent |
|------|----------|----------------|
| A0 | DF-CX-1 (Designer design-fill), and — after human answers — AUTHOR-DB-CX, AUTHOR-SPEC-CX, AUTHOR-DESIGN-CX | Author workers. DF-CX-1 writes `specs/design.md` + `mocks/combat.html`; AUTHOR-DESIGN-CX writes `specs/design.md` + `mocks/fight.html`. **Both write `design.md`, so serialize DF-CX-1 → AUTHOR-DESIGN-CX** (or merge them into one Designer worker once Q2/Q3 are answered). DB (`database.md`) and Spec (`requirements.md`) are disjoint and may run alongside |
| 1 | SESSION-01 | Alone: every session owns `src/renderer/src/store/combat.ts` |
| 2 | SESSION-02 | Alone: shares `store/combat.ts`, `engine/combat.ts`, `tests/*/combat.test.ts`, `e2e/combat.spec.ts` with 01 and 03 |
| 3 | SESSION-03 | Alone: shares `views/fight/index.tsx`, `engine/combat.ts` and `store/combat.ts` with 02 |
| 4 | SESSION-04 | Alone: shares `store/combat.ts`, `engine/replay.ts` and `e2e/replay.spec.ts` with 02 |

No session pair is concurrent. All four hold the combat store, which is the one coherent spine of this
feature. Splitting that file to buy parallelism would add a merge surface with no benefit.

## Dependency Graph
```
DF-CX-1 ──► S01 ──► S02 ──► S03 ──► S04
Q1=a ► AUTHOR-DB-CX ──┘      ▲        ▲
Q2=a ► AUTHOR-SPEC-CX + AUTHOR-DESIGN-CX ─┴────────┘ (Q3=a part)
Q4   ► no UI session (engine program, outside this repo)
```
If S03 is skipped, S04 depends on S02 directly.

## Architecture Reference (feature-specific)
- Views reach the engine only through `store/combat` (existing convention). `engine/` stays the only
  `ruleswright` importer (Custom Rule 1).
- New engine surface used: `resolveSlotGrants` (S01), `assembleEncounter`/`spawnEncounter`/`Encounter`
  (S03). All exist in the installed dist (`ruleswright/runtime` barrel, probed 2026-09-27).
- Engine surface deliberately **not** used: `gridGeometry`/`checkReach`/`inBurst` (no pack can enable
  them; CX-D1). `deserializeCombat` (lossy for this host; CX-D6). `checkCost` as a pre-judgement (the
  declare result is the authority; CX-D4).

## Scope Summary
| ID | Module | Change |
|----|--------|--------|
| M01 | shared | S02: `FightStartDoc.allySpawns?` (DB-approved only) |
| M02 | main | S02: validate `start.allySpawns` |
| M06 | engine | S01 `slotGrants`, `actionInfo`. S02 `SpawnSpec`, `begin(…, allySpawns)`, replay spawns. S03 `assemble`. S04 `resume` |
| M08 | ui | S01, only if DF-CX-1 adds a component |
| M09 | store | S01 re-exports + `initiativeOf`. S02 ally roster + CA-05. S03 `assembleEnemies`. S04 `resume` |
| M14 | views/fight | S02 Allies panel. S03 Assemble row. S04 Resume |
| M15 | views/combat | S01 `order.tsx`, combatant + action detail, spatial caption |
| M17 | tests | each session's proofs |
| — | engine repo | none (never edited). Gaps reported in AUTHOR-REQUEST-CX |

Out of scope, with a disposition for each:
- **Grid/positions/reach (CAP-06):** blocked on an engine program (Q4). Evidence: `new Runtime(pack +
  spatial)` → `E-SCHEMA-02 @ spatial` on all 3 themes. `CombatantState` has no position. `declare` never
  calls `checkReach`.
- **Downed/skipped labels:** withheld (CX-D3). Engine gap: `isDowned` is not exported.
- **Condition ticking in combat, character conditions carried into combat:** engine gaps. The UI displays
  only what the library holds.
- **Multiple player characters:** FR-11 "Ally side is the active character". A party is a requirements
  change nobody asked for. Not planned.

## Design Decisions
| ID | Choice | Rationale |
|----|--------|-----------|
| CX-D1 | No spatial UI (positions/grid/reach) in this feature | No pack can declare `spatial` (E-SCHEMA-02). The combat loop ignores geometry. A UI grid would be UI-invented rules (Custom Rule 2) and contradicts FR-11. Routed to the human (Q4) and the engine program |
| CX-D2 | The turn order + economy display is **design-fill** (DF-CX-1), not a design-change | FR-11/12/16 already require round/active/pending actions and readable cost rejections. It decides how required information looks, with no new behavior |
| CX-D3 | No "down"/"skipped" labels | `hp ≤ 0 ⇒ down` is an engine rule (`isDowned`, not exported). Copying it is rules math. Show hp verbatim; report the missing export |
| CX-D4 | Action detail shows the pack's cost/tags/trigger verbatim; no affordability preview | `Combat.declare` gates in the order action → restriction → target → cost. A preview via `checkCost` would disagree with declare whenever restriction/target fail first. The declare result stays the authority (FR-12) |
| CX-D5 | Threat assembly with empty `groups` leaves the roster unchanged and shows the library's summary | The narrowest reversible behavior. Nothing is discarded silently |
| CX-D6 | Resume = re-apply the recorded script on the stored pack, and adopt only on identical events | Lossless (pools, bound slots, offers, log). No DB change. `deserializeCombat` drops the live balances and restarts `offerIndex` for this host. Human confirms (Q3) |
| CX-D7 | One id allocator over both rosters (`${statblockId}-${n}`), and `begin` refuses duplicates | The engine silently merges duplicate ids (probe). Refusing is host input validation, not a rule |
| CX-D8 | All four sessions are serial | They share `store/combat.ts`, the feature's spine. Parallelism would need an artificial split |

## Verification Baseline
Inspected: `package.json` scripts via PROGRAM-CONFIG (unchanged since v1-shell), `playwright.config.ts`
+ `e2e/fixtures.ts` (restartable isolated userData via `RULESWRIGHT_USER_DATA`, `rw.restart()`),
`e2e/global-setup.ts` (rebuilds `out/`, writes `test-results/build-identity.json`), loot-inventory
STATE Verification Baseline + Handoff Notes.

| Command | Effective | Evidence | Source |
|---|---|---|---|
| `pnpm check:engine` | `node scripts/check-engine.mjs` | **actual** 2026-09-27 @ `01d2457`: `engine ok: ruleswright@0.1.0` | Planner run |
| `pnpm test` | `vitest run` | **actual** @ `01d2457`: 18 files, **199/199**, 1.17 s | Planner run |
| `pnpm typecheck`, `pnpm lint` | per PROGRAM-CONFIG | **inherited** green @ `0452776` (loot-inventory wave close); not re-run by Planner | loot-inventory STATE |
| `pnpm e2e` | `playwright test` (globalSetup rebuilds `out/`) | **inherited** 18/18 @ `0452776`, 52.8 s, build identity dirty false; not re-run (exclusive `e2e:out`, GUI) | loot-inventory STATE |
| `pnpm verify` | all of the above | **inherited** rc 0 @ `0452776` | loot-inventory STATE |

Commits since `0452776` (`e14f2e4`, `01d2457`) touch only `program/` files. Source is unchanged, so the
inherited results stand for the source. They are still inherited, not re-observed.

Hazards (carried from v1-shell/loot-inventory, still open):
- **H-1** `e2e:out` is exclusive. Build/e2e steps hold it; serial sessions make this trivial.
- **H-2** e2e needs a GUI session (Electron).
- **H-3** `file:` engine copy. `check:engine` catches staleness. **Do not rebuild `../Ruleswright/dist`
  while a session runs.**
- **H-5** `program/ruleswright-ui/prompts/` is gitignored; commit with `git add -f`.
- Build identity is `dirty: true` whenever uncommitted files exist at build time. Workers record it;
  Orchestrator's wave-close `pnpm verify` on a clean tree is the clean record.

## Capability Readiness
| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|----|----|----|----|----|----|----|----|
| CAP-01 | FR-11/12: turn order + initiative on Combat | `combat:start` event (engine, ready); `state.order/turn/active/round` (engine, ready) | CA-01; DF-CX-1 | S01 c3 `e2e/combat.spec.ts` | planned | probe: `combat:start` at `{round:0}`, payload `{order, initiative}`, `why.rolls` `d20[n]+b=t (id)` | DF-CX-1 (Designer) |
| CAP-02 | FR-12/16: slot ledger, pools, bound slots, conditions, action cost | `slots.remaining`, `pools`, `boundSlots`, `conditions` (engine, ready); `resolveSlotGrants` (engine, ready); `pack.actions` (pack) | CA-02, CA-03, CA-04; DF-CX-1 | S01 c3 | planned | probe: dark-fantasy grants `{main,move,reaction:1}`; hexer balances `{ember:18}`, `{"1":0}` | DF-CX-1 |
| CAP-03 | FR-11: ally-side bestiary spawns; recorded, restart, replay | `startCombat` multi-ally (engine, ready); FightDoc `start.allySpawns` (DB, **unapproved**) | CA-04b, CA-05, CA-06; Q1 | S02 c4 `e2e/combat.spec.ts` + `e2e/replay.spec.ts` | blocked | probe: allies `[vey, hill-spider-a1]` accepted; duplicate ids merge silently | Q1 (human) → AUTHOR-DB-CX |
| CAP-04 | FR-11 (amendment, **unapproved**): threat-budget encounter | `assembleEncounter`/`spawnEncounter` (engine, ready) | CA-07, CA-08, CA-05; Q2 | S03 c3 | blocked | probe: df·42 b3 s7 → barrow-wight×1; zu·42 → grave-shambler×2 | Q2 (human) → Spec + Designer |
| CAP-05 | FR-14 (amendment, **unapproved**): resume a recorded fight | FightDoc `start/script/events` (DB, ready); `replay.ts` rebuild path (UI, ready) | CA-09, CA-10, CA-11; Q3 | S04 c3 `e2e/replay.spec.ts` | blocked | `engine/replay.ts` read; `database.md` FightDoc read | Q3 (human) → Spec + Designer |
| CAP-06 | Spatial positions/reach | **no producer**: pack schema rejects `spatial`; `Combat` has no positions | Q4 | engine program (outside this repo), then a UI follow-up feature | blocked | probe E-SCHEMA-02 × 3 themes; `combat.ts` source read | Q4 (human); engine program owner |

## Contract Agreements
| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|----|----|----|----|----|----|----|----|
| CA-01 | Initiative is the library's, verbatim | `startCombat` → `combat:start` → store log → `initiativeOf` → TurnOrderPanel | payload/why strings unparsed; order from `state.order`; absent → "not in this log" | S01 c1 unit, c3 e2e | agreed | ready | planned. Sources: `../Ruleswright/src/runtime/combat/combat.ts` `startCombat`; probe |
| CA-02 | Ledger = remaining vs grant, both library numbers | `CombatantState.slots.remaining` + `resolveSlotGrants(pack).slots` → CombatantsPanel | `name r/g`, no arithmetic | S01 c1, c3 | agreed | ready | planned. Sources: `action-economy.ts`; probe |
| CA-03 | Action detail = pack verbatim; no pre-judgement | `pack.actions[id]` → `actionInfo` → PhasePanel | `cost.slots/points/vancian`, `tags`, `trigger.on` | S01 c1, c3 | agreed | ready | planned. Source: `artifacts.ts:31` |
| CA-04 | Conditions as held | `CombatantState.conditions` + `pack.content.conditions[id].restricts` → CombatantsPanel | `{conditionId, duration}` verbatim | S01 c3 | agreed | ready | planned |
| CA-04b | FightDoc records ally spawns losslessly | store `start.allySpawns` → IPC → main validation → disk → replay `begin` | additive optional; written only when non-empty; order = startCombat ally order after the character | DB (Q1); S02 c1–c4 | **unresolved** (awaiting DB) | planned | provisional against AUTHOR-DB-CX. Orchestrator re-checks the committed field name before S02 dispatch |
| CA-05 | Combatant ids unique across sides | store/replay → `startCombat` | refuse on collision; one allocator | S02 c2 (store), c1 (replay); S03 c1 | agreed | planned | engine gap evidence: probe (duplicate `x` → 1 combatant) |
| CA-06 | Legacy FightDocs unaffected | disk → load → replay | absent `allySpawns` = none | S02 c4 (existing CAP-10 e2e unchanged) | agreed | ready | planned |
| CA-07 | Encounter spawn pairing never rebuilds ids | `spawnEncounter` profiles + `encounter.groups` → `SpawnSpec[]` | instanceId from `profile.id`; statblockId by group expansion; proof `spawnMonster` deep-equal | S03 c1 | agreed (pending Q2) | ready | planned. Source: `encounter.ts` |
| CA-08 | Encounter summary verbatim | `Encounter` → Fight view | groups/threat/budget/seedUsed/heuristic | S03 c3 | agreed (pending Q2) | ready | planned |
| CA-09 | Resumed fight ≡ recorded fight | FightDoc → `resume` → store | `serializeCombat` deep-equal incl. rng + offers; adopt only if events are identical | S04 c1, c3 | agreed (pending Q3) | planned | planned |
| CA-10 | hpAtStart from begin, never from the record | `resume` → store | read after `begin`, before `perform` | S04 c1 | agreed (pending Q3) | planned | planned |
| CA-11 | Log continuity at adoption | `fight.runtime` events → store log | unsubscribe old → subscribe new → publish | S04 c1 | agreed (pending Q3) | planned | planned |

## Current Blockers
| ID | Affects | Next action | Owner | Evidence to clear |
|----|---------|-------------|-------|-------------------|
| B-CX-0 | S01, CAP-01/02 | Dispatch the DF-CX-1 design-fill worker (standing authority, no human) | Orchestrator → Designer | DF-CX-1 commit touching only `specs/design.md` + `mocks/combat.html` |
| B-CX-1 | S02, CAP-03, CA-04b | Human answers Q1 | human → DB | AUTHOR-DB-CX commit to `specs/database.md` |
| B-CX-2 | S03, CAP-04 | Human answers Q2 | human → Spec + Designer | Spec + Design commits |
| B-CX-3 | S04, CAP-05 | Human answers Q3 | human → Spec + Designer | Spec + Design commits (or replan on Q3 = b) |
| B-CX-4 | CAP-06 | Human answers Q4; if an engine program is wanted, it is opened in `../Ruleswright` | human; engine program | Engine accepts a pack `spatial` section and `Combat` tracks positions |

## Handoff Notes
(Orchestrator writes here after each session, from Coder's Handoff section, verbatim.)
