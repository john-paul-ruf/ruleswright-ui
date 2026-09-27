# M13 — views/character (`src/renderer/src/views/character/`) — shared registry detail

**Note:** this file is the per-module detail page for M13. The combined views file `M11-M15-views.md` covers all five surfaces; this copy exists because PROGRAM-CONFIG's registry links here for M13. See `M11-M15-views.md` § M13 for the authoritative realized description. Summary of the realized state (SESSION-05 c3 `0ad13c8`, proof c4 `f128e78`):

- Files: `index.tsx` (`CharacterView`), `sheet.tsx` (Derived/PoolsSpells/Conditions/Progression panels), `side.tsx` (Snapshots/Create panels), `character.css`.
- Imports M09 (`character`, `worlds`, `ui`), M08, M10 `shell/EmptyState`, and engine **types** only.
- Test ids: `char-surface`, `char-name-display`, `char-hp`, `char-ac`, `char-saves`, `char-pool-<id>`, `char-spend-amount-<id>`, `char-spend-<id>`, `char-rest`, `char-slots`, `char-slot-<level>-<i>`, `char-spell-<id>`, `char-prepare-<id>`, `char-cast-<id>`, `char-spells-empty`, `char-condition-select`, `char-apply-condition`, `char-tick`, `char-condition-<id>`, `char-remove-<id>`, `char-restricted-actions`, `char-restricted-spells`, `char-class-<id>`, `char-xp`, `char-xp-amount`, `char-award-xp`, `char-set-level-<classId>`, `char-set-level`, `char-snapshot-name`, `char-snapshot-save`, `char-snapshot-load-<name>`, `char-snapshot-delete-<name>`, `char-snapshot-pack-<name>`, `char-name`, `char-race`, `char-class`, `char-level`, `char-create`.

## Change history
- v1-shell plan: created (planned; S02 placeholder renders the correct empty state so routing is complete before the surface lands).
- SESSION-05 c3 (`0ad13c8`): realized as above.

<!-- loot-inventory SESSION-02 -->
### loot-inventory SESSION-02 delta — M13 views/character
- New file `inventory.tsx` → `InventoryPanel({ view })`, rendered in `index.tsx` after `ConditionsPanel` (keyed by world id).
- New realized edge **M13 → M15**: `inventory.tsx` imports `summaryOf` from `views/combat/log.tsx` (runtime import).
- `character.css`: `.char-item*`, `.char-inv-empty`, `.char-row-kicker`, `.char-seed`, `.char-hint`, `.char-events*` (tokens only).
