# Author Re-entry — combat-complete (UI): REQUEST, revision 2 (awaiting human decision)

> **From:** Planner · **Program:** Ruleswright (UI) · **Feature:** `combat-complete`
> **Human requests (2026-09-27, verbatim):** "can you make the combat section fully implment what
> ruleswrights supports, turn order, spatial location, etc" · then "Ruleswright has been updated, please
> check again".
> **Evidence base (rev 2):** UI HEAD `7802c19` (source unchanged since `01d2457`); engine `../Ruleswright`
> HEAD `dadf461` (clean tree; last `src/` commit `38c017e`; feature `grid-combat` complete per its
> FINAL-REPORT). `dist/` built 2026-09-27 17:02, after the last source commit; the installed copy is
> hard-linked to it; `pnpm check:engine` → `engine ok: ruleswright@0.1.0`.
> Probes (Planner scratch, run 2026-09-27): `.program/probe-grid.mjs`, `.program/probe-grid2.mjs`.
> **Revision 1 (plan `7802c19`) is superseded.** Its Q4 ("the engine cannot do spatial") is false now.

Status: **Q1–Q4 are open. Q4 is no longer optional** (see "What broke"). DF-CX-1 still needs no human
decision (design-fill; Orchestrator may dispatch it now). Once answered, Orchestrator rewrites this header
as "APPROVED work orders" (as `prompts/loot-inventory/AUTHOR-REQUEST-LI.md` did) and dispatches them.

---

## What changed in the engine (f792f49 → dadf461), probed on the installed dist

| Fact | Evidence |
|---|---|
| **All three bundled themes now emit a grid.** Every generated pack carries `spatial: {model:'grid', reach:{default:1, <one statblock>:2}, shapes:['single','burst']}` (dark-fantasy `barrow-wight:2`, zombie-urban `slab-brute:2`, wyldwood `hollow-wight:2`) | probe-grid; theme JSON diff |
| **`startCombat` refuses a spatial pack unless every combatant has a position**: `RuntimeRuleError` with one `E-SPAT-01` card per combatant (`jsonPath positions.<id>`) | probe-grid, all 3 themes |
| New `StartCombatRequest.positions?: Record<id, {x,y}>`; `CombatantState.position?`; `Runtime.spatial` geometry (`distance`, `canReach`, `inBurst`) | `runtime.d.ts` |
| Declare gains two gates, both **events, never throws**: the `valid` clause (`strike`/`cut-down`/`baton-blow`/`thorn-lash` declare `hasTarget(adjacent)` → `declare:rejected {kind:'valid'}`, rule `E-REF-01`), then reach (`{kind:'spatial'}`, rule **`E-SPAT-01`**, "requires a target within reach 1; nearest brynn is 5 away") | probe-grid |
| **No movement verb.** Movement is `serializeCombat` → `deserializeCombat(rt, snap, {allies, enemies, positions})`. Restore emits no events, keeps rng words, hp, slot ledgers, conditions, and whatever balances the host re-states | probe-grid2 |
| Restore always comes back in `awaiting-declare` (unless a side is defeated). **After a declare this hands the same combatant a second action**: probe — hexer declares `ember-surge` (phase `resolved`, ember 18→16) → restore → `awaiting-declare`, and `step()` returns `turn-started` for the same combatant again | probe-grid2 |
| Combat snapshots now carry `position` per combatant (FightDoc `combat` stores it verbatim, no DB change for that field) | probe-grid |
| `E-SPAT-01` is a registered rule id (`RULE_IDS` 15) | engine `error-card.ts` |
| Pack bytes changed: dark-fantasy·42 16,056 → **16,482** B | probe-grid |

## What broke in the UI (right now, without any UI change)

- **Combat cannot start on any world forged from now on.** `store.begin()` passes no positions, so the
  library refuses with `E-SPAT-01` cards. The UI fails closed honestly (the cards render through the
  existing ErrorCard), but combat is unusable on new worlds.
- **Gates are red:** `pnpm test` 181/199 (18 failing in `tests/engine/combat.test.ts`,
  `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`; they forge fresh packs and begin).
  `pnpm typecheck` fails at `tests/engine/combat.test.ts:119` (the test's old `{defaultReach}` spatial
  shape vs the new `SpatialDef`). `pnpm e2e` **not run**; `e2e/combat.spec.ts` and `e2e/replay.spec.ts` are
  the specs that begin fights on freshly forged worlds and are expected red for the same reason.
- **Worlds forged before this engine** keep a pack with no `spatial` section, so they still fight in
  theater-of-mind. Their rerun-same-seed now fails honestly (bytes differ, same class as LI-D4), and their
  fight records replay as pack-diverged.
