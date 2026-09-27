# SESSION-02 — Inventory & loot on the Character surface (FR-18)

> **Program:** Ruleswright (UI)
> **Feature:** loot-inventory
> **Modules:** M06 M09 M13 M17
> **Depends on:** AUTHOR-SPEC-LI (FR-18 committed in `specs/requirements.md`) and AUTHOR-DESIGN-LI (Inventory panel committed in `mocks/character.html` + `specs/design.md`). Q1 approved by the human 2026-09-27. Not on SESSION-01 or SESSION-03.
> **Concurrent with:** SESSION-01, SESSION-03 (disjoint Owns, checked path by path; `e2e:out` serializes e2e steps only)
> **Owns:** `src/renderer/src/engine/runtime.ts`, `src/renderer/src/store/character.ts`, `src/renderer/src/views/character/inventory.tsx`, `src/renderer/src/views/character/index.tsx`, `src/renderer/src/views/character/character.css`, `tests/engine/runtime.test.ts`, `tests/store/character.test.ts`, `e2e/inventory.spec.ts`
> **Reads:** `src/renderer/src/views/character/{sheet,side}.tsx`, `src/renderer/src/views/combat/log.tsx` (`summaryOf`), `src/renderer/src/ui/**`, `src/renderer/src/engine/{errors,schema}.ts`, `src/renderer/src/views/roll/ForgeForm.tsx` (seed ⟳ pattern), `tests/support/**`, `e2e/fixtures.ts`, `e2e/character.spec.ts`, `node_modules/ruleswright/dist/runtime.d.ts`, `program/ruleswright-ui/specs/**`, `program/ruleswright-ui/mocks/character.html`
> **Resources:** `e2e:out`
> **Checkpoints:** 4 (+ c0 recheck)

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M06 | engine | `engine/runtime.ts` | the only place that may import `grantItem`/`dropItem`/`grantLoot` (Custom Rule 1) |
| M09 | store | `store/character.ts` (`mutate`, `CharacterSection`, `errors`) | new `inventory` section + three actions |
| M13 | views/character | `index.tsx`, `sheet.tsx` (ConditionsPanel = the pattern) | new `InventoryPanel` |
| M08 | ui | `Panel`, `Chip`, `StatNumeral`, `Input`, `Select`, `Button`, `EventRow`, `ErrorCard`, `EmptyWell` | tokens only (Custom Rule 6) |
| M17 | tests | `tests/store/character.test.ts` (in-process bridge restart pattern), `e2e/character.spec.ts` (forge/create helpers) | proofs |

## Context
Engine release `24b37c1`/`db531d5` (installed) gives characters an inventory. The UI shows none of it. Snapshots already carry it: `store/character.ts saveSnapshot` stores the verbatim `serializeCharacter` envelope, whose `state.inventory` is now populated. So persistence needs **no** model/storage/DB change (AR-LI Q3). This session adds the wrappers, store actions, the panel, and proofs.

**Approved decisions (human, 2026-09-27: "q1 yes"):** loot seed = explicit numeric field + user-initiated ⟳ (option a); the manual Grant row is included; loot tables = pack tables whose id ends in `-loot`. The committed FR-18 and mock carry these. At c0, read them. Where the committed layout or copy differs from this prompt's structure, the committed specs win for layout and copy; report the delta. A committed spec that contradicts an approved *decision* above is a blocker to report, not something to adapt to. If FR-18 or the mock is not committed, return `blocked` (dependency unmet).

## Capabilities
- **CAP-02 (integration owner, c4): Inventory & loot.** Entry: Character surface → Inventory panel.
  - Roll loot: table select + seed + Roll loot → store `loot(tableId, seed)` → `engine/runtime.loot` → `grantLoot(rt, c.state, tableId, { seed })` → `c.state.inventory` mutated → `viewOf` clone → panel rows. Events `loot:rolled` + `item:granted` shown with `why.rule`.
  - Grant: item select + qty → `grantItem`. Drop: per-row qty → `dropItem`.
  - Rejections (`insufficient-qty`, `item-not-held`, `invalid-amount`, `unknown-item`, `loot-grants-nothing`, `unknown-table`) → `toAppError` → inline `ErrorCard` verbatim, and the inventory is unchanged.
  - Durable: Save snapshot → app restart → Load → `restoreCharacter` → the same inventory.
  - Required facts and producers: item vocabulary = `pack.content.items` (compiler stage 7, installed, ready); loot tables = `pack.tables` (ready); seed = user field (this session); inventory state + events = library (ready); snapshot persistence = v1-shell CA-06 (ready, unchanged).
- Worlds with no `-loot` tables (zombie-urban) → `char-loot-empty` state. Items without loot → Grant still works.

