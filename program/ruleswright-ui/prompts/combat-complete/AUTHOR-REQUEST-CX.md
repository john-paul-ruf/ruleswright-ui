# Author Re-entry — combat-complete (UI): APPROVED work orders (revision 2)

> **From:** Planner · **Program:** Ruleswright (UI) · **Feature:** `combat-complete`
> **Human requests (2026-09-27, verbatim):** "can you make the combat section fully implment what
> ruleswrights supports, turn order, spatial location, etc" · "Ruleswright has been updated, please
> check again".
> **Human decision (2026-09-27, verbatim):** "q4 a-i, q1 a, q2 a, q3 a".
> Read as: **Q4 = (a-i)** build the grid in the UI, with host repositioning between declarations;
> **Q1 = (a)** approve the additive `start.allySpawns` FightDoc field; **Q2 = (a)** threat-budget encounter
> assembly; **Q3 = (a)** resume by re-applying the recorded script (repositions included), adopt only on
> identical events. All four on Planner's recommendation.
> **Evidence base (rev 2):** UI HEAD `0acfd0d` (source unchanged since `01d2457`); engine `../Ruleswright`
> HEAD `dadf461` (clean; last `src/` commit `38c017e`); installed dist current (`pnpm check:engine` ok).
> Probes: `.program/probe-grid.mjs`, `.program/probe-grid2.mjs`.

These are now **approved content** for four Author workers: DF-CX-1 (design-fill, never needed approval),
AUTHOR-DB-CX, AUTHOR-SPEC-CX, AUTHOR-DESIGN-CX. Orchestrator may dispatch them under this approval without
asking again. Each worker writes only its files below, and only the approved content. Anything beyond it (a
new flow, different behavior, another DB change) goes back to the human.

**Dispatch order:** DF-CX-1 ∥ AUTHOR-DB-CX ∥ AUTHOR-SPEC-CX (disjoint files), then AUTHOR-DESIGN-CX
**after** DF-CX-1 (both write `specs/design.md` and `mocks/combat.html`). Orchestrator may instead merge
DF-CX-1 and AUTHOR-DESIGN-CX into one Designer worker; the content is unchanged.

---

## What changed in the engine (f792f49 → dadf461), probed on the installed dist

| Fact | Evidence |
|---|---|
| **All three bundled themes now emit a grid.** Every generated pack carries `spatial: {model:'grid', reach:{default:1, <one statblock>:2}, shapes:['single','burst']}` (dark-fantasy `barrow-wight:2`, zombie-urban `slab-brute:2`, wyldwood `hollow-wight:2`) | probe-grid; theme JSON diff |
| **`startCombat` refuses a spatial pack unless every combatant has a position**: `RuntimeRuleError` with one `E-SPAT-01` card per combatant (`jsonPath positions.<id>`) | probe-grid, all 3 themes |
| New `StartCombatRequest.positions?: Record<id, {x,y}>`; `CombatantState.position?`; `Runtime.spatial` geometry (`distance`, `canReach`, `inBurst`) | `runtime.d.ts` |
| Declare gains two gates, both **events, never throws**: the `valid` clause (`strike`/`cut-down`/`baton-blow`/`thorn-lash` declare `hasTarget(adjacent)` → `declare:rejected {kind:'valid'}`, rule `E-REF-01`), then reach (`{kind:'spatial'}`, rule **`E-SPAT-01`**) | probe-grid |
| **No movement verb.** Movement is `serializeCombat` → `deserializeCombat(rt, snap, {allies, enemies, positions})`. Restore emits no events, keeps rng words, hp, slot ledgers, conditions, and whatever balances the host re-states | probe-grid2 |
| Restore always comes back in `awaiting-declare` (unless a side is defeated). After a declare this hands the same combatant a second action | probe-grid2 |
| Combat snapshots carry `position` per combatant (FightDoc `combat` stores it verbatim) | probe-grid |
| `E-SPAT-01` is a registered rule id (`RULE_IDS` 15) | engine `error-card.ts` |
| Pack bytes changed: dark-fantasy·42 16,056 → **16,482** B | probe-grid |

