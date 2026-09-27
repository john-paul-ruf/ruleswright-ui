# Author Re-entry — combat-complete (UI): REQUEST (awaiting human decision)

> **From:** Planner · **Program:** Ruleswright (UI) · **Feature:** `combat-complete`
> **Human request (2026-09-27, verbatim):** "can you make the combat section fully implment what
> ruleswrights supports, turn order, spatial location, etc"
> **Evidence base:** UI HEAD `01d2457`; engine `../Ruleswright` HEAD `f792f49` (clean tree); installed
> dist current (`pnpm check:engine` → `engine ok: ruleswright@0.1.0`); unit baseline 199/199.
> Probes: `.program/probe-combat.mjs`, `.program/probe-combat2.mjs` (Planner scratch, run 2026-09-27).

Status: **Q1–Q4 are open.** DF-CX-1 needs no human decision (design-fill; Orchestrator may dispatch it).
Nothing below is approved content until the human answers. Once answered, Orchestrator rewrites this
file's header as "APPROVED work orders" (as `prompts/loot-inventory/AUTHOR-REQUEST-LI.md` did) and
dispatches the matching Author workers.

---

## What the engine supports, and what the UI shows today

| Engine capability (installed dist) | UI today | Plan |
|---|---|---|
| `startCombat` with **several allies and several enemies** | Allies = the character only. Enemies = several spawns | CAP-03 → SESSION-02 (needs **Q1**) |
| Initiative: `combat:start` event (`payload.order`, `payload.initiative`, `why.rolls` = `d20[8]+4=12 (a)`); `state.order`, `state.turn`, `state.active`, `state.round` | Round, turn and active as text. The order only appears as the Combatants list; no initiative rolls outside the log | CAP-01 → SESSION-01 (design-fill DF-CX-1) |
| Per-turn **action economy**: `state.combatants[id].slots.remaining` (e.g. `main/move/reaction`), grants from `resolveSlotGrants(pack)`; replenished at `turn:began` | Not shown. Cost rejections (`slot-exhausted`, `E-ECON-01`) arrive without context | CAP-02 → SESSION-01 |
| Combat **pools** / **bound spell slots** per combatant (`pools`, `boundSlots`; the ally's come from `profileFromCharacter` balances, e.g. hexer `{ember: 18}`, `{"1": 0}`) | Not shown | CAP-02 → SESSION-01 |
| **Conditions** in combat (`conditions[{conditionId, duration}]`, applied by effects; `restricts` blocks tagged actions) | Not shown | CAP-02 → SESSION-01 |
| Action definitions: `cost` (slots / points / vancian), `tags`, `trigger.on` | The declare select lists bare ids | CAP-02 → SESSION-01 |
| **Encounter assembly** by threat budget: `assembleEncounter(rt, {budget, seed})` + `spawnEncounter` (deterministic per seed, documented heuristic `threat-weighted-uniform`) | Not offered | CAP-04 → SESSION-03 (needs **Q2**) |
| **Resume** a fight: `deserializeCombat(rt, snapshot, restore)` | Records are write-only for play (replay compares, never resumes) | CAP-05 → SESSION-04 (needs **Q3**) |
| **Spatial**: `spatialFromPack`, `gridGeometry`, `checkReach`, `inBurst`, `Position` | Chip "theater-of-mind" | **Not implementable in the UI.** See **Q4** |

### Why "spatial location" cannot be built in the UI today (probe facts)

1. **No pack can declare it.** `pack.schema.json` has `additionalProperties: false` at the root and no
   `spatial` key. `new Runtime({...pack, spatial: {defaultReach: 1}})` is **rejected** with
   `E-SCHEMA-02 @ spatial`, on all three bundled themes. None of them declares one.
2. **The combat loop never uses it.** `CombatantState` has no position. `Combat.declare` never calls
   `checkReach`. There is no move-to-position operation. `serializeCombat` never writes the snapshot's
   optional `position` field. The spatial helpers are standalone geometry that nothing calls.
3. A grid, positions or reach checks drawn by the UI would be **UI-invented rules**. That breaks
   Custom Rule 2 ("zero rules math in the UI") and FR-11 ("Theater-of-mind is the spatial model for v1").

Real spatial play is an **engine program**: its requirements-change and its sessions live in `../Ruleswright`.
This program never edits that repo.

---

## Questions for the human

**Q1 — Ally-side bestiary spawns (FR-11 already approves this; the fight mock shows "+ Add bestiary spawn…").**
Recording and replaying such a fight needs one **additive** FightDoc field (DB re-entry):
`start.allySpawns?: [{statblockId, instanceId}]`, in `startCombat` ally order after the character.
Records without it read as "no ally spawns". `formatVersion` stays 1 (Migration Policy rule 2).
- (a) **Approve the additive field** *(recommended)*.
- (b) Allow ally spawns but block recording when any are present. Honest, but the feature is half-done.
- (c) Drop ally spawns. FR-11 stays partly unmet.

**Q2 — Encounter assembly by threat budget (new FR-11 criterion + design).**
Fight assembly gains a row: numeric **threat budget**, explicit numeric **encounter seed** with a
user-initiated ⟳ (same affordance as the Roll and loot seeds), and **Assemble** (replaces the enemy roster
with `spawnEncounter`'s instances). The library's result is shown verbatim: groups, threat/budget,
`seedUsed`, heuristic.
- (a) **Yes** *(recommended)*.
- (b) No.

**Q3 — Resume a recorded fight (new FR-14 criterion + design).**
- (a) **Resume by re-applying the recorded script** to a fresh fight on the stored pack. The resumed
  events must equal the recorded events, or resume is refused and the divergence is shown. Lossless: pools,
  bound slots, open trigger offers and the log all come back exactly. No DB change. *(recommended)*
- (b) Resume through the engine's `deserializeCombat`. This needs an additive DB field for the live
  balances (combat pool spend is not in `CombatSnapshot`; the engine expects the paired character to carry
  it). The event log restarts, and trigger `offerIndex` restarts from 0. Lossy for this host.
- (c) No resume.

**Q4 — Spatial.**
- (a) **Keep theater-of-mind in the UI.** The combat surface states it plainly: "theater-of-mind — this
  pack declares no spatial model". Separately, if wanted, open an **engine program** in `../Ruleswright`
  for: a `spatial` pack section, positions in `CombatState`, a move operation, `checkReach` at declare,
  burst targeting, and positions in combat snapshots. Then a UI follow-up feature for a grid board.
  *(recommended)*
- (b) Stop this UI feature until the engine program lands.

Engine gaps found while probing, reported for the engine program whatever the answers are:
- `startCombat` silently merges duplicate combatant ids across sides (`order: x,x`, one combatant). The UI
  plan refuses duplicates before calling it (CA-05).
- `isDowned` / `defeatedSide` are not exported from `ruleswright/runtime`. The UI therefore shows hp as
  given and does **not** label anyone "down/skipped" (that would copy an engine rule, CX-D3).
- Combat conditions never tick (`duration` is fixed in combat). Character conditions are not carried into
  combat.

---

## DF-CX-1 (Designer, design-fill — no human decision) — writes `specs/design.md`, `mocks/combat.html`

**Why design-fill:** FR-11/FR-12/FR-16 already require the surface (round, active combatant and pending
actions at all times; cost rejections as readable cards). This only decides how the turn order and
per-combatant economy look. No new product behavior.

In `mocks/combat.html` control column, and as rows in `design.md` Component Inventory + the Combat
Screen Inventory entry:
1. **Turn order panel** (above Combatants): one row per `state.order` entry, in library order: combatant
   name, side chip, hp numeral. The active row carries the accent glow (existing rule). A `round N · turn
   T of K` line. An **Initiative** provenance block from the `combat:start` event: `payload.initiative`
   and `why.rolls` in mono, verbatim, plus `why.rule`.
2. **Combatant detail** (expand the existing Combatant row): slot ledger as chips `main 1/1 · move 0/1 ·
   reaction 1/1` (remaining / pack grant, both library numbers). Pools `ember 18`. Bound slots `L1 ×0`.
   Conditions `sapped · 3` (id · duration, verbatim) with its `restricts` pattern in mono. Empty states:
   "no pools", "no conditions".
3. **Action detail** under the Declare select: the selected action's `cost` (slots / points / vancian),
   `tags`, and `trigger.on` for reactive actions, all mono and verbatim from the pack.
4. **Spatial line**: the header chip `theater-of-mind` gets a caption: "this pack declares no spatial model".
5. States: a combatant at hp ≤ 0 is **not** labelled differently (CX-D3). It shows its hp numeral as given.

Tokens only. No new colors, fonts or radii.

**Done when:** one commit touching only `specs/design.md` and `mocks/combat.html`. Record the revision.

---

## Work orders drafted for approval (dispatch only after the matching answer)

### AUTHOR-DB-CX (DB) — on Q1 = (a): writes `specs/database.md` only
FightDoc table, `start` row: add the optional `allySpawns: [{statblockId: string, instanceId: string}]`
(bestiary spawns on the ally side, in the order passed to `startCombat` after the character). Replay rule
step (3): "spawn `start.allySpawns` (absent = none) after restoring the ally, then `start.enemies`".
Integrity rules: `start.allySpawns`, when present, is an array of `{statblockId, instanceId}` strings.
Migration History row 3 (additive, `formatVersion` stays 1).

### AUTHOR-SPEC-CX (Spec) — writes `specs/requirements.md` only
- Q2 = (a): FR-11 criterion "Enemies may instead be assembled from a threat budget
  (`assembleEncounter`/`spawnEncounter`) with an explicit numeric encounter seed the user types or picks
  with a user-initiated randomize. The library's result (groups, threat, budget, seed used, heuristic) is
  shown verbatim." Constraints nondeterminism line: add "the encounter seed".
- Q3 = (a): FR-14 criterion "A recorded fight can be resumed: its script is re-applied to a fresh fight on
  the stored pack. When the re-applied events equal the recorded events, play continues from that point.
  Otherwise resume is refused and the first divergent event is shown."
- FR-12 criterion (both paths, clarifying): "The initiative order (with the library's initiative rolls),
  and each combatant's action-economy slots, pools, bound slots and conditions, are rendered as the
  library reports them."
- Q4 = (a): FR-11 keeps "Theater-of-mind is the spatial model for v1". Add a note: "the engine accepts no
  pack spatial section at v0.1.0 (E-SCHEMA-02); grid play is an engine-program dependency".

### AUTHOR-DESIGN-CX (Designer) — on Q2/Q3 = (a): writes `specs/design.md`, `mocks/fight.html`
- Q2: Fight assembly Enemies panel: an **Assemble by threat** row (budget input, seed input + ⟳,
  **Assemble**), and the library's encounter summary line in mono.
- Q3: Fight record row gains **Resume** (ghost) beside Replay. A refused resume renders like a diverged
  replay (chip-danger + first divergent event).
