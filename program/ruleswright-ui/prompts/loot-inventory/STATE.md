# State Tracker — Ruleswright (UI) / loot-inventory

## Program / Feature / Intent / Sessions
- **Program:** Ruleswright (UI) (`ruleswright-ui`) · **Feature:** `loot-inventory`
- **Intent:** show the engine's `loot-inventory` release (`../Ruleswright` `01dcf77 → f792f49`) in the desktop shell: accept the new `wyldwood` theme, and give characters a visible inventory with grant/drop/loot, persisted through the existing snapshots.
- **Sessions:** 3 Coder sessions + 2 approved Author re-entry workers (AUTHOR-SPEC-LI, AUTHOR-DESIGN-LI). Human decision 2026-09-27: "q1 yes q2 b" → FR-18 with loot seed option (a) + Grant row; a fourth mood for `wyldwood`.
- **Plan HEAD:** UI `c38aa8c`; engine HEAD `f792f49` (code `8b802b7`); installed dist is hard-linked to the sibling `dist/` (built 2026-09-26 23:27).

## Session Status
| # | Session | Modules | Owns | Status | Checkpoint | Completed | Notes |
|---|---|---|---|---|---|---|---|
| 01 | Engine refresh acceptance (wyldwood, gate green) | M17 | `tests/engine/compiler.test.ts`, `tests/store/worlds.test.ts`, `tests/moods/map.test.ts`, `tests/engine/determinism.test.ts`, `e2e/shell.spec.ts` | pending | — | — | ready now; tests only |
| 02 | Inventory & loot on Character (FR-18) | M06 M09 M13 M17 | `src/renderer/src/engine/runtime.ts`, `src/renderer/src/store/character.ts`, `src/renderer/src/views/character/inventory.tsx`, `src/renderer/src/views/character/index.tsx`, `src/renderer/src/views/character/character.css`, `tests/engine/runtime.test.ts`, `tests/store/character.test.ts`, `e2e/inventory.spec.ts` | pending | — | — | B-LI-1: waits on AUTHOR-SPEC-LI + AUTHOR-DESIGN-LI commits (Q1 decided) |
| 03 | wyldwood mood | M04 M05 M08 M11 M17 (M18 conditional) | `src/renderer/src/styles/{tokens,base,fonts}.css`, `src/renderer/src/moods/map.ts`, `src/renderer/src/ui/types.ts`, `src/renderer/src/views/roll/glyphs.ts`, `tests/moods/map.test.ts`, `tests/styles/contrast.test.ts`, `e2e/shell.spec.ts`, `package.json`, `pnpm-lock.yaml` (last two only if a new font family is designed) | pending | — | — | B-LI-2: waits on AUTHOR-DESIGN-LI part B commit (Q2 = b decided). Serial after 01 (shared files) |
| AUTHOR-SPEC-LI | FR-18 + FR-15/FR-2/Constraints text | — | `program/ruleswright-ui/specs/requirements.md` | done | 1/1 (`d0fe434`) | 2026-09-27 | received; diff checked against approved content; only requirements.md |
| AUTHOR-DESIGN-LI | Inventory panel + 4th mood | — | `specs/design.md`, `mocks/character.html`, `mocks/design-language.html` (+ `mocks/index.html` if its mood text lists moods) | pending | — | — | approved content in AUTHOR-REQUEST-LI.md; dispatchable now |

