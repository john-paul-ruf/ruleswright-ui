# M15 — views/combat (`src/renderer/src/views/combat/`) — shared registry detail

**Note:** this file is the per-module detail page for M15. The combined views file `M11-M15-views.md` covers all five surfaces; this copy exists because PROGRAM-CONFIG's registry links here for M15. See `M11-M15-views.md` § M14/M15 for the authoritative realized description. Summary of the realized state (SESSION-06 c3 `269c0e8`, c4 `bf33cd3`):

- Files: `index.tsx`, `log.tsx`, `controls.tsx`, `combat.css`.
- `views/combat/index.tsx` imports `views/fight/records` (`RecordsPanel`, `RECORD_NAME_INPUT`); `views/fight/records.tsx` imports `views/combat/log` (`LogRow`). Views reach the engine only through `store/combat`.
- Test ids: `combat-surface, combat-log, combat-event (data-type, data-round), combat-filter-round, combat-filter-type, combat-phase, combat-round, combat-active, combat-declare-select, combat-target-select, combat-declare, combat-step, combat-rejection, combat-offers, combat-trigger-<n>, combat-trigger-target-<n>, combat-trigger-take-<n>, combat-trigger-decline-<n>, combat-combatant-<id>, combat-over, combat-over-record, combat-back, combat-record-name, combat-record`.

## Change history
- v1-shell plan: created (planned; S02 placeholder renders the correct empty state so routing is complete before the surface lands).
- SESSION-06 c3 (`269c0e8`), c4 (`bf33cd3`): realized as above.