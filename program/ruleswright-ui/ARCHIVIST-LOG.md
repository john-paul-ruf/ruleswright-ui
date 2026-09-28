# Archivist Log — Ruleswright (UI)

One dated entry per Archivist run, append-only across cycles.

---

## 2026-09-26 — final pass (feature `v1-shell`, repo `7fac292`, code `98a14e3`, engine `01dcf77`, installed dist `01dcf77`)

**Reconciled.** Rewrote `arch/` (14 files) from appended "Realized — v1-shell SESSION-NN" deltas over planned text into one coherent realized-state description: every planned-API section now reads as realized, with session commits cited (M01 `77d8e63`, M02 `ca1d972`+`77d8e63`, M04 `f03f38d`+`6b9e658`, M05 `ae1c762`, M06 `5fcf552`/`5fcf552`+`33481cf`/`c38946e`/`18119f9`/`0ad13c8`/`33481cf`/`d310755`/`98a14e3`, M07 `5fcf552`, M08 `6b9e658`, M09 `5fcf552`/`ae1c762`/`511ec2b`/`18119f9`/`8ac723d`/`98a14e3`, M10 `ae1c762`/`db3ac6d`, M11 split `511ec2b`/`bfc2497`/`920f64a`/`e99a2e4`, M12 `d310755`, M13 `0ad13c8`, M14/M15 `269c0e8`/`bf33cd3`, M16 `ae1c762`, M17 `43f660c`/`17d435e`, M18 `ca1d972`/`dcac5c4`). Collapsed two fragments that said the same thing twice (the views' store + engine edges are stated once, in the flow line and the cycle note, not duplicated). Resolved the "known upcoming blockers on first occurrence" channel: the M12–M15 ↔ M10 module cycle, the M12 → M06 runtime import (`views/world` imports `engine/determinism.rerunUnavailableReason`), and the M01/M02 `FightDoc` B-2 envelope (`FightRecordMeta` list projection = envelope + outcome + `rng` + `round` + `eventCount`) are described as present in the tree, verified mechanically — not as future work.

**Module registry.** PROGRAM-CONFIG edges flipped from `[D]` to `[R]` by non-test import inspection only: every product edge is realized. Two module-level cycles recorded verbatim (M12–M15 ↔ M10 EmptyState; M12 → M06 `rerunUnavailableReason`), with the mechanical consequence noted — `rerunUnavailableReason` is a pure function, so the direct import exists rather than being routed through a store. Nothing invented; every edge cell checked against the import statements of every non-test file in the module.

**Module edges verified mechanically** (value imports, `import type` stripped, `export … from` treated as a runtime import — per the edge rule; grep settled nothing):
- M02 → M01: value imports (`MAX_DOC_BYTES`, `MAX_RECORD_NAME`, `MAX_WORLD_NAME`, `RECORD_NAME_PATTERN`, `IPC`, `RuleswrightApi` type) plus type-only `Channel`/`IpcError`/`IpcRequest`/`IpcResponse`/`WindowBounds`/`Settings` clauses from `../shared/*`. Realized edge.
- M03 → M01: value import `IPC` + type `RuleswrightApi`. Realized edge.
- M06 → M01 (errors.ts, schema.ts): type-only (`IpcError`/`IpcErrorCode`; `PackIdentity`) — `import type` stripped before resolution; the module still depends on the shared envelope types, so the edge is real but carries no runtime value import.
- M06 → `ruleswright` (ext): namespace + named value imports (`compiler`, `runtime`, `schema` surfaces). External, in every engine file.
- M07 → M01: value import `IPC`. Realized edge.
- M09 → M06/M07/M01: value imports `forge`/`listThemes` (engine), `getPersistence`/`setPersistence` (persistence client), shared caps/types; type-only members stripped before resolution. Realized edges.
- M10 → M09/M08/M05: value imports `useUiStore`/`Surface`, `useWorldsStore`, `Button`/`EmptyWell`/`Chip`, `applyMood`/`moodForTheme`. Read-only on `worlds`. Realized edges. `EmptyState.tsx` imports no views.
- M11 → M09/M08/M05/M06(types)/M01(types): value imports `useWorldsStore`, `Kicker`/`Chip`/`Panel`/`Button`/`Input`/`ErrorCard`/`ConfirmDialog`/`ThemeCard`, `moodForTheme` + `MOOD_GLYPH` (moods), `KnobSpec`/`ThemeInfo` types. Realized edges.
- M12 → M09/M08/M10/M06(runtime import — `rerunUnavailableReason`)/M01(types): `views/world/index.tsx` imports `rerunUnavailableReason` directly. Realized edge; recorded as the second module-level cycle (not file-level).
- M13 → M09/M08/M10/M06(types): engine types only. Realized edges.
- M14 ↔ M15: `views/fight/records.tsx` → `views/combat/log` (`LogRow`) and `views/combat/index.tsx` → `views/fight/records` (`RecordsPanel`, `RECORD_NAME_INPUT`). Realized cycle (module-level, no file-level cycle).
- M15 → M09/M08/M10/M14 (`RecordsPanel`)/M01(types). Realized edges.
- M16 → M10/M09/M05/M04 (CSS). Realized edges.
- M17 → all (each spec imports the modules it exercises; e2e computes expected values with the real library — import restriction exempted by config). Realized.
- M18: imports nothing (leaf).

**No contradictions found** between the realized arch text, PROGRAM-CONFIG, or either STATE (feature `program/ruleswright-ui/prompts/v1-shell/STATE.md`, run folder `prompts/v1-shell/STATE.md`). Every realized claim above was re-checked against the tree after writing (same discipline Coder applies to a diff before committing): nothing Archivist wrote contradicts the next line down in the same file, or a sibling file.

**Module registry integrity check.** Verified every `[R]` cell names a dependency that exists in the tree at `98a14e3` (grep-level): M01 `ipc-contract.ts`/`model.ts`; M02 all five files; M03 `index.ts`; M04 `tokens.css`/`base.css`/`fonts.css`; M05 `map.ts`; M06 all eight files; M07 `client.ts`; M08 `ui.css` + twelve `.tsx` files; M09 all five files; M10 all four files; M11–M15 all listed files. No dead entries, no stale paths.

**Module registry — symbol-vs-edge discipline.** One standing evidence pair is preserved rather than collapsed: the M17 boundary self-test (`tests/lint/boundary.test.ts`) proves Custom Rules 1 and 3 by linting synthetic code — a symbol-consumer question answered by grep would not settle the module edges the lint rule enforces, so the arch text keeps the two claims separate (module edges from imports; symbol consumption from grep) exactly as the framework requires.

**`PROGRAM-CONFIG.MD` — conventions.** No conventions minted this pass: the two-axis test (three distinct program cycles, or three distinct sessions/recoveries/checkpoint returns within one cycle) was applied honestly and neither axis is crossed by what this feature actually needed. The candidate observations below are recorded as `tracking` in `CLEANUP-LEDGER.md` (create-if-absent discipline; nothing was deleted, rewritten or auto-cleaned — Archivist scouts, it does not sweep).

**Standing recommendations** (full open backlog carried forward — every open observation, not this pass's additions):

| id               | pattern                   | cycles | in-cycle instances | first seen | status                              |
| ---------------- | ------------------------- | -----: | -----------------: | ---------- | ----------------------------------- |
| 785c75731e5e9eb6 | Plan-time probes should drive the actual host loop (declare → step → respond to the end), not read type declarations | 1 | 1 | v1-shell | open |
| 97641a906d3c0447 | A session that changes navigation should lease every spec that navigates through that surface | 1 | 1 | v1-shell | open |
| 0d4dfe658858963c | Human visual review of screenshot sets owed as final-report debt | 1 | 1 | v1-shell | open |
| cc00aa16e2f5e7f5 | electron-builder output dir (release/) absent from .gitignore | 1 | 1 | v1-shell | open |

**Proposed for the framework** (no threshold on this channel; recorded at first observation, cycle count traveling with it as supporting evidence):

- *Adopted upstream in this cycle (commit `3a6deaf` — the framework-relayed granularity corrections):* E1's c3 lease plan-time probe (drive one fight to `combat-over` at c0, not read type declarations) and S03's c4 spec-collision correction (a session changing navigation leases the specs that navigate through that surface). Both are already reflected in the realized role text; recorded here as adopted, with the commit cited.
- New, 1 cycle / 1 in-cycle instance, first seen `v1-shell`: **"Unprepare" has no engine API** — the S05 surface omitted the control rather than improvising UI math; the honest-unavailable rendering (Custom Rule 9) was the correct disposition, and the gap is recorded in the engine program's follow-up ledger (`editDistance` hint bug, attack tables vs AC 11+, conditions not carried into combat, Unprepare/next-level-XP). Recommendation: when the engine program adds these APIs, the UI re-entry is a planned Coder lease, not a renderer checkpoint-0 investigation — a known gap assigned only to a renderer's checkpoint-0 investigation is unresolved planning work.

**Adoption check before carrying forward:** both open items above were re-read against the current tree this pass; neither has been adopted since the prior pass (the engine follow-ups are named, owned, and planned — not implemented in this feature). The standing-ledger table above is the single source of truth for the backlog; a reader needs no upward walk through prior entries.

**Not inspected** (stated, not implied reconciled): `../Ruleswright` engine internals beyond the public barrel consumed here; `mocks/*.html` beyond grep-level; provider/quota configuration. The engine repo's own `.program/` belongs to a different program and was not reconciled.

**Log entry:** this dated entry appended to `ARCHIVIST-LOG.md` (created this pass).

---

## 2026-09-27 — final pass (feature `combat-complete`, repo `2b55a04`, code `c22426a`, engine `../Ruleswright` `dadf461`; also closes the loot-inventory cycle, which had no final pass)

**Scope read.** combat-complete FINAL-REPORT (`2b55a04`) and STATE in full; loot-inventory FINAL-REPORT (its Archivist's Note section is empty and its LI-D8 PROGRAM-CONFIG deltas were never applied — the engine pin still read `01dcf77`); every `arch/` file; PROGRAM-CONFIG; CLEANUP-LEDGER; the prior entry above; `git log` of arch/config since `0d973ed`. Source facts were checked against the tree at `c22426a` (exports, signatures, refusal texts, test ids, mount order), not taken from the delta prose.

**Reconciled (`arch/`).** Folded eight loot-inventory and fourteen combat-complete appended delta blocks (`a8b78cb`, `e14f2e4`, `268a2f1`, `c02ec42`, `e033c16`, `79fe4fc`, `a19a902`, `acfc1fa`) into realized-state text, removing every `<!-- … SESSION-NN -->` fragment:
- M01/M02: one FightDoc section (start `positions?`/`allySpawns?`, `move` op, `GridPosition`) and one save-validation section (`isPositions`, `isSpawns`, exact refusal texts).
- M04/M05/M08/M11: four moods stated once (tokens block, canopy light, Spectral 600, `MoodId`/`MoodLike`, `✻` glyph). M08 gains `Board`/`TokenMark`.
- M06: rewrote `combat.ts`/`replay.ts` as the current API (`LiveFight`, `begin(…, positions?, allySpawns = [])`, `reposition` precondition order, `slotGrants`/`actionInfo`, `assemble`, private `rebuild` shared by `replay` and `resume`), `runtime.ts` with inventory, a single library-facts section (grid probes, session-observed facts, EG-1..EG-8), and an upstream-engine history across all three engine pins.
- M09: `store/combat.ts` rewritten as assembly / live fight / records / selectors+re-exports instead of six stacked deltas; `character.ts` gains the inventory section.
- Views: **removed duplication** — `M12`–`M15` files were copies of sections of `M11-M15-views.md`; now `M11-M15-views.md` holds shared rules + M11 and each of M12–M15 is the single authoritative detail. M15 layout corrected to the actual mount order (`index.tsx`: log beside a column Phase → Offers → Board → Turn order → Combatants → "Replay & records"; `ActionDetail`/`CombatantDetail` are internal, not exported).
- M17: files, proof owners per feature, and one final-gates table (v1-shell 178 / 17; loot-inventory 199 / 18; combat-complete 254 / 26). M18: engine pin history and `9ea30c4` dev-script change.

**Contradictions resolved (to what git shows).**
- Registry claimed **M15 → M01 [R] (types)** since v1-shell; no file under `views/combat/` imports `shared/*` now or at `98a14e3`. Edge removed.
- Registry lacked **M13 → M15** (`character/inventory.tsx` imports `summaryOf` from `combat/log`, loot-inventory S02) and never listed the **M14 ↔ M15** module cycle outside arch prose. Both added.
- The prior entry says the probe and navigation-spec recommendations were "adopted upstream in commit `3a6deaf`" yet carries them as open. `3a6deaf` is a v1-shell STATE commit and touches no role document; the role documents are gitignored (`/program-agents/`, no git history) and their mtimes (2026-09-25 23:39) predate the prior pass. Reading current `PLANNER.md`: it requires probing external premises at c0 (l.291–297) but not driving the host loop; nothing about leasing specs that navigate a changed surface. So neither was adopted; both stay open (and one is promoted to program level below).
- Commit-subject convention said `v1-shell SESSION-NN`; generalized to `<feature> SESSION-NN` per all three features' history.

**Module edges (mechanical, `import type` stripped, `export … from` as runtime).** Unchanged from the prior entry except: M13 → M15 (runtime, new); M15 → M01 (removed — never realized); M14 → M15 and M15 → M14 (unchanged, now in the registry's cycle list); M08 still imports nothing product-side (`Board` is pure React); M09 `store/combat.ts` `export { actionInfo, distance, listSpawnable, slotGrants, spatialLabel, spatialOf, spawnProfile } from '../engine/combat'` realizes M09 → M06 again (already present). No view imports `ruleswright`; the only view → engine runtime import remains M12 `rerunUnavailableReason`.

**Contract Agreements / Capability Readiness review.** CA-12..15, CA-01..04, CA-04b/05/06, CA-07/08, CA-09..11 each name a producer commit, a boundary proof and the packaged proof; spot-checked producer code matches (`begin` CA-05 message, `reposition` order spatial → offer → phase, `resume` compares events only, storage refusal texts). Findings for Orchestrator (no STATE edit by Archivist):
- CAP-05 is correctly marked "verified within the approved rule"; B-CX-7 (trailing `move` tamper not refused) stays open with a human owner. No stale readiness row found.
- CA-07 length-mismatch guard: producer present, proof absent (needs a library mock) — carried as verification debt with owner "next session leasing `tests/engine/combat.test.ts` with a mock seam". Owned but no resumption condition beyond that.
- EG-8 (positions for absent combatants accepted) makes a record with `allySpawns` removed replay as `diverged at event 0` rather than a refusal; UI behavior is honest, owner = engine program.

**PROGRAM-CONFIG.** Applied the Final Report deltas and the unapplied loot-inventory LI-D8 deltas: engine pin history (`f792f49`/dist `8b802b7`, current `dadf461`); Author Sources gain a current-revision column (`24601f4`, `9cb5aa8`, `3069b23`, `af47822`) plus the carried design-housekeeping list; registry M13 edge + key file, M14 FR-11 wording, M15 key files, M14 ↔ M15 cycle; Conventions gain the loot-inventory and combat-complete test ids, the `fight-spatial` text change, the four-mood list (CA-10), the FR-11 spatial wording, and the e2e reference-positions convention; Custom Rule 3 names the loot seed and threat-assembly seed controls; Custom Rule 8 states the current FightDoc shape. Verification Commands untouched.

**Promoted to PROGRAM-CONFIG (Principle 4, cycle axis crossed: 3 cycles).** *Plan-time engine probes drive the real host loop* (row `785c75731e5e9eb6`). Instances: v1-shell E1 c3 (drive a fight to `combat-over`, not read declarations); loot-inventory PC-1 (a c0 probe disproved the only planned proof path for `loot-grants-nothing`); combat-complete Granularity feedback (Coders corrected "who acts first" and "slots refill on the first Step") and the planning hazard (an unbounded probe loop exhausted the heap). Minted as a Convention with the replacement-proof clause from PC-1.

**Promoted to PROGRAM-CONFIG (Principle 4, in-cycle axis crossed: 6 sessions in combat-complete).** *`store/combat.ts` is the combat spine* (row `e5ca138ece6253ad`): S01–S06 each leased it, which serialized the whole feature. The six leases stem from one plan decision (CX-D8), so this is weaker evidence than six independent recurrences; it is minted anyway because the next combat plan hits the same wall, and the convention only asks the plan to state the cost or schedule a split. Not promoted: `c11d55653812170b` (MCP timeouts) is an environment/Orchestrator matter, not a program convention; `fd4db33b2a177c9b` (4 instances, but at most 2 per cycle across 2 cycles) crosses neither axis.

**Proposed for the framework** (no threshold on this channel; counts travel as evidence):
- *ORCHESTRATOR.md* — do not end a run while the Final Report's "Archivist's Note" is pending; if the final Archivist cannot run, record that as a blocker so the next cycle's first step is the missed final pass. loot-inventory closed with the section empty and its LI-D8 deltas were silently dropped until this pass. 1 cycle, 1 instance (`bb0bbd74088d3d3b`).
- *PLANNER.md* — when a checkpoint widens a union consumed across modules (here engine `ScriptEntry` gaining `move`, typed against shared `FightScriptEntry`), the shared type change belongs in the same checkpoint. 1 cycle, 1 instance (combat-complete S01 c1/c3) (`441471f46e938236`).
- *PLANNER.md / ORCHESTRATOR.md* — a session that changes a shared surface leases every spec or test that pins it (navigation in v1-shell S03; the storage refusal text pinned by `tests/main/ipc.test.ts:113`, combat-complete F1, fixed by lease r2 before dispatch). 2 cycles, 2 instances (`97641a906d3c0447`).
- *ORCHESTRATOR.md* — Author-owned housekeeping carried to "the next Designer pass" needs a named re-entry item with a resumption condition; four such items now float across two features (roll.html `🎲`, mood-switch chips, no `wild` block in combat/fight mocks, undesigned Resume refusal kinds). 2 cycles, 4 instances (`fd4db33b2a177c9b`).
- *PLANNER.md* — error paths that ship untested (loot-inventory `item-not-held`/`invalid-amount`/`table-roll-failed`; combat-complete CA-07 length guard) should get an owning lease with a mock seam, not "the next feature touching X". 2 cycles, 2 instances (`7e1f39c4c298e5f5`).
- *ORCHESTRATOR.md* — document the MCP 300 s await idle timeout (re-await the same handle) and recovery of a lost handle from the runtime session log as standard procedure. Environment, not planning. 2 cycles, 3 instances (`c11d55653812170b`).
- *PLANNER.md* — mark whole-repo gate edges between concurrently planned sessions in the dependency graph (loot-inventory PC-2). 1 cycle, 1 instance (`30a8ca5b264e67bd`).
- *PLANNER.md* — when every session of a feature must lease one spine file, consider a plan-time split, or state the serialization cost explicitly (combat-complete CX-D8: 6/6 sessions held `store/combat.ts`, effective concurrency 1). 1 cycle, 6 instances (`e5ca138ece6253ad`).

**Adoption check.** Role documents were read for each open row's substance (see the `3a6deaf` resolution above); none has been adopted. Separately, `PLANNER.md`, `CODER.md`, `UI-CODER.md`, `ORCHESTRATOR.md` are byte-identical to how this pass found them (Archivist did not write).

**Cleanup (scouted; recorded here because this envelope restricts commits to `arch/**`, PROGRAM-CONFIG and this log — `CLEANUP-LEDGER.md` was left untouched and should absorb these at the next pass that may commit it).**
- C1 `release/` not gitignored — still true at `2b55a04` (no `/release/` line; `electron-builder.yml` `output: release`). tracking.
- C2 `OkCard` exported, no consumer — still true (`grep -rn OkCard src tests e2e` hits only `ui/ErrorCard.tsx`, `ui/index.ts`). tracking, cluster K1.
- C3 engine follow-ups — superseded by EG-1..EG-8 (owner `../Ruleswright`). tracking (advisory).
- **C4 (new)** `engine/combat.ts` type exports with no consumer outside the file: `DeclareResult`, re-exports `CombatRestoreRequest`, `CombatPhase` (only `engine/combat.ts`); `AllyCombatant` (plus `tests/engine/combat.test.ts`). Medium confidence, type-only blast radius; check = typecheck/lint green and an empty grep outside `engine/`. tracking, K1.
- **C5 (new)** `EnemySpec` kept as an alias of `SpawnSpec` (`engine/combat.ts:53`; consumers `store/combat.ts`, `tests/engine/combat.test.ts`). Medium; two names for one shape. tracking, K1.
- **C6 (new)** `store/combat.ts` (516 lines) is the serialization hotspot — structural observation, low confidence as cleanup (coherent, not dead); now also a Convention (see promotion above). tracking.
- Campaign K1 (C2, C4, C5) = three medium findings: below every brief threshold. No Planner brief.

**Not inspected.** `../Ruleswright` internals beyond the consumed barrel; `mocks/*.html` beyond the Final Report's statements; e2e runs (no gate re-run; results cited from the Final Report and STATE, Orchestrator's wave-close `pnpm verify` at `c22426a`).

**Standing recommendations** (full backlog):

| id               | pattern                   | cycles | in-cycle instances | first seen | status                              |
| ---------------- | ------------------------- | -----: | -----------------: | ---------- | ----------------------------------- |
| 785c75731e5e9eb6 | Plan-time probes should drive the actual host loop (declare → step → respond to the end), not read type declarations | 3 | 4 | v1-shell | promoted (PROGRAM-CONFIG Conventions, 2026-09-27); framework recommendation still open |
| 97641a906d3c0447 | A session that changes navigation should lease every spec that navigates through that surface | 2 | 2 | v1-shell | open |
| 0d4dfe658858963c | Human visual review of screenshot sets owed as final-report debt | 1 | 1 | v1-shell | open |
| cc00aa16e2f5e7f5 | electron-builder output dir (release/) absent from .gitignore | 3 | 1 | v1-shell | open |
| bb0bbd74088d3d3b | A feature cycle closed without its final Archivist pass (Final Report Archivist's Note left pending), so its arch deltas and PROGRAM-CONFIG deltas rolled into the next cycle unreconciled | 1 | 1 | loot-inventory | open |
| 441471f46e938236 | A checkpoint that widens a union consumed across modules must carry the shared type change in the same checkpoint | 1 | 1 | combat-complete | open |
| fd4db33b2a177c9b | Design housekeeping carried to "the next Designer pass" with no scheduled owner or resumption condition | 2 | 4 | loot-inventory | open |
| 7e1f39c4c298e5f5 | Unexercised error paths recorded as verification debt with no owning lease | 2 | 2 | loot-inventory | open |
| c11d55653812170b | MCP await idle timeout (300 s) and orchestrator runtime restarts force re-awaits and recovery from session logs | 2 | 3 | loot-inventory | open |
| 30a8ca5b264e67bd | Dependency graph omits whole-repo gate edges between concurrently planned sessions | 1 | 1 | loot-inventory | open |
| e5ca138ece6253ad | One spine file leased by every session serializes the whole feature (effective concurrency 1) | 1 | 6 | combat-complete | promoted (PROGRAM-CONFIG Conventions, 2026-09-27); framework recommendation still open |

**Log entry:** this dated entry appended to `ARCHIVIST-LOG.md`.
