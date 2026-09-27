# Author Re-entry — loot-inventory (UI): APPROVED work orders

> **From:** Planner · **Program:** Ruleswright (UI) · **Feature:** `loot-inventory`
> **Evidence base:** UI HEAD `c38aa8c`; engine `../Ruleswright` HEAD `f792f49` (code `8b802b7`); installed
> dist hard-linked to the sibling `dist/`; `pnpm check:engine` ok.
> **Human decision (2026-09-27, verbatim):** "q1 yes q2 b".
> Read as: **Q1 = yes, on the recommendation**: FR-18 Inventory & loot, loot seed option **(a)** (explicit
> numeric field + user-initiated ⟳), and the manual **Grant row included**. **Q2 = (b)**: a fourth mood for
> `wyldwood`. Q3 (DB) needed no decision: no DB change.
>
> These are now **approved content** for two Author workers. Orchestrator may dispatch them under this
> approval without asking again. Each worker writes only its files below, and only the approved content.
> Anything beyond it (a new flow, different behavior, a DB change) goes back to the human.

The engine-change table and probe facts from the original request are kept in the appendix.

---

## AUTHOR-SPEC-LI (Spec) — writes `program/ruleswright-ui/specs/requirements.md` only

1. **Add FR-18: Inventory & loot** (after FR-17):
   - *User story:* As the developer-player, I want my character to hold pack items and roll the pack's loot tables into their inventory, so that I can exercise the pack's item economy.
   - *Acceptance criteria:*
     - [ ] Held items show as `{id, qty}` stacks, named from the pack's `content.items` (name, kind), never invented.
     - [ ] Grant an item from the pack's item list with a qty (`grantItem`), and drop held qty (`dropItem`). Rejections render the library's card verbatim and change nothing.
     - [ ] Roll a loot table (`grantLoot`) with an explicit numeric **loot seed** the user types or picks with a user-initiated randomize. Offered tables are the pack's `-loot`-suffixed tables. A pack with none shows an honest empty state. A flavor roll shows the library's `loot-grants-nothing` card verbatim.
     - [ ] Each mutation's events (`loot:rolled`, `item:granted`, `item:dropped`) show with `why.rule` verbatim.
     - [ ] Inventory survives save → restart → restore through the existing character snapshot (FR-10). No new store.
2. **FR-15:** change "the two bundled themes produce clearly distinct moods" to "**each bundled theme** (`dark-fantasy`, `zombie-urban`, `wyldwood`) produces a clearly distinct mood".
3. **FR-2** first criterion and the **Glossary → Theme**: "currently `dark-fantasy`, `zombie-urban`" → "currently `dark-fantasy`, `zombie-urban`, `wyldwood`". The "not a hardcoded UI-side theme list" clause is unchanged.
4. **Constraints**, nondeterminism line: add "…the only "random" is an explicit user-initiated seed pick (the Roll seed and the Character loot seed)."

**Done when:** one commit touching only `specs/requirements.md`. Record the revision.

## AUTHOR-DESIGN-LI (Designer) — writes `specs/design.md`, `mocks/character.html`, `mocks/design-language.html` (and `mocks/index.html` only if its mood-switch text lists the moods)

### A. Inventory panel (FR-18)
In `mocks/character.html`, add an **Inventory** panel to the sheet column after Conditions. Add rows to the `design.md` Component Inventory ("Inventory panel", "Item row") and to the Character entry in the Screen Inventory:
- Held stacks as rows: name (reading font), kind chip, `×qty` (stat numeral), id (mono), a Drop qty input plus a Drop button (ghost).
- Grant row: item select + qty + **Grant**, mirroring Conditions' apply row.
- Loot row: `-loot` table select, a **seed** input with ⟳ randomize (same affordance as Roll's seed), and **Roll loot** (primary).
- The last mutation's events as Event rows (`why.rule` in mono).
- An inline error card for rejections (e.g. `insufficient-qty`).
- Empty states: "Nothing held yet." / "This pack declares no loot tables."

Mock copy is illustrative. dark-fantasy · 42 facts, if wanted: items `oaken-cudgel, warded-mail, grave-ward, tallow-lantern, hearth-bread, barrow-key`; table `barrow-loot`; seed 42 → `grave-ward ×1`.

### B. Fourth mood for `wyldwood` (FR-15)
- A mood id (Planner's placeholder: `wild`), the theme mapping `wyldwood → <id>` in "The FR-15 mood mechanism", and the Moods list.
- **Mood values table:** add the new mood as a **new last column after `archive`**, with all 12 tokens as 6-digit hex (`--hairline` as `rgba(...)`, like the others). Keeping the existing column order means the current contrast gate (`tests/styles/contrast.test.ts`, which reads columns 2–4 by position) stays green until SESSION-03 extends it.
- **Legibility pre-check** (design.md invariant): `--dim` on `--surface` ≥ 4.5:1 and `--accent-ink` on `--accent` ≥ 4.5:1. State the measured ratios.
- **Fonts:** `--font-display` / `--font-reading`. Strongly preferred: families already bundled (Cinzel, Spectral, Oswald, Inter, JetBrains Mono). Bundled weights are Cinzel 600/700, Spectral 400 + 400-italic, Oswald 500/600, Inter 400–700, JetBrains Mono 400/500. A new *weight* of a bundled family is cheap. A new *family* adds a dependency (SESSION-03 is leased for it, but say so explicitly).
- **Glyph** for the mood's cards and world rows. Suggested: `✻` (in the design's glyph set, currently unused).
- **Atmosphere** (optional, like fantasy's candle glow / urban's hazard stripe): describe it as a `color-mix` derivation of the accent, never a new color.
- `mocks/design-language.html`: add the mood to its token blocks and mood switch so the sheet renders it.

**Done when:** one commit touching only the files above. Record the revision, the mood id, and the contrast ratios.

---

## Appendix — what changed in the engine (01dcf77 → f792f49)

| Change | Commit(s) | UI impact |
|---|---|---|
| Runtime inventory: `grantItem`, `dropItem`, `countItem`, `rollLoot`, `grantLoot`, `LootOptions`; `CharacterState.inventory: InventoryEntry[]` | `24b37c1`, `db531d5` | FR-18 (SESSION-02) |
| Events `loot:rolled`, `item:granted`, `item:dropped` (`why.rule` = `tables.<id>` / `content.items.<id>`, `why.rolls: []`) | `24b37c1` | render with the existing `EventRow` |
| Character snapshots carry `inventory` verbatim | `24b37c1` | already persisted (verbatim envelope); no DB change |
| Stage 7 copies theme `content.items` into packs | `753ced1` | pre-release worlds honestly fail rerun (same class as v1-shell H-8) |
| Third theme `wyldwood` | `fc60edc` | already in the picker (FR-2); mood → SESSION-03 |
| ESLint 10 / Prettier / license / `validate/` split / coverage | `41a967b` `6e052f6` `72346a5` `8b802b7` | none (theme JSONs semantically identical, probed) |

Probe (installed dist, seed 42, default knobs): dark-fantasy `barrow-loot` (42 → grave-ward, 1 → hearth-bread, 2 → oaken-cudgel); zombie-urban has **no** `-loot` tables; wyldwood `glade-loot` (42 → gloam-lantern). Rejection rule ids: `unknown-item`, `invalid-amount`, `item-not-held`, `insufficient-qty`, `unknown-table`, `unresolvable-ref`, `table-roll-failed`, `loot-grants-nothing`. `grantLoot` without a seed seeds from the table id, which is why the explicit loot seed exists.