- FR-11 says "Theater-of-mind (`theaterOfMind`) is the spatial model for v1". The library now contradicts it
  for every bundled theme. Per requirements.md Assumptions, API drift is a requirements re-entry: this needs
  your decision.

---

## Questions for the human

**Q4 — Grid combat (required: without it, combat is dead on every new world).**
- **(a) Build the grid in the UI** *(recommended)*. The spatial model follows the pack: theater-of-mind when
  the pack declares none (older worlds, imported packs), grid otherwise. On a grid world:
  - **Placement** in Fight assembly: every combatant gets a square before Begin. A default layout is filled
    in (proposal: facing lines one step apart, allies at `x=0`, enemies at `x=1`, one row per roster entry)
    and you can change any square. The engine does not bound the grid or forbid shared squares; the board is a
    viewport, not a rule.
  - **Board** on Combat: tokens at the library's positions, the active combatant marked, the pack's `spatial`
    section shown verbatim (model, reach table, shapes), distance from the active combatant via the library's
    `rt.spatial.distance`. The UI computes no reach (the engine's `reachOf` is private).
  - Reach (`E-SPAT-01`) and validity (`kind: valid`) rejections render verbatim in the existing rejection card.
  - **Movement**, pick one:
    - **(a-i) Reposition between declarations** *(recommended)*: while the phase is `awaiting-declare` and no
      trigger offer is open, you may move any combatant (you already declare for every side). Labelled
      "host repositioning — the engine has no movement rule". Implemented with the engine's own
      serialize → restore seam. Not offered after a declare (it would grant a second action, see the probe).
    - **(a-ii) Placement only**: positions are fixed after Begin. Simpler, but out-of-reach melee fighters
      can never close (the engine's own journey recorded this stalemate).
  - Recording and replay carry the positions and every reposition (DB change, below).
- **(b) Do not build the grid.** Combat stays unavailable on every new world (the library's `E-SPAT-01` cards
  at Begin), only older worlds fight, and **replay can never report `complete` again** (older worlds' packs no
  longer re-roll byte-identically). Tests are repaired to prove the refusal.

**Q1 — Ally-side bestiary spawns** (FR-11 already approves; `mocks/fight.html` shows "+ Add bestiary spawn…").
Unchanged from rev 1, except that on a grid world spawns are placed like any combatant. Needs the additive
FightDoc field `start.allySpawns?`.
- (a) **Approve the additive field** *(recommended)*. (b) Allow ally spawns but block recording them. (c) Drop.

**Q2 — Encounter assembly by threat budget** (`assembleEncounter`/`spawnEncounter`, deterministic per seed).
Unchanged from rev 1; assembled enemies get default placement on grid worlds.
- (a) **Yes** *(recommended)*. (b) No.

**Q3 — Resume a recorded fight.**
- (a) **Re-apply the recorded script** (repositions included) to a fresh fight on the stored pack; resume only
  when the events match the record exactly. Lossless, no extra DB change *(recommended)*.
- (b) Engine `deserializeCombat` straight from the record's `combat` snapshot. It now restores positions, but
  still loses the live pool/bound-slot spend (not in `CombatSnapshot`) and restarts the log and `offerIndex`.
- (c) No resume.

---

## Engine gaps (for the engine program, whatever the answers; this program never edits `../Ruleswright`)

| # | Gap | Evidence | UI handling |
|---|---|---|---|
| EG-1 | `startCombat` silently merges duplicate combatant ids across sides | probe-combat2 (rev 1): `order x,x`, one combatant | UI refuses duplicates before calling it (CA-05) |
| EG-2 | `isDowned`/`defeatedSide` not exported | `runtime.d.ts` | no "down" label (CX-D3) |
| EG-3 | Combat conditions never tick; character conditions not carried into combat | source | show what the library holds |
| EG-4 **new** | Reach overrides are looked up by **combatant id**, but the pack keys them by **statblock id**. A spawned `barrow-wight-1` gets reach 1, not the pack's 2 | probe-grid: at distance 2, id `barrow-wight` → accepted; id `barrow-wight-1` → rejected | UI does not rename ids to game it; shows the pack's reach table verbatim and lets declare decide |
| EG-5 **new** | No movement verb; restore after a declare returns `awaiting-declare` (a second action) | probe-grid2 | reposition offered only at `awaiting-declare` with no open offers (CX-D10) |
| EG-6 **new** | `serializeCombat` keeps only the first open offer per combatant | engine `snapshots.ts` `serializeCombat` | reposition blocked while any offer is open |
| EG-7 **new** | Bursts are not declarable from generated packs (only spells carry burst targeting; `declare` reads `pack.actions`) — the engine's own recorded gap | engine grid-combat FINAL-REPORT; probe-grid: no action effect uses `burst` | no burst targeting UI (nothing to target) |

---

## DF-CX-1 (Designer, design-fill — no human decision) — writes `specs/design.md`, `mocks/combat.html`

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
3. **Action detail** under the Declare select: `cost`, `tags`, `trigger.on`, **and `valid`** (e.g.
   `hasTarget(adjacent)`) verbatim in mono.
4. **Spatial caption** on the header chip: `theater-of-mind` → "this pack declares no spatial model";
   `grid` → the pack's `spatial` model + reach default verbatim. (The board itself is AUTHOR-DESIGN-CX.)
5. A combatant at hp ≤ 0 is **not** labelled differently (CX-D3).

Tokens only. **Done when:** one commit touching only `specs/design.md` and `mocks/combat.html`.

---

## Work orders drafted for approval (dispatch only after the matching answer)

### AUTHOR-DB-CX (DB) — writes `specs/database.md` only
On **Q4 = (a)** (required parts) and **Q1 = (a)** (the `allySpawns` part):
- FightDoc `start` row: add optional `positions: {[combatantId]: {x: int, y: int}}` — the positions passed to
  `startCombat`, present iff the pack declares a spatial model. *(Q4a)*
- FightDoc `start` row: add optional `allySpawns: [{statblockId, instanceId}]`, in `startCombat` ally order
  after the character. *(Q1a)*
- FightDoc `script` row: a fourth entry kind `{op:'move', positions: {[combatantId]: {x:int, y:int}}}` — the
  **complete** positions map after the reposition (every combatant). *(Q4 a-i only; omit on a-ii)*
- Replay rule step (3): "restore the ally, spawn `start.allySpawns` (absent = none), spawn `start.enemies`,
  begin with `start.positions` (absent = none); a `move` entry re-applies the reposition through the engine's
  serialize → restore seam with the same sides, the live balances and the entry's positions". A record on a
  spatial pack without `start.positions` replays as the library's refusal, never guessed.
- Integrity rules: `start.positions` values are `{x, y}` integers keyed by strings; `script[].op` ∈
  `declare | respond | step | move`; a `move` entry's `positions` has the same shape; `start.allySpawns`
  items are `{statblockId, instanceId}` strings.
- Migration History row 3 (additive, `formatVersion` stays 1). `FightDoc.combat` needs no change (it is
  verbatim `serializeCombat` output and now includes positions).

### AUTHOR-SPEC-CX (Spec) — writes `specs/requirements.md` only
- **Q4 = (a):** FR-11 replace "Theater-of-mind (`theaterOfMind`) is the spatial model for v1." with: "The
  spatial model is the pack's: theater-of-mind when the pack declares none, otherwise its grid. On a grid pack,
  every combatant is placed before combat starts (a default layout the player can change), positions are shown
  on a board, and the library's reach and validity rejections render verbatim." Plus, on **a-i**: "Between
  declarations the player may reposition combatants; the engine has no movement rule, so the UI labels this as
  host repositioning." Glossary: add **Grid** beside Theater-of-mind. FR-14 replay criterion: "…re-applies it,
  placements and repositions included, …".
- **Q4 = (b):** FR-11 add: "Packs that declare a grid are not playable in combat in v1; Begin shows the
  library's refusal."
- Q2 = (a): FR-11 threat-budget criterion + Constraints "the encounter seed" (text as rev 1).
- Q3 = (a): FR-14 resume criterion (text as rev 1, "repositions included").
- FR-12 (both paths): initiative order with the library's rolls, and each combatant's slots, pools, bound
  slots and conditions, rendered as the library reports them.

### AUTHOR-DESIGN-CX (Designer) — writes `specs/design.md`, `mocks/fight.html`, `mocks/combat.html`
Runs **after DF-CX-1** (both write `design.md` and `mocks/combat.html`).
- **Q4 = (a):** Fight assembly **placement board** (default layout, change a square by pointer **and by
  keyboard**, shared squares allowed, viewport size stated as display-only); Combat **board** (tokens, active
  marker, side colour from existing tokens, the pack's `spatial` section verbatim, library distance from the
  active combatant); on a-i a **Reposition** interaction and its disabled state ("after a declare / while
  offers are open") with the host-repositioning label; empty state for theater worlds (no board).
- Q2 = (a): Assemble-by-threat row + summary (rev 1 text). Q3 = (a): **Resume** on record rows (rev 1 text).