## Wave Plan
| Wave | Sessions | Why concurrent |
|---|---|---|
| 1 | SESSION-01, AUTHOR-SPEC-LI, AUTHOR-DESIGN-LI | 01 writes 5 test files. SPEC writes only `specs/requirements.md`. DESIGN writes only `specs/design.md` + `mocks/*`. No Coder lease includes `specs/` or `mocks/` (Author-owned). Pairwise disjoint. SESSION-01 reads design.md, but its assertions (`archive`) don't depend on the new text. |
| 2 | SESSION-02, SESSION-03 | 02 = engine/runtime, store/character, views/character/*, tests/engine/runtime, tests/store/character, e2e/inventory. 03 = styles/*, moods/map, ui/types, roll/glyphs, tests/moods, tests/styles, e2e/shell, package.json, pnpm-lock.yaml. Checked path by path: disjoint (02's CSS is `views/character/character.css`, not `styles/**`). Both hold `e2e:out` for their e2e steps only (H-1). 02 may start as soon as both Author commits land, even while 01 is still running (disjoint). 03 needs 01 done. |

## Dependency Graph
```
AUTHOR-SPEC-LI ──┐
AUTHOR-DESIGN-LI ┼─► SESSION-02
                 └─┐
SESSION-01 ────────┴─► SESSION-03
```

## Architecture Reference (feature-specific)
- Engine surface consumed (installed `runtime.d.ts` l.601–675): `grantItem`, `dropItem`, `grantLoot`, `LootOptions {seed?, rng?}`, `InventoryEntry {id, qty}`, `CharacterState.inventory`. Only `engine/runtime.ts` imports them (Custom Rule 1).
- Events: `loot:rolled` (`why.rule` `tables.<id>`), `item:granted`/`item:dropped` (`content.items.<id>`), `why.rolls: []`.
- New edge (SESSION-02): `views/character/inventory.tsx` → `views/combat/log.tsx` (`summaryOf`), i.e. M13 → M15. Record it as realized if it lands. Alternative: Coder inlines an equivalent summary. Either is acceptable.

## Scope Summary
| ID | Module | Change |
|---|---|---|
| M06 | engine | `runtime.ts`: grant/drop/loot wrappers, `lootTableIds`, `CharacterView.items/lootTables` (S02) |
| M09 | store | `character.ts`: `inventory` section + 3 actions (S02) |
| M13 | views/character | new `inventory.tsx`, wired in `index.tsx` (S02) |
| M04/M05/M08/M11 | styles/moods/ui/roll | fourth mood (S03); M18 only if a new font family |
| M17 | tests | theme-pin refresh + wyldwood proofs (S01); inventory proofs (S02) |
| M01/M02 | shared/main | **no change**: snapshots are verbatim envelopes (AR-LI Q3) |

Disproved / out of scope (findings, not work):
- "Engine lint/format/validate-split commits changed behavior": disproved. Both theme JSONs are semantically identical at `01dcf77` vs HEAD (probe 2026-09-27). The UI's typecheck, lint, and e2e are green on the new dist.
- "Snapshots need a DB change for inventory": disproved (`SnapshotDoc.snapshot: unknown` = verbatim envelope; `model.ts`).
- Bespoke World → Items view: not proposed; `content.items` already renders via the raw fallback (`views/world/sections.ts` iterates every `content` key).

## Design Decisions
| ID | Decision | Rationale |
|---|---|---|
| LI-D1 | Showing inventory/loot is a **requirements + design change** (Author re-entry, AR-LI Q1), not a Coder adaptation | `requirements.md` Assumptions: API drift → re-entry. New user-visible behavior |
| LI-D2 | `wyldwood` in the picker is **already approved** (FR-2: library-discovered list). The two failing tests are stale pins → mechanical fix (SESSION-01) | Existing requirement; the UI code is correct |
| LI-D3 | `wyldwood` mood = **archive** until SESSION-03 lands the approved fourth mood (Q2 = b). SESSION-01 asserts archive, and SESSION-03 flips exactly those assertions | Each checkpoint asserts true current behavior |
| LI-D4 | Worlds forged before the engine release will **honestly fail** rerun-same-seed, and old fight records replay as pack-diverged | Same class as v1-shell H-8 (already accepted): stage 7 now emits `content.items`. Byte comparison is the contract (CA-12). No UI change |
| LI-D5 | Theme-list tests derive the expectation from library exports plus a literal floor | Prevents the next engine theme from breaking the gate again, and still catches a discovery regression |
| LI-D6 | Q1 decided: explicit loot seed + ⟳ (option a), Grant row included, `-loot` tables. SESSION-02 c0 applies committed layout/copy; a contradiction of the decision is a blocker, not an adaptation | Keeps the plan dispatchable the moment Q1 lands |
| LI-D7 | Item events in the **combat** log would render with variant `system` (the `MUTATION` regex in `views/combat/log.tsx` doesn't list `item`/`loot`). Left unchanged | Loot is outside combat. Accent choice is a design detail; route to Designer if wanted |
| LI-D9 | Author edits are split into two approved workers (Spec: requirements.md; Designer: design.md + mocks) that can run concurrently, and the approved text is spelled out in AUTHOR-REQUEST-LI.md | Disjoint files; the human approved content once, so no second ask |
| LI-D10 | Designer appends the new mood as the column **after** archive and prefers bundled font families; SESSION-03 still leases `fonts.css`, `package.json`, `pnpm-lock.yaml` for a new face | The contrast gate reads columns by position, so this keeps it green between the Designer commit and SESSION-03. Leasing the font manifest seam up front avoids a mid-session lease revision |
| LI-D8 | PROGRAM-CONFIG deltas for Orchestrator/Archivist at close: engine pin → `f792f49`/dist `8b802b7`; Custom Rule 3 wording to include the Character loot seed control; Author Sources revisions; new test ids; CA-10 table + Conventions with the fourth mood | Planner doesn't edit PROGRAM-CONFIG after the first run |

## Verification Baseline
Observed by Planner on 2026-09-27 at UI `c38aa8c` with the installed engine dist built from `8b802b7`:

| Command | Effective | Result |
|---|---|---|
| `pnpm check:engine` | `node scripts/check-engine.mjs` | **ok** `ruleswright@0.1.0` (installed = sibling; hard-linked) |
| `pnpm typecheck` | tsc × 3 projects | **exit 0** |
| `pnpm lint` | `eslint . --ext .ts,.tsx` | **exit 0** |
| `pnpm test` | `vitest run` | **exit 1: 176/178**. Fails: `tests/engine/compiler.test.ts:7`, `tests/store/worlds.test.ts:59` (theme list now includes `wyldwood`). Owner: SESSION-01 c1 |
| `pnpm e2e` | `playwright test` (globalSetup rebuilds `out/`) | **17/17 passed** (52 s), GUI available |
| `pnpm verify` | all of the above | red until SESSION-01 c1 (unit only) |

Hazards carried from v1-shell: H-1 (`e2e:out` exclusive), H-2 (GUI needed), H-3 (`file:` copy; `check:engine` catches staleness), H-5 (`prompts/` gitignored; `git add -f`). H-7 doesn't apply: no session rebuilds engine `dist/`. **Any further engine rebuild during this run** swaps the engine under in-flight sessions; Orchestrator must not rebuild `../Ruleswright/dist` while a session runs.

Engine probe (installed dist, seed 42, default knobs): dark-fantasy items ×6, loot table `barrow-loot` (seed 42 → `grave-ward ×1`, 1 → `hearth-bread`, 2 → `oaken-cudgel`); zombie-urban items ×6, **no** `-loot` tables; wyldwood items ×6, `glade-loot`. The snapshot round-trips inventory.

## Capability Readiness
| ID | Approved behavior / entry point | Required facts + producer owners | CA IDs / prerequisites | Integration owner / checkpoint | Status | Proof / checked sources | Open gaps + correction owners |
|---|---|---|---|---|---|---|---|
| CAP-01 | FR-2: `wyldwood` in picker → forge → World, archive mood, rerun pass | library exports (ready); `moodForTheme` (ready) | CA-10, CA-11, CA-12 | SESSION-01 c2 (`e2e/shell.spec.ts`) | planned | probe + unit baseline above | none |
| CAP-02 | FR-18 (committed `d0fe434`): Character → Inventory: loot/grant/drop, rejections verbatim, persisted via snapshot across restart | items/tables from pack (ready); inventory + events (library, ready); seed (S02); snapshots (v1-shell CA-06, ready) | CA-13, CA-14, CA-06, CA-05; AUTHOR-SPEC-LI, AUTHOR-DESIGN-LI (A) | SESSION-02 c4 (`e2e/inventory.spec.ts`) | planned | engine probe | B-LI-1 (Author commits) |
| CAP-03 | FR-15 (amended, approved): `wyldwood` → dedicated mood, AA contrast | design.md token column, fonts, glyph (AUTHOR-DESIGN-LI B, planned) | CA-10 (amended); SESSION-01 | SESSION-03 c2 (`e2e/shell.spec.ts`) | planned | — | B-LI-2 (Designer commit) |

**First narrow journey:** CAP-02's e2e (forge → create → loot → save → restart → load) crosses the real preload bridge, main fs, and engine. Every layer already exists and is proven by v1-shell's CAP-08, so this is an extension of an established path, not a new transport.

## Contract Agreements
| ID | Required meaning / authority | Producer → boundary → consumer | Mapping / constraints | Correction + proof owners / checkpoints | Agreement | Producer | Proof / evidence / checked sources |
|---|---|---|---|---|---|---|---|
| CA-10 | mood follows theme | `meta.theme` → `moodForTheme` → `data-mood` | `wyldwood → archive` now (S01), then `→ <id>` (S03) | S01 c1/c2; S03 c1/c2 | agreed; S03 mapping provisional against AUTHOR-DESIGN-LI's mood id (recheck at S03 c0) | ready | planned |
| CA-11 | themes = library exports | `ruleswright/compiler` → `listThemes` → picker | sorted ids; now 3 | S01 c1 | agreed | ready | planned (test re-derived from library) |
| CA-12 | rerun = bytes | stored params + bytes → `generateCampaign` → `===` | unchanged; pre-release worlds fail honestly (LI-D4) | S01 c1 (wyldwood case) | agreed | ready | planned |
| CA-13 | inventory shown is the library's | `c.state.inventory` + `pack.content.items` → `viewOf` → InventoryPanel | rows in library order; name/kind verbatim or null; no qty math | S02 c1, c4 | agreed | planned | planned |
| CA-14 | loot entropy is the user's explicit seed | seed field → `loot(tableId, seed)` → `grantLoot(…, {seed})` | integer only; ⟳ = `crypto.getRandomValues` into the field; no implicit default | S02 c1, c3, c4 | agreed (Q1 option a, 2026-09-27) | planned | planned |
| CA-06 | snapshot envelope verbatim | `serializeCharacter` → `snapshot:save` → disk → `restoreCharacter` | now non-empty `inventory` | S02 c2 (unit restart), c4 (e2e restart) | agreed | ready (v1-shell) | planned re-proof |
| CA-05 | failures verbatim | `RuntimeRuleError` → `toAppError` → `ErrorCard` | new rule ids: `insufficient-qty`, `item-not-held`, `invalid-amount`, `unknown-item`, `loot-grants-nothing`, `unknown-table` | S02 c1, c4 | agreed | ready | planned |

## Planning Completeness Review (2026-09-27, Archivist h-QqKa, plan @ c38aa8c)
| # | Severity | Finding | Disposition |
|---|---|---|---|
| PC-1 | advisory | FR-18 "flavor roll → `loot-grants-nothing`" unreachable via `-loot` tables (barrow-loot seeds 1..2000 grant or throw `unresolvable-ref`; glade-loot always grants). Reachable on non-`-loot` tables (`barrow-mood` seed 42). SESSION-02.md CA-05 list omits `unresolvable-ref`, `table-roll-failed` | Routed to SESSION-02 envelope (standing authority, inside its lease): c1 wrapper unit cases `loot(…,'barrow-mood',42)` → `loot-grants-nothing`, inventory unchanged; `loot(…,'no-such-table',42)` → `unknown-table`; `unresolvable-ref` rendered verbatim like any card. e2e flavor step stays conditional |
| PC-2 | advisory | Hidden gate edge S01 c1 → S02 c1 (unit baseline red until S01 c1) | S02 gates on lease-scoped selectors (wave-common); whole-repo re-verify at wave close |
| PC-3 | advisory | Designer pre-check named 2 of 9 contrast-gate pairs | AUTHOR-DESIGN-LI envelope extended to all 9 pairs before dispatch |

## Current Blockers
| ID | Affects | Next action | Owner | Evidence to clear |
|---|---|---|---|---|
| B-LI-1 | SESSION-02, CAP-02 | **Decided** (Q1 yes, option a, Grant row). Dispatch AUTHOR-SPEC-LI + AUTHOR-DESIGN-LI with AUTHOR-REQUEST-LI.md | Orchestrator → Spec, Designer | committed revisions of `specs/requirements.md` (FR-18) and `mocks/character.html` + `specs/design.md` (Inventory panel) |
| B-LI-2 | SESSION-03, CAP-03 | **Decided** (Q2 = b). Same AUTHOR-DESIGN-LI worker, part B | Orchestrator → Designer | committed `design.md` mood table with the new column after archive, contrast ratios ≥ 4.5 stated, fonts + glyph named; SESSION-01 done |

No human input is outstanding.

## Handoff Notes

### AUTHOR-SPEC-LI — done 2026-09-27 (`d0fe434`, handle h-ktV1)
- notes (verbatim): Work order was AUTHOR-SPEC-LI (items 1-4) of program/ruleswright-ui/prompts/loot-inventory/AUTHOR-REQUEST-LI.md; shared rules read from .program/prompts/wave-common.md. Nothing beyond approved content attempted, so no blocked path was needed. Note on command shape: the envelope's single-line add+commit pathspec command was executed as two sequential git invocations (add -- <path>, then commit -m <msg> -- <path>) because this runtime passes argv without a shell; the explicit-pathspec discipline and resulting tree are identical (verified via git show).
- followUp (verbatim): AUTHOR-DESIGN-LI (Designer) remains: design.md + mocks/character.html inventory panel, mocks/design-language.html fourth mood (wyldwood), mood id + contrast ratios recorded per its work order. Per the appendix, zombie-urban has no -loot tables, so SESSION-02 tests should cover FR-18's honest empty state, and 'loot seed' wording now covers both FR-14's Roll seed and FR-18's Character loot seed via the Constraints line.
- Orchestrator receive: `git show --stat d0fe434` = requirements.md only (+13/−4); diff read against AUTHOR-REQUEST-LI items 1–4: matches.
