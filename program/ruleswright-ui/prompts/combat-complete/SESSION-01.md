# SESSION-01 — Combat surface: turn order, initiative, action economy, conditions

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete
> **Modules:** M06, M09, M15, M08 (only if DF-CX-1 adds a component), M17
> **Depends on:** DF-CX-1 (Designer design-fill commit to `specs/design.md` + `mocks/combat.html`)
> **Concurrent with:** —
> **Owns:** `src/renderer/src/engine/combat.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/combat/index.tsx`, `src/renderer/src/views/combat/controls.tsx`, `src/renderer/src/views/combat/order.tsx`, `src/renderer/src/views/combat/combat.css`, `src/renderer/src/ui/Combat.tsx`, `src/renderer/src/ui/ui.css`, `src/renderer/src/ui/index.ts`, `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts`
> **Reads:** `program/ruleswright-ui/PROGRAM-CONFIG.MD`, `program/ruleswright-ui/specs/design.md`, `program/ruleswright-ui/mocks/combat.html`, `program/ruleswright-ui/specs/requirements.md`, `program/ruleswright-ui/arch/M06-engine.md`, `program/ruleswright-ui/arch/M11-M15-views.md`, `node_modules/ruleswright/dist/runtime.d.ts`, `../Ruleswright/src/runtime/combat/*.ts`, `src/renderer/src/views/combat/log.tsx`, `src/renderer/src/ui/Rows.tsx`, `e2e/fixtures.ts`
> **Resources:** `e2e:out` (checkpoint 3 only)
> **Checkpoints:** 3

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M06 | engine | `engine/combat.ts` | Add two library pass-throughs (`slotGrants`, `actionInfo`). Still the only `ruleswright` importer |
| M09 | store | `store/combat.ts` | Re-export them. Add the `initiativeOf` log selector |
| M15 | views/combat | `index.tsx`, `controls.tsx`, new `order.tsx`, `combat.css` | The new panels |
| M08 | ui | `Combat.tsx`, `ui.css`, `index.ts` | Only if DF-CX-1 names a new design-system component. Otherwise untouched |
| M17 | tests | `tests/engine/combat.test.ts`, `tests/store/combat.test.ts`, `e2e/combat.spec.ts` | Proofs |

## Context
The Combat surface already runs the real loop: declare/step/respond, trigger offers, combat-over, and a
provenanced log (v1-shell SESSION-06). It hides most of what the engine keeps per fight:

