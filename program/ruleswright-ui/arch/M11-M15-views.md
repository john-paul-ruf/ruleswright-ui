# M11–M15 — views (`src/renderer/src/views/{roll,world,character,fight,combat}/`)

**Imports:** M09 (actions + state), M08, M05 (read-only). **Never** `ruleswright`. Mocks are the structural contract.

| ID | Surface | Mock | Session | Entry |
|---|---|---|---|---|
| M11 | roll | `mocks/roll.html` | S01 (minimal) → S03 (crafted) | `views/roll/index.tsx` exporting `RollView` |
| M12 | world | `mocks/world.html` | S02 (placeholder) → S04 | `views/world/index.tsx` exporting `WorldView` |
| M13 | character | `mocks/character.html` | S02 (placeholder) → S05 | `views/character/index.tsx` exporting `CharacterView` |
| M14 | fight | `mocks/fight.html` | S02 (placeholder) → S06 | `views/fight/index.tsx` exporting `FightView` |
| M15 | combat | `mocks/combat.html` | S02 (placeholder) → S06 | `views/combat/index.tsx` exporting `CombatView` |

Each placeholder (S02) renders the correct empty state so routing is complete before the surface lands.

## Change history
- v1-shell plan: created (planned).