## Contract Agreements
- **CA-13 (new, this session produces + proves):** the inventory shown is the library's. Rows = `view.state.inventory` in library order. Name/kind come from `pack.content.items[id]` verbatim (`name`, `kind`); a missing def shows the id only, never an invented name. qty is the library's number. No UI arithmetic on qty (Custom Rule 2): "remaining" and "total" come from event payloads or the next `viewOf`.
- **CA-14 (new, agreed: Q1 option a):** loot seed. The engine receives exactly the number in the seed field (`{ seed: Number(field) }`). ⟳ writes `crypto.getRandomValues(new Uint32Array(1))[0]` into the **field** (user-initiated, visible). Nothing is passed implicitly. An empty or non-integer field disables Roll loot. Never `Math.random` (lint) or `Date.now`.
- **CA-06 (v1-shell, re-proven for the new field):** snapshot envelope verbatim. Proof: `doc.snapshot.state.inventory` on disk deep-equals `serializeCharacter(rt, c.state).state.inventory` computed in the test process, and after restart + Load the rows match.
- **CA-05 (v1-shell):** failures verbatim through `ErrorCard`.
- **CA-07 (v1-shell) is not affected:** character-side events are not the combat log. The panel shows `lastEvents` of the inventory section only.

## Files to Create/Modify
| File | Action | What Changes |
|---|---|---|
| `src/renderer/src/engine/runtime.ts` | modify | import `grantItem, dropItem, grantLoot` (+ `type InventoryEntry`); add wrappers `grant`, `drop`, `loot`; `lootTableIds(rt)`; `CharacterView` gains `items` + `lootTables` |
| `src/renderer/src/store/character.ts` | modify | `CharacterSection` += `'inventory'`; actions `grant(itemId, qty)`, `drop(itemId, qty)`, `loot(tableId, seed)` via `mutate('inventory', …)` |
| `src/renderer/src/views/character/inventory.tsx` | create | `InventoryPanel({ view, pack })` |
| `src/renderer/src/views/character/index.tsx` | modify | render `<InventoryPanel>` after `<ConditionsPanel>` |
| `src/renderer/src/views/character/character.css` | modify | inventory row/grid classes, tokens only |
| `tests/engine/runtime.test.ts` | modify | wrapper tests over the real library |
| `tests/store/character.test.ts` | modify | store actions + snapshot restart leg |
| `e2e/inventory.spec.ts` | create | CAP-02 journey |

## Implementation

### Checkpoint 0 — recheck (no commit)
1. Author outcome: read `specs/requirements.md` (FR-18), `specs/design.md`, `mocks/character.html` at HEAD. Record the committed revision. List any delta vs this prompt.
2. `pnpm check:engine` ok. Confirm in `node_modules/ruleswright/dist/runtime.d.ts`: `grantItem(runtime, character: CharacterState, itemId, qty?): RuntimeEvent`, `dropItem(…): RuntimeEvent`, `grantLoot(runtime, character, tableId, opts?: LootOptions): readonly RuntimeEvent[]`, `LootOptions { seed?: number | string; rng?: RandomSource }`, `CharacterState.inventory: InventoryEntry[]`. (Planner verified these at plan time, lines ~601–675.)
3. Probe in node with the installed dist. Planner's plan-time values: dark-fantasy · 42 (default knobs), Brynn `hillfolk`/`warden` 1, `grantLoot('barrow-loot', {seed: 42})` → `[{id:'grave-ward',qty:1}]`; seeds 1 → hearth-bread, 2 → oaken-cudgel. Find one seed in 1..500 whose barrow-loot roll throws `loot-grants-nothing`, and record it. If none exists, the e2e uses the `insufficient-qty` rejection only; say so.
4. SESSION-01 may have landed; that doesn't matter here (disjoint).