## What is broken in the UI until SESSION-01/02 land
- Combat cannot start on any world forged from now on (`E-SPAT-01` cards at Begin; honest fail-closed).
- `pnpm test` 181/199 (18 failing in combat/replay/store-combat tests); `pnpm typecheck` fails at
  `tests/engine/combat.test.ts:119`. `pnpm e2e` not run; `e2e/combat.spec.ts` and `e2e/replay.spec.ts` are
  expected red. Owners: SESSION-01 c3 (unit + typecheck), SESSION-02 c3 (e2e).
- Pre-`dadf461` worlds still fight in theater-of-mind; their rerun fails honestly and their records replay
  pack-diverged (same class as LI-D4). No change.

---

## Engine gaps (for the engine program; this program never edits `../Ruleswright`)

| # | Gap | Evidence | UI handling |
|---|---|---|---|
| EG-1 | `startCombat` silently merges duplicate combatant ids across sides | probe-combat2: `order x,x`, one combatant | UI refuses duplicates before calling it (CA-05) |
| EG-2 | `isDowned`/`defeatedSide` not exported | `runtime.d.ts` | no "down" label (CX-D3) |
| EG-3 | Combat conditions never tick; character conditions not carried into combat | source | show what the library holds |
| EG-4 | Reach overrides are looked up by **combatant id**, the pack keys them by **statblock id**; a spawned `barrow-wight-1` gets reach 1, not 2 | probe-grid: distance 2, id `barrow-wight` accepted, `barrow-wight-1` rejected | UI does not rename ids to game it; shows the pack's reach table verbatim; declare decides |
| EG-5 | No movement verb; restore after a declare returns `awaiting-declare` (a second action) | probe-grid2 | reposition only at `awaiting-declare` with no open offers (CX-D10) |
| EG-6 | `serializeCombat` keeps only the first open offer per combatant | engine `snapshots.ts` | reposition blocked while any offer is open |
| EG-7 | Bursts are not declarable from generated packs (only spells carry burst targeting) | engine grid-combat FINAL-REPORT; probe-grid | no burst targeting UI |

---

## DF-CX-1 (Designer, design-fill) — writes `specs/design.md`, `mocks/combat.html`

**Why design-fill:** FR-11/12/16 already require round, active combatant, pending actions and readable cost
rejections. This decides only how turn order and per-combatant economy look.

In `mocks/combat.html` control column, and as rows in `design.md` Component Inventory + the Combat Screen
Inventory entry:
1. **Turn order panel** (above Combatants): one row per `state.order` entry, in library order: name, side
   chip, hp numeral; active row with the accent glow; a `round N · turn T of K` line; an **Initiative**
   provenance block from `combat:start` (`payload.initiative`, `why.rolls`, `why.rule`, mono, verbatim).
2. **Combatant detail**: slot ledger chips `main 1/1 · move 0/1 · reaction 1/1` (remaining / pack grant),
   pools `ember 18`, bound slots `L1 ×0`, conditions `sapped · 3` with `restricts` in mono; empty states
   "no pools", "no conditions".
3. **Action detail** under the Declare select: `cost`, `tags`, `trigger.on`, and `valid` (e.g.
   `hasTarget(adjacent)`) verbatim in mono.
4. **Spatial caption** on the header chip: `theater-of-mind` → "this pack declares no spatial model";
   `grid` → the pack's `spatial` model + reach default verbatim. (The board itself is AUTHOR-DESIGN-CX.)
5. A combatant at hp ≤ 0 is **not** labelled differently (CX-D3).

Tokens only. **Done when:** one commit touching only `specs/design.md` and `mocks/combat.html`. Record the
revision.

---

## AUTHOR-DB-CX (DB) — APPROVED (Q4 a-i, Q1 a) — writes `specs/database.md` only
- FightDoc `start` row: add optional `positions: {[combatantId]: {x: int, y: int}}` — the positions passed to
  `startCombat`, present iff the pack declares a spatial model.
- FightDoc `start` row: add optional `allySpawns: [{statblockId, instanceId}]`, in `startCombat` ally order
  after the character; written only when non-empty.
