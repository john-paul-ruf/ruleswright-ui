# M14 — views/fight (`src/renderer/src/views/fight/`) — shared registry detail

**Note:** this file is the per-module detail page for M14. The combined views file `M11-M15-views.md` covers all five surfaces; this copy exists because PROGRAM-CONFIG's registry links here for M14. See `M11-M15-views.md` § M14/M15 for the authoritative realized description. Summary of the realized state (SESSION-06 c3 `269c0e8`):

- Files: `index.tsx`, `determinism.tsx`, `records.tsx`, `fight.css`.
- `views/fight/records.tsx` imports `views/combat/log` (`LogRow`); `views/combat/index.tsx` imports `views/fight/records` (`RecordsPanel`, `RECORD_NAME_INPUT`). Views reach the engine only through `store/combat`.
- Test ids: `fight-surface, fight-spatial, fight-begin, fight-ally, fight-enemy-<instanceId>, fight-enemy-remove-<instanceId>, fight-add-enemy, fight-add-enemy-submit, fight-rerun, fight-determinism, fight-records, fight-record-<name>, fight-record-rng-<name>, fight-replay-<name>, fight-replay-status (data-status), fight-replay-event, fight-replay-divergence`.

## Change history
- v1-shell plan: created (planned; S02 placeholder renders the correct empty state so routing is complete before the surface lands).
- SESSION-06 c3 (`269c0e8`): realized as above.

<!-- combat-complete SESSION-02 --> M14
### combat-complete SESSION-02 delta — M14 views/fight — `index.tsx`, `fight.css`
- `PlacementPanel` (internal to `index.tsx`; the design's "Placement board"), rendered between the Allies/Enemies panels and Determinism, only when `spatialOf(pack) !== null`. It reads the store's `positions`/`defaultPositions` and writes `setPosition`/`resetPositions`. Test ids: `fight-placement`, `fight-spatial-def`, `fight-place-<id>` (row; `data-x`, `data-y`), `fight-place-<id>-x|y` (integer inputs; a non-integer gives a danger border and nothing moves), `fight-token-<id>`, `fight-place-reset`.


<!-- combat-complete SESSION-04 --> M14
### combat-complete SESSION-04 delta — M14 views/fight — `views/fight/index.tsx`
- `AlliesPanel` now takes `runtime` and follows the design's Ally spawn row:
  - The spawn rows come after the character row. Each shows the statblock name and the mono line `spawnMonster · <instanceId> · ally side`, with a ghost − remove button.
  - A bestiary picker plus "+ Add bestiary spawn" sits below the note.
- `PlacementPanel`: the side is `enemy` only for enemy-roster ids. Names come from both rosters, so ally spawns show as `A2…` with their statblock name.
