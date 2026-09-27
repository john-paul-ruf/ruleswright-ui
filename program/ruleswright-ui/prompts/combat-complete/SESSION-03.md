# SESSION-03 — Combat surface: turn order, initiative, action economy, conditions

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete (plan rev 2; this was SESSION-01 in rev 1)
> **Modules:** M06, M09, M15, M08 (only if DF-CX-1 adds a component), M17
> **Depends on:** SESSION-02; DF-CX-1 (Designer design-fill commit to `specs/design.md` + `mocks/combat.html`)
> **Concurrent with:** —
> **Owns:** `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/combat/index.tsx`, `src/renderer/src/views/combat/controls.tsx`, `src/renderer/src/views/combat/order.tsx`, `src/renderer/src/views/combat/combat.css`, `src/renderer/src/ui/Combat.tsx`, `src/renderer/src/ui/ui.css`, `src/renderer/src/ui/index.ts`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts`
> **Reads:** `program/ruleswright-ui/PROGRAM-CONFIG.MD`, `program/ruleswright-ui/specs/design.md`, `program/ruleswright-ui/mocks/combat.html`, `program/ruleswright-ui/specs/requirements.md`, `program/ruleswright-ui/arch/M06-engine.md`, `program/ruleswright-ui/arch/M11-M15-views.md`, `node_modules/ruleswright/dist/runtime.d.ts`, `../Ruleswright/src/runtime/combat/*.ts`, `src/renderer/src/views/combat/log.tsx`, `src/renderer/src/views/combat/board.tsx`, `src/renderer/src/ui/Rows.tsx`, `e2e/fixtures.ts`
> **Resources:** `e2e:out` (checkpoints 2–3)
> **Checkpoints:** 3

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M06 | engine | `engine/combat.ts` | Two library pass-throughs (`slotGrants`, `actionInfo`). Still the only `ruleswright` importer |
| M09 | store | `store/combat.ts` | Re-export them; `initiativeOf` log selector |
| M15 | views/combat | `index.tsx`, `controls.tsx`, new `order.tsx`, `combat.css` | The new panels (beside SESSION-02's board) |
| M08 | ui | `Combat.tsx`, `ui.css`, `index.ts` | Only if DF-CX-1 names a new design-system component |
| M17 | tests | the three combat test files | Proofs |

## Context
After SESSION-02 the Combat surface runs the real loop on grid and theater worlds, with a board. It still
hides: the initiative rolls (only in the log's `combat:start` row), the turn position, each combatant's slot
ledger, pools, bound spell slots and conditions, and what the selected action costs or requires. A player sees
`slot-exhausted`, `E-POINTS-01` or `kind: valid` rejections with no context. This session shows all of that
**as the library reports it**, adding no rules (Custom Rule 2).

## Capabilities
- **CAP-01 Turn order & initiative (owned here, complete).** `startCombat` → `combat:start` (caught by the
  store subscription, which starts before `begin`; stamped `at {round:0, turn:0}`) + `fight.state.{order,
  turn,active,round}` → Turn order panel. Survives a reposition: the new fight keeps `order/turn/active/round`
  (S01 CA-13) and the log keeps the `combat:start` row.
- **CAP-02 Combatant economy & action detail (owned here, complete).** `state.combatants[id].slots.remaining /
  pools / boundSlots / conditions` + `resolveSlotGrants(rt.pack).slots` + `pack.actions[id]` → Combatant detail
  and Action detail.

## Contract Agreements
Recheck at checkpoint 0 against the installed `runtime.d.ts` and `../Ruleswright/src/runtime/combat/combat.ts`.
- **CA-01 initiative provenance.** `combat:start` `payload.order`, `payload.initiative` (e.g. `"b +2"`),
  `why.rolls` (e.g. `"d20[8]+4=12 (a)"`), `why.rule` (`combat.startCombat`) — verbatim, never parsed or
  re-sorted. Rows from `state.order`. Event absent → "initiative event not in this log".
- **CA-02 slot ledger.** `name remaining/grant`: remaining = `state.combatants[id].slots.remaining[name]`,
  grant = `resolveSlotGrants(rt.pack).slots[name]`. No subtraction, no affordability judgement. Grant key
  order as the library returns it; a remaining key missing from the grant → `name remaining/—`.
- **CA-03 action detail.** `pack.actions[actionId]` → `cost` (`slots`, `points {pool, amount}`, `vancian`),
  `tags`, `trigger.on`, and **`valid`** (e.g. `hasTarget(adjacent)`) verbatim; absent parts omitted. No
  pre-judgement: the declare result stays the authority (the engine's gate order is action → restriction →
  target → validity → reach → cost). `ActionDef = {cost, valid?, trigger?, effect, tags?}`
  (`../Ruleswright/src/schema/artifacts.ts:31`). Do not render `effect`.
- **CA-04 conditions.** `{conditionId, duration}` verbatim + the pack condition's `restricts`. Durations do
  not tick in combat (EG-3); show what the library holds.
- **CX-D3.** No "down"/"skipped" label (`isDowned` not exported, EG-2).

Probe facts to reproduce at checkpoint 0 (dark-fantasy · 42): `economy.turnSlots = {main:1, move:1,
reaction:1}`; hexer ally balances `{pools:{ember:18}, boundSlots:{"1":0}}`; `turn:began.payload.slots` equals
the replenished ledger.

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `engine/combat.ts` | modify | Value import `resolveSlotGrants`; `slotGrants(rt)`, `actionInfo(pack, actionId)` |
| `store/combat.ts` | modify | Re-export both + `type ActionInfo`; `initiativeOf(log)` |
| `views/combat/order.tsx` | create | `TurnOrderPanel` + initiative block |
| `views/combat/controls.tsx` | modify | Action detail under Declare; Combatant detail |
| `views/combat/index.tsx` | modify | Mount `TurnOrderPanel` per DF-CX-1; spatial caption per DF-CX-1 item 4 |
| `views/combat/combat.css` | modify | Tokens-only |
| `ui/*` | modify only if DF-CX-1 adds a component | — |
| `tests/engine/combat.test.ts`, `tests/store/combat.test.ts` | modify | Wrapper + selector cases |
| `e2e/combat.spec.ts` | modify | CAP-01/02 lockstep journey |

## Implementation

### Checkpoint 0 — recheck (no commit)
Read DF-CX-1's committed rows + mock. Absent → `blocked`. Reproduce the probe facts in `.program/` scratch.
Confirm `resolveSlotGrants` in `runtime.d.ts` and SESSION-02's board ids at HEAD.

### Checkpoint 1 — pass-throughs + selector
```ts
export function slotGrants(rt: Runtime): Readonly<Record<string, number>>; // resolveSlotGrants(rt.pack).slots
export interface ActionInfo { actionId: string; cost: ActionCost; tags: readonly string[];
  triggerOn: string | null; valid: string | null }
export function actionInfo(pack: Pack, actionId: string): ActionInfo | null;
export function initiativeOf(log: readonly RuntimeEvent[]): RuntimeEvent | undefined; // store
```
`ActionCost` is exported by `ruleswright/schema` (verified in `schema.d.ts`); re-export it, do not restate it.
Tests: `slotGrants` dark-fantasy·42 = `{main:1,move:1,reaction:1}` and equals `resolveSlotGrants(pack).slots`;
zombie-urban (no `economy`) equals the engine default; `actionInfo(pack,'parry').triggerOn ===
'attack:rolled[target=self]'`; `actionInfo(pack,'cut-down').valid === 'hasTarget(adjacent)'`;
`actionInfo(pack,'ember-surge').cost.points` = `{pool:'ember', amount:2}`; unknown id → `null`. Store: after
`begin()`, `initiativeOf(log).payload.order` deep-equals `state.order`, and still does after a `move`.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass.

### Checkpoint 2 — panels
- `TurnOrderPanel` (`combat-order`): rows `combat-order-<id>` (`data-active`), `combat-order-position`
  = `round R · turn T+1 of K` (the `+1` is display indexing; comment it), `combat-initiative`.
- `controls.tsx`: `combat-action-detail`; per combatant `combat-ledger-<id>`, `combat-pools-<id>`,
  `combat-bound-<id>`, `combat-conditions-<id>`. Keep every existing id and the `combat-combatant-<id>` meta
  text the specs assert.
- Keyboard: no new focus traps; keep the Declare → Step Tab order the keyboard e2e walks.
**Commit when:** unit gates pass and `pnpm build` exits 0 (under `e2e:out`).

### Checkpoint 3 — CAP-01/02 e2e
One new test in `e2e/combat.spec.ts`, on a grid world with the placement the UI shows (read from
`fight-place-<id>` as SESSION-02's tests do; the reference fight uses the same positions). Brynn vs 2
barrow-wights, dark-fantasy · 42:
1. After Begin: `combat-order-<id>` in `ref.fight.state.order` order; `combat-initiative` contains every
   reference `why.rolls` string; active row = `ref.fight.state.active`.
2. After every host call in lockstep: every `combat-ledger-<id>` contains `name remaining/grant` for each grant
   key; `combat-conditions-<id>`; `combat-order-position`.
3. On Brynn's turn, with Brynn adjacent to `barrow-wight-1` (place them so): `cut-down` →
   `combat-action-detail` shows `main 1` and `hasTarget(adjacent)`; declare with target `barrow-wight-1` →
   `main 0/1`; declare again with the same target → the `slot-exhausted` card equals the reference fight's own
   `declare:rejected` event; ledger unchanged.
4. After one reposition (SESSION-02 control) the order panel and ledgers are unchanged.
Negative control (not committed): alter one expected ledger number → fails; restore.
**Commit when:** `pnpm verify` exits 0 (record the build identity).

## Verification
- Unit gates each checkpoint; build at 2; `pnpm verify` at 3 (`e2e:out`).
- Integration proof CAP-01/02: built app via `e2e/fixtures.ts` (`_electron`, isolated temp userData); world
  and character created in the app; Node reference on the same installed engine and pack; build identity
  recorded. Boundary grep for `ruleswright` imports outside `engine/` is empty.

## State Update
Report: CA-01..04 evidence, DF-CX-1 revision used, design rows not honored, build identity, negative control,
new test ids. Arch deltas: M06 (`slotGrants`, `actionInfo`), M09 (re-exports, `initiativeOf`), M15 (`order.tsx`).
