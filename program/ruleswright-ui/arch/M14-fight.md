# M14 — views/fight (`src/renderer/src/views/fight/`) — shared registry detail

**Note:** this file is the per-module detail page for M14. The combined views file `M11-M15-views.md` covers all five surfaces; this copy exists because PROGRAM-CONFIG's registry links here for M14. See `M11-M15-views.md` § M14/M15 for the authoritative realized description. Summary of the realized state (SESSION-06 c3 `269c0e8`):

- Files: `index.tsx`, `determinism.tsx`, `records.tsx`, `fight.css`.
- `views/fight/records.tsx` imports `views/combat/log` (`LogRow`); `views/combat/index.tsx` imports `views/fight/records` (`RecordsPanel`, `RECORD_NAME_INPUT`). Views reach the engine only through `store/combat`.
- Test ids: `fight-surface, fight-spatial, fight-begin, fight-ally, fight-enemy-<instanceId>, fight-enemy-remove-<instanceId>, fight-add-enemy, fight-add-enemy-submit, fight-rerun, fight-determinism, fight-records, fight-record-<name>, fight-record-rng-<name>, fight-replay-<name>, fight-replay-status (data-status), fight-replay-event, fight-replay-divergence`.

## Change history
- v1-shell plan: created (planned; S02 placeholder renders the correct empty state so routing is complete before the surface lands).
- SESSION-06 c3 (`269c0e8`): realized as above.