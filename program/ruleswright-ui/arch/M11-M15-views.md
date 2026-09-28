# M11–M15 — views (`src/renderer/src/views/{roll,world,character,fight,combat}/`)

This file holds what the five surfaces share and the M11 (Roll) detail. Each of M12–M15 has its own authoritative detail file (`M12-world.md`, `M13-character.md`, `M14-fight.md`, `M15-combat.md`); nothing is duplicated between them.

**Shared imports (mechanical, non-test):** `react`, M09 (`store/*` actions + state), M08 (`../ui`), each surface's own CSS, and per surface: M05 (`moods/map`, read-only — M11 only), M01 types (`shared/model` — M11 rows, M14 `FightRecordMeta`), M10 (`shell/EmptyState` — M12–M15 no-world branch), M06 types (M11, M12, M13) and one M06 runtime import (M12 `rerunUnavailableReason`). **Never** `ruleswright` (Custom Rule 1). Views otherwise reach the engine only through stores. Mocks (`mocks/*.html` + `specs/design.md`) are the structural contract.

**Cross-view edges (realized, runtime):** M13 → M15 (`character/inventory.tsx` imports `summaryOf` from `combat/log`); M14 → M15 (`fight/records.tsx` imports `LogRow` from `combat/log`); M15 → M14 (`combat/index.tsx` imports `RecordsPanel`, `RECORD_NAME_INPUT` from `fight/records`). M14 ↔ M15 is a module-level cycle with no file-level cycle.

| ID | Surface | Mock | Entry (realized) | Detail |
|---|---|---|---|---|
| M11 | roll | `mocks/roll.html` | `views/roll/index.tsx` → `RollView` | below |
| M12 | world | `mocks/world.html` | `views/world/index.tsx` → `WorldView` | `M12-world.md` |
| M13 | character | `mocks/character.html` | `views/character/index.tsx` → `CharacterView` | `M13-character.md` |
| M14 | fight | `mocks/fight.html` | `views/fight/index.tsx` → `FightView` | `M14-fight.md` |
| M15 | combat | `mocks/combat.html` | `views/combat/index.tsx` → `CombatView` | `M15-combat.md` |

## M11 — views/roll (v1-shell S01 minimal `b9f3518`; S03 split `bfc2497`, forge→World c4 `e99a2e4`; `wild` glyph loot-inventory S03 `5b5b84b`)
- Files: `index.tsx` (RollView: header + sections), `WorldList.tsx` (rows, inline rename, delete `ConfirmDialog`, corrupt chip + verdict card, skipped lines), `ImportPanel.tsx` (paste + file; success → `navigate('world')`), `ForgeForm.tsx` (ThemeCards from the library's theme list, seed + `⟳ Randomize`, knobs from `KnobSpec`; success → `navigate('world')`), `glyphs.ts` (`MOOD_GLYPH`: `✦ fantasy, ▲ urban, ✻ wild, ◆ archive`), `roll.css` (tokens only).
- Imports `moods/map` read-only; `engine/compiler` types (`KnobSpec`, `ThemeInfo`); `engine/errors` type `AppError`; `shared/model` types. No `EmptyState` (Roll is the no-world destination).
- Test ids: `nav-roll`, `roll-theme-<themeId>`, `roll-seed`, `roll-seed-randomize`, `roll-knob-<knobId>`, `roll-forge`, `roll-error`, `world-row`, `world-open`, `world-rename`, `world-delete`, `world-corrupt`, `import-paste`, `import-paste-submit`, `import-file`, `error-card`.
- Forge failure keeps entered parameters (journey-asserted). Design housekeeping carried to a future Designer re-entry: `mocks/roll.html` still shows `🎲 Randomize` while the app shows `⟳ Randomize`.

## Change history
- v1-shell: S01 c4 minimal Roll; S02 c3 placeholders for world/character/fight/combat (correct empty state before each surface landed); S03 Roll crafted; S04 World; S05 Character; S06 Fight + Combat.
- loot-inventory: S02 Character Inventory panel (M13, new M13 → M15 edge); S03 `wild` glyph (M11).
- combat-complete: S02 placement + combat board (M14, M15); S03 turn order/economy (M15); S04 ally spawns (M14); S05 threat assembly (M14); S06 Resume (M14).