- the initiative rolls (only in the log's `combat:start` row)
- the turn order as an order (the Combatants panel lists `state.order`, but with no turn position)
- each combatant's per-turn slot ledger, pools, bound spell slots and conditions
- what the selected action costs

A player sees `slot-exhausted` or `E-POINTS-01` rejections with no context. This session shows all of that
**as the library reports it**. It adds no rules (Custom Rule 2). It also states the spatial model honestly.
Spatial play itself is not implementable (AUTHOR-REQUEST-CX Q4: the engine rejects a pack `spatial` section
with E-SCHEMA-02, and `Combat` has no positions).

## Capabilities
- **CAP-01 Turn order & initiative (owned here, complete).** Entry: Fight → Begin combat → Combat.
  Path: `startCombat` → `combat:start` event (caught by the store's existing subscription, which starts
  **before** `begin`; stamped `at {round:0, turn:0}`) + `fight.state.{order,turn,active,round}` →
  `store.state` (structuredClone) → Turn order panel. Nothing persists. The log already reaches FightDoc
  through records, unchanged.
- **CAP-02 Combatant economy & action detail (owned here, complete).** Path: `fight.state.combatants[id]`
  `.slots.remaining` / `.pools` / `.boundSlots` / `.conditions` (republished after every call) +
  `resolveSlotGrants(rt.pack).slots` + `pack.actions[id]` → Combatant detail and Action detail.
- **CAP-06 Spatial (contribution only).** A caption beside the existing `spatialLabel` chip. The capability
  stays **blocked** on the engine program (Q4).
- First narrow journey: checkpoint 3's e2e runs the built Electron app → Fight → Begin → Combat. It checks
  the turn order, initiative, ledger and conditions in lockstep with a Node reference fight on the same
  pack. Every later session builds on this surface.

## Contract Agreements
Recheck each at checkpoint 0 against the installed dist (`node_modules/ruleswright/dist/runtime.d.ts`)
and `../Ruleswright/src/runtime/combat/combat.ts`.

- **CA-01 initiative provenance.** Show `combat:start` `payload.order`, `payload.initiative` (strings
  like `"b +2"`) and `why.rolls` (strings like `"d20[8]+4=12 (a)"`) **verbatim**, plus `why.rule`
  (`combat.startCombat`). Do not parse the roll strings and do not re-sort them. The live order rows come
  from `state.order` (the library's sort); the round/turn line comes from `state.round`, `state.turn`,
  `state.order.length`. Unavailable (the event is not in the log) → the block says "initiative event not
  in this log". Never fabricate it.
- **CA-02 slot ledger.** Remaining = `state.combatants[id].slots.remaining[name]`. Grant =
  `resolveSlotGrants(rt.pack).slots[name]` (library call). Render `name remaining/grant`. No subtraction,
  no "can afford" judgement. Iterate the grant's keys in the library's key order. A remaining key missing
  from the grant (should not happen) renders as `name remaining/—`.
- **CA-03 action detail.** `pack.actions[actionId]` → `cost` (`slots`, `points {pool, amount}`,
  `vancian` level), `tags`, `trigger.on`: verbatim, absent parts omitted. `restricts` blocking and
  affordability are **not** pre-judged. The Declare result stays the authority (FR-12). Verified fields:
  `ActionDef = {cost, valid?, trigger?, effect, tags?}` (`../Ruleswright/src/schema/artifacts.ts:31`).
  Do not render `effect`/`valid` DSL (not requested; leave it to design).
- **CA-04 conditions.** `state.combatants[id].conditions[] = {conditionId, duration}` verbatim. The
  condition's `restricts` patterns come from `pack.content.conditions[conditionId].restricts` verbatim when
  present. Durations do not tick in combat (engine fact). Show what the library holds; add no claim either way.
- **CX-D3 (no downed label).** `isDowned` is not exported from `ruleswright/runtime` (probe:
  `'isDowned' in r === false`). Do not derive "down"/"skipped" from `hp ≤ 0`. Show hp verbatim.

Probe facts to reproduce at checkpoint 0 (dark-fantasy · 42): `economy.turnSlots =
{main:1, move:1, reaction:1}`. The hexer ally via `profileFromCharacter` has balances
`{pools:{ember:18}, boundSlots:{"1":0}}`. `turn:began.payload.slots` equals the replenished ledger.

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `src/renderer/src/engine/combat.ts` | modify | Add value import `resolveSlotGrants` from `ruleswright/runtime`. Add `slotGrants(rt)` and `actionInfo(pack, actionId)` |
| `src/renderer/src/store/combat.ts` | modify | Re-export `slotGrants`, `actionInfo`, type `ActionInfo`. Add `initiativeOf(log)` selector |
| `src/renderer/src/views/combat/order.tsx` | create | `TurnOrderPanel` + initiative provenance block |
| `src/renderer/src/views/combat/controls.tsx` | modify | Action detail under the Declare select; Combatant detail (ledger, pools, bound, conditions) |
| `src/renderer/src/views/combat/index.tsx` | modify | Mount `TurnOrderPanel` above Combatants per DF-CX-1; spatial caption |
| `src/renderer/src/views/combat/combat.css` | modify | Tokens-only styles for the new rows/chips |
| `src/renderer/src/ui/Combat.tsx`, `ui.css`, `index.ts` | modify only if DF-CX-1 adds a component | e.g. a ledger chip group. Presentational, no store/engine imports |
| `tests/engine/combat.test.ts` | modify | Wrapper cases |
| `tests/store/combat.test.ts` | modify | Selector + republish cases |
| `e2e/combat.spec.ts` | modify | New test: CAP-01/02 lockstep journey |

## Implementation

### Checkpoint 0 — recheck (no commit)
Read DF-CX-1's committed `design.md` rows + `mocks/combat.html` (Rule 1: design source). Reproduce the
probe facts above with a scratch script under `.program/`. Confirm `resolveSlotGrants` is in
`node_modules/ruleswright/dist/runtime.d.ts`. If DF-CX-1 has not landed, return `blocked`. Do not invent
the layout.

### Checkpoint 1 — engine pass-throughs + store selector
```ts
// engine/combat.ts
import { resolveSlotGrants, /* existing */ } from 'ruleswright/runtime';
/** FR-12/16: the pack's per-turn slot grants (declared economy or the engine default), verbatim. */
export function slotGrants(rt: Runtime): Readonly<Record<string, number>> {
  return resolveSlotGrants(rt.pack).slots;
}
export interface ActionInfo {
  actionId: string;
  cost: { slots?: Readonly<Record<string, number>>; points?: { pool: string; amount: number }; vancian?: number };
  tags: readonly string[];
  triggerOn: string | null;
}
/** FR-12: the pack's action definition fields a declarer needs, verbatim; null when the pack lacks the id. */
export function actionInfo(pack: Pack, actionId: string): ActionInfo | null;
```
Take the `ActionCost` field types from the installed `.d.ts` (`ruleswright/schema` type exports). If the
pack type is not exported under a usable name, type `cost` as the library's `ActionCost`. Do not
restate its fields by hand if the type is exported.

```ts
// store/combat.ts
export { listSpawnable, spatialLabel, spawnProfile, slotGrants, actionInfo } from '../engine/combat';
export type { ActionInfo } from '../engine/combat';
/** FR-12 / CA-01: the latest `combat:start` event in the log, or undefined. */
export function initiativeOf(log: readonly RuntimeEvent[]): RuntimeEvent | undefined;
```
Tests:
- `tests/engine/combat.test.ts`: `slotGrants` on dark-fantasy·42 equals `{main:1, move:1, reaction:1}`,
  and zombie-urban·42 (no `economy`) equals the engine default. **Compare against
  `resolveSlotGrants(pack).slots` called directly** as well as the literal. `actionInfo(pack,'parry')
  .triggerOn === 'attack:rolled[target=self]'`. `actionInfo(pack,'ember-surge').cost.points` equals
  `{pool:'ember', amount:2}`. Unknown id → `null`.
- `tests/store/combat.test.ts`: after `begin()`, `initiativeOf(log)` is the `combat:start` event.
  `payload.order` deep-equals `state.order`.
- After a declare of a slotted action, `state.combatants[active].slots.remaining` in the store equals
  `fight.state` (republish proof). Use a hexer ally for a pools case: `state.combatants[<ally>].pools`
  equals `{ember:18}` at begin.

**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass. Message:
`combat-complete SESSION-01: checkpoint 1 — slotGrants/actionInfo pass-throughs + initiativeOf`.

### Checkpoint 2 — panels
- `order.tsx` `TurnOrderPanel({state})`, test id `combat-order`:
  - one row per `state.order` entry (`combat-order-<id>`, `data-active="true|false"`), with the active row
    marked (library `state.active`)
  - a `round {round} · turn {turn + 1} of {order.length}` line (`combat-order-position`). Adding 1 turns the
    library's 0-based index into the display count. Say so in a code comment. It is not a rule
  - initiative block `combat-initiative` from `initiativeOf(log)`: `payload.initiative.join(' · ')`,
    each `why.rolls` entry on its own mono line, `why.rule`
- `controls.tsx`:
  - `PhasePanel`: under the Declare select, `combat-action-detail` renders `actionInfo(pack, actionId)`:
    slots `main 1`, points `ember 2`, vancian `L1`, tags, trigger. The pack comes from
    `useWorldsStore(s => s.active?.pack)`, the pattern `index.tsx` already uses.
  - `CombatantsPanel`: each existing `combat-combatant-<id>` row gains:
    - `combat-ledger-<id>`: chips `name remaining/grant` over `slotGrants(runtime)`, computed once per
      runtime with `useMemo`
    - `combat-pools-<id>`: `pool value` pairs, or "no pools"
    - `combat-bound-<id>`: `L<level> ×<n>` pairs, or nothing when empty
    - `combat-conditions-<id>`: `conditionId · duration` + restricts, or "no conditions"
  - Keep every existing test id and text the current e2e asserts (`combat-combatant-<id>` meta keeps
    `hp X / Y at start · ac Z`).
- `index.tsx`: mount `TurnOrderPanel` where DF-CX-1 puts it. The spatial chip gets
  `combat-spatial` + the caption from DF-CX-1 ("this pack declares no spatial model" for
  `theater-of-mind`).
- Keyboard: no new focus traps. The Declare → Step Tab order the keyboard e2e walks must stay the same
  (`e2e/combat.spec.ts:276`). Put new panels **after** the Phase panel in DOM order, or check that the
  keyboard test still passes unchanged.

**Commit when:** typecheck, lint and test pass, and `pnpm build` exits 0 (under `e2e:out`).

### Checkpoint 3 — CAP-01/02 e2e journey
Add one test to `e2e/combat.spec.ts` (reuse its helpers and its Node reference fight `ref`, built with
`ruleswright/runtime` on the same pack). Brynn (warden 1) vs 2 barrow-wights, dark-fantasy · 42:
1. After Begin: `combat-order-<id>` rows in exactly `ref.fight.state.order` order. `combat-initiative`
   contains every `why.rolls` string of the reference `combat:start` verbatim. The active row matches
   `ref.fight.state.active`.
2. After each host call (step, declare, respond), in lockstep with `ref`, for every combatant:
   `combat-ledger-<id>` contains `${name} ${remaining}/${grant}` for every grant key. `combat-conditions-<id>`
   contains every `conditionId · duration` of `ref.fight.state.combatants[id].conditions`, or "no
   conditions". `combat-order-position` equals `round R · turn T+1 of K`.
3. On the first turn where the ally (`brynn`) is active: select `cut-down` and see `combat-action-detail`
   show `main 1`. Declare it **with an explicit target** (`barrow-wight-1`). The ledger for that id then
   shows `main 0/1`. Declare it again with the same target. The library's gate order in `Combat.declare`
   is: action → restriction → **target** → cost. So the second call must name a target, or it is rejected
   `no-target` before cost. It yields the `slot-exhausted` rejection card (existing `combat-rejection`),
   and the ledger is unchanged. Assert the card text against the reference fight's own `declare:rejected`
   event, never a literal.
4. `combat-spatial` text `theater-of-mind` + the caption.
5. Negative control (run once, not committed): change one expected ledger number → the test fails; restore.

Run `pnpm e2e` (full suite, holds `e2e:out`). Record `test-results/build-identity.json` head/dirty.

**Commit when:** `pnpm verify` exits 0.

## Verification
- Per checkpoint: `pnpm typecheck && pnpm lint && pnpm test`. Checkpoints 2–3: `pnpm build`.
  Checkpoint 3: `pnpm verify` (STATE Verification Baseline; `e2e:out` held for build/e2e only).
- Integration proof CAP-01/CAP-02 (CA-01..04):
  - Test path `e2e/combat.spec.ts`, new `test('CAP-01/02: …')`. Invocation `pnpm e2e`. Discovery is
    `playwright.config.ts` `testDir`. Check the new test is listed with `pnpm exec playwright test --list`.
  - Real mechanism: `e2e/fixtures.ts` launches the built app from `out/` through Playwright `_electron`, with
    an isolated temp userData (`mkdtempSync`) that is removed on teardown. Seed facts: the world is forged in
    the app (Roll, dark-fantasy, 42), then Brynn is created in the app. No stored fixtures.
  - The engine runs in the renderer. The reference fight runs the same installed engine in Node.
  - Freshness: `global-setup.ts` rebuilds `out/` and writes the build identity. Record it.
- Architecture: `grep -rn "from 'ruleswright" src/renderer/src --include=*.ts* | grep -v /engine/` is
  empty. `tests/lint/boundary.test.ts` passes.
- Custom Rule 2: no arithmetic on library numbers except the display `turn + 1`, which has a comment.

## State Update
Report: CA-01..04 evidence (test names, commits), the DF-CX-1 revision used, any design rows you could
not honor (Rule 1 → a request back to Designer, not an improvisation), the build identity, and the
negative-control result. List the new test ids for PROGRAM-CONFIG Conventions. Arch delta for M06 (two
exports), M09 (re-exports + selector), M15 (`order.tsx`).
