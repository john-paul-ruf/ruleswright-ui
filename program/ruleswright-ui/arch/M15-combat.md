# M15 — views/combat (`src/renderer/src/views/combat/`) — shared registry detail

**Note:** this file is the per-module detail page for M15. The combined views file `M11-M15-views.md` covers all five surfaces; this copy exists because PROGRAM-CONFIG's registry links here for M15. See `M11-M15-views.md` § M14/M15 for the authoritative realized description. Summary of the realized state (SESSION-06 c3 `269c0e8`, c4 `bf33cd3`):

- Files: `index.tsx`, `log.tsx`, `controls.tsx`, `combat.css`.
- `views/combat/index.tsx` imports `views/fight/records` (`RecordsPanel`, `RECORD_NAME_INPUT`); `views/fight/records.tsx` imports `views/combat/log` (`LogRow`). Views reach the engine only through `store/combat`.
- Test ids: `combat-surface, combat-log, combat-event (data-type, data-round), combat-filter-round, combat-filter-type, combat-phase, combat-round, combat-active, combat-declare-select, combat-target-select, combat-declare, combat-step, combat-rejection, combat-offers, combat-trigger-<n>, combat-trigger-target-<n>, combat-trigger-take-<n>, combat-trigger-decline-<n>, combat-combatant-<id>, combat-over, combat-over-record, combat-back, combat-record-name, combat-record`.

## Change history
- v1-shell plan: created (planned; S02 placeholder renders the correct empty state so routing is complete before the surface lands).
- SESSION-06 c3 (`269c0e8`), c4 (`bf33cd3`): realized as above.

<!-- combat-complete SESSION-02 --> M15
### combat-complete SESSION-02 delta — M15 views/combat — new `board.tsx`; `index.tsx`, `controls.tsx`, `combat.css`
- `board.tsx` `CombatBoard({ state })` (the design's "Combat board" + "Reposition control"): mounted after `OffersPanel`, before `CombatantsPanel`; grid packs only.
  - Tokens are at `state.combatants[id].position`, in roster order from `live.sides`.
  - Distances from the active combatant use `distance(fight.runtime, a, b)` (library `rt.spatial.distance`).
  - The Reposition mode mirrors the store precondition (phase `awaiting-declare`, `pending.length === 0`, `!over`) and applies `move(completeMap)`.
  - Test ids: `combat-board`, `combat-spatial-def`, `combat-token-<id>` (`data-x`, `data-y`, `data-active`), `combat-distance-<id>`, `combat-move`, `combat-move-banner`, `combat-move-apply`, `combat-move-cancel`, `combat-move-unavailable`.
- `controls.tsx`: the declare rejection card is now `ErrorCard{ kind: 'library', operation: rejection.type, name: payload.kind, cards: [{ rule, jsonPath: resource, message }] }`, i.e. `declare:rejected · <kind>` / `<rule> <resource>` / message (design row "Declare rejection examples").
- M15 now imports M08 `Board`. There are no new module edges (views → store + ui as before).


<!-- combat-complete SESSION-03 --> M15
### combat-complete SESSION-03 delta — M15 views/combat
- New `order.tsx`: `TurnOrderPanel({ state })` — DF-CX-1 Turn order panel (`state.order` rows, active = `state.active`, `round R · turn T+1 of K`) + Initiative provenance block (from `initiativeOf(log)`; absent → "initiative event not in this log"). Mounted in `index.tsx` between `CombatBoard` and `CombatantsPanel`.
- `controls.tsx`: `ActionDetail` (under the Declare select, before Target/Declare) and `CombatantDetail` (`details/summary` under each `CombatantRow`, open for the active combatant); read `fight.runtime.pack` for `actionInfo`, `slotGrants` and `content.conditions[id].restricts`.
- `index.tsx`: DF-CX-1 Spatial caption beside the header chip (`model <model> · reach.default <n>` / "this pack declares no spatial model").
- `combat.css`: `.combat-head-chips`, `.combat-caption`, `.combat-well`, `.combat-strong`, `.combat-order-*`, `.combat-detail`, `.combat-chips`, `.combat-condition`, `.combat-note-s`, `.combat-empty`.
- Module edges unchanged (views → store + ui only).