- FightDoc `script` row: a fourth entry kind `{op:'move', positions: {[combatantId]: {x:int, y:int}}}` — the
  **complete** positions map after the reposition (every combatant).
- Replay rule step (3): "restore the ally, spawn `start.allySpawns` (absent = none), spawn `start.enemies`,
  begin with `start.positions` (absent = none); a `move` entry re-applies the reposition through the engine's
  serialize → restore seam with the same sides, the live balances and the entry's positions". A record on a
  spatial pack without `start.positions` replays as the library's refusal, never guessed.
- Integrity rules: `start.positions` values are `{x, y}` integers keyed by strings; `script[].op` ∈
  `declare | respond | step | move`; a `move` entry's `positions` has the same shape; `start.allySpawns`
  items are `{statblockId, instanceId}` strings.
- Migration History row 3 (additive, `formatVersion` stays 1). `FightDoc.combat` needs no change.

**Done when:** one commit touching only `specs/database.md`. Record the revision and the exact field names.

## AUTHOR-SPEC-CX (Spec) — APPROVED (Q4 a-i, Q2 a, Q3 a) — writes `specs/requirements.md` only
- **FR-11:** replace "Theater-of-mind (`theaterOfMind`) is the spatial model for v1." with: "The spatial
  model is the pack's: theater-of-mind when the pack declares none, otherwise its grid. On a grid pack, every
  combatant is placed before combat starts (a default layout the player can change), positions are shown on
  a board, and the library's reach and validity rejections render verbatim. Between declarations the player
  may reposition combatants; the engine has no movement rule, so the UI labels this as host repositioning."
- **FR-11 (Q2):** add "Enemies may instead be assembled from a threat budget
  (`assembleEncounter`/`spawnEncounter`) with an explicit numeric encounter seed the user types or picks with
  a user-initiated randomize. The library's result (groups, threat, budget, seed used, heuristic) is shown
  verbatim."
- **FR-12:** add "The initiative order (with the library's initiative rolls), and each combatant's
  action-economy slots, pools, bound slots and conditions, are rendered as the library reports them."
- **FR-14:** replay criterion "…re-applies it, placements and repositions included, …". Add (Q3): "A recorded
  fight can be resumed: its script, repositions included, is re-applied to a fresh fight on the stored pack.
  When the re-applied events equal the recorded events, play continues from that point. Otherwise resume is
  refused and the first divergent event is shown."
- **Constraints**, nondeterminism line: add "the encounter seed".
- **Glossary:** add **Grid** — "the pack-declared spatial model with positions and reach"; keep
  Theater-of-mind.

**Done when:** one commit touching only `specs/requirements.md`. Record the revision.

## AUTHOR-DESIGN-CX (Designer) — APPROVED (Q4 a-i, Q2 a, Q3 a) — writes `specs/design.md`, `mocks/fight.html`, `mocks/combat.html`
Runs **after DF-CX-1**.
- **Fight assembly placement board** (grid packs only): default layout (CX-D9: allies `x=0`, enemies `x=1`,
  `y` = index in own roster), change a square by pointer **and by keyboard**, shared squares allowed,
  viewport size stated as display-only; theater packs show no board.
- **Combat board:** tokens at the library's positions, active marker, side colour from existing tokens, the
  pack's `spatial` section verbatim, library distance from the active combatant.
- **Reposition** interaction (a-i) with the label "host repositioning — the engine has no movement rule" and
  its disabled state ("after a declare / while offers are open").
- Reach (`E-SPAT-01`) and validity (`valid`) rejections use the existing rejection card; state examples in the
  mock.
- **Allies panel** ally spawns (already in `mocks/fight.html`; placed like any combatant on grid packs).
- **Assemble by threat** row in the Enemies panel: budget input, seed input + ⟳, **Assemble**, and the
  library's encounter summary line in mono.
- **Resume** (ghost) on fight record rows beside Replay; a refused resume renders like a diverged replay
  (chip-danger + first divergent event).

Tokens only. **Done when:** one commit touching only the three files above. Record the revision.