### Checkpoint 1 — engine wrappers
In `engine/runtime.ts`, following the existing `attempt` pattern:
```ts
/** FR-18: grant a pack-declared item (qty default 1). */
export function grant(rt: Runtime, c: Character, itemId: string, qty: number): Outcome<RuntimeEvent> {
  return attempt('character:grant-item', () => grantItem(rt, c.state, itemId, qty));
}
/** FR-18: drop held qty; overdraw → `insufficient-qty`, nothing changes. */
export function drop(rt: Runtime, c: Character, itemId: string, qty: number): Outcome<RuntimeEvent> {
  return attempt('character:drop-item', () => dropItem(rt, c.state, itemId, qty));
}
/** FR-18 / CA-14: roll a loot table with the user's explicit seed. */
export function loot(rt: Runtime, c: Character, tableId: string, seed: number): Outcome<readonly RuntimeEvent[]> {
  return attempt('character:loot', () => grantLoot(rt, c.state, tableId, { seed }));
}
/** FR-18: the pack's loot tables, by the engine's `-loot` id convention (engine stage-7 integrity scope). */
export function lootTableIds(rt: Runtime): readonly string[] {
  return Object.keys(rt.pack.tables).filter((id) => id.endsWith('-loot'));
}
```
`CharacterView` += `items: readonly { id: string; name: string | null; kind: string | null }[]` (from `rt.pack.content.items ?? {}` in pack order, verbatim strings, `null` when absent) and `lootTables: readonly string[]`. Fill both in `viewOf`. Re-export `type InventoryEntry`.
Unit tests (`tests/engine/runtime.test.ts`, existing `runtimeFor` helper): loot seed 42 → inventory `[{grave-ward,1}]` and the events `['loot:rolled','item:granted']` with `why.rule` `tables.barrow-loot` / `content.items.grave-ward`; same seed twice → qty 2; drop 5 of 1 → `ok:false`, card rule `insufficient-qty`, inventory unchanged; grant `nope` → `unknown-item`; `lootTableIds` = `['barrow-loot']` on dark-fantasy and `[]` on zombie-urban; `viewOf` items carry `name`/`kind` verbatim.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` exit 0.

### Checkpoint 2 — store actions + restart leg
In `store/character.ts`: `CharacterSection` add `'inventory'`. Add interface members and implementations:
`grant: (itemId, qty) => void mutate('inventory', (rt, c) => rules.grant(rt, c, itemId, qty))`, and the same for `drop` and `loot(tableId, seed)`.
Unit (`tests/store/character.test.ts`, in-process bridge pattern already in the file):
- loot → `view.state.inventory` and `lastEvents` types.
- A rejection sets `errors.inventory` and leaves `view` unchanged.
- **Restart leg:** `saveSnapshot('packed')` → new stores on the same tmp root (a fresh worlds store `startup()` + a fresh character store) → `loadSnapshot('packed')` → inventory deep-equal. The stored `SnapshotDoc.snapshot.state.inventory` deep-equals `serializeCharacter(...)`.
**Commit when:** typecheck, lint, test exit 0.

### Checkpoint 3 — Inventory panel
`views/character/inventory.tsx`, structured per the committed mock (Designer's inventory panel). Pattern from `ConditionsPanel` in `sheet.tsx`. Test ids (each at most once per screen):
- `char-inventory` (panel), `char-inventory-empty`
- rows `char-item-<id>` containing `char-item-qty-<id>`, `char-drop-amount-<id>`, `char-drop-<id>`
- `char-grant-item` (select over `view.items`), `char-grant-qty`, `char-grant`
- `char-loot-table` (select over `view.lootTables`), `char-loot-seed`, `char-loot-seed-randomize`, `char-loot`, `char-loot-empty`
- `char-inventory-error` wrapping `ErrorCard`
- events `char-inventory-event-<n>` using `EventRow` with the summary from `views/combat/log.tsx summaryOf` (import it; read-only; do not edit that file) and `why.rule` verbatim

Seed field: integer text input. ⟳ = `crypto.getRandomValues` into the field (CA-14). Roll loot is disabled unless the field is a safe integer. Wire in `index.tsx` after `<ConditionsPanel>`. CSS: tokens only.
**Commit when:** typecheck, lint, test exit 0, and `pnpm build` exit 0.

### Checkpoint 4 — CAP-02 e2e
`e2e/inventory.spec.ts` (own `forge`/`createCharacter` helpers copied from `e2e/character.spec.ts`; do not edit that file). Expected values are computed in the test process with the library (`generateCampaign` + `Runtime` + `createCharacter` + `grantLoot`), never hardcoded:
1. Forge dark-fantasy · 42 → Character → create Brynn (hillfolk · warden 1) → `char-inventory-empty` visible.
2. Seed field `42` → Roll loot on `barrow-loot` → row `char-item-grave-ward` qty = the library value. Event rows show `loot:rolled` and `item:granted` with `why.rule` text.
3. Roll again with the same seed → qty 2 (stacking).
4. Drop amount 5 → `char-inventory-error` contains the library's `insufficient-qty` message verbatim; qty still 2. Drop 1 → qty 1.
5. Grant `hearth-bread` × 2 → row qty 2.
6. (If c0 found one) the flavor seed → `loot-grants-nothing` card verbatim, no change.
7. Save snapshot `packed` → read `snapshots/<worldId>/packed.json` → `snapshot.state.inventory` deep-equals the in-process expectation → `rw.restart()` → reopen the world → Character → create is empty → Load `packed` → rows and qtys identical.
8. Forge zombie-urban · 42 → create a character (first race/class from the pack) → `char-loot-empty` visible; the Grant row works.
9. `expectOnlyLocalRequests`-style assertion (FR-17). Copy it from `shell.spec.ts`.

**Commit when:** `pnpm verify` exit 0 (all prior e2e + the new spec).

## Verification
- `pnpm verify` with `e2e:out` held (H-1). GUI required (H-2). Quote `test-results/build-identity.json` (head, dirty false).
- Architecture: `grep -rn "from 'ruleswright" src --include=*.ts* | grep -v src/renderer/src/engine/` is empty (Custom Rule 1; lint enforces it too). No qty arithmetic in views/store (Custom Rule 2): review the diff.
- CAP-02 and CA-13/14/06/05 IDs in the handoff. Report the Author revision checked at c0 and any delta applied.

## State Update
Commits per checkpoint, test counts, the c0 probe values (flavor seed), the committed-spec delta, new test ids (for PROGRAM-CONFIG Conventions), and the arch delta (M06 new exports, M09 section, M13 new file) written to `.program/signal/SESSION-02.arch.md`.
