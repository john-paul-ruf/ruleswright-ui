# SESSION-02 — Grid UI: placement, combat board, reposition; e2e green again

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete (plan rev 2)
> **Modules:** M14, M15, M08 (only if the design names a new component), M17
> **Depends on:** SESSION-01; AUTHOR-SPEC-CX (Q4 part) + AUTHOR-DESIGN-CX (Q4 part) committed
> **Concurrent with:** —
> **Owns:** `src/renderer/src/views/fight/index.tsx`, `src/renderer/src/views/fight/fight.css`, `src/renderer/src/views/combat/index.tsx`, `src/renderer/src/views/combat/controls.tsx`, `src/renderer/src/views/combat/board.tsx`, `src/renderer/src/views/combat/combat.css`, `src/renderer/src/ui/Combat.tsx`, `src/renderer/src/ui/ui.css`, `src/renderer/src/ui/index.ts`, `e2e/combat.spec.ts`, `e2e/replay.spec.ts`
> **Reads:** `program/ruleswright-ui/specs/design.md`, `program/ruleswright-ui/mocks/fight.html`, `program/ruleswright-ui/mocks/combat.html`, `program/ruleswright-ui/specs/requirements.md` (FR-11, FR-14), `src/renderer/src/store/combat.ts`, `src/renderer/src/engine/combat.ts`, `src/renderer/src/views/combat/log.tsx`, `src/renderer/src/views/roll/ImportPanel.tsx`, `e2e/fixtures.ts`, `e2e/global-setup.ts`, `.program/probe-grid.mjs`
> **Resources:** `e2e:out` (checkpoints 2–3)
> **Checkpoints:** 3

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M14 | views/fight | `index.tsx`, `fight.css` | Placement board in Fight assembly |
| M15 | views/combat | `index.tsx`, `controls.tsx`, new `board.tsx`, `combat.css` | Combat board, spatial panel, reposition |
| M08 | ui | `Combat.tsx`, `ui.css`, `index.ts` | Only if AUTHOR-DESIGN-CX names a design-system component (e.g. a grid cell/token). Presentational, no store/engine imports |
| M17 | tests | `e2e/combat.spec.ts`, `e2e/replay.spec.ts` | Repair the known red window + the grid journey |

## Context
SESSION-01 gave the store `positions` (default layout), `setPosition`, `move`, and the engine `spatialOf`,
`distance`. Fight → Begin already works again on grid worlds with the default layout. This session makes
placement and position **visible and editable**, per the approved design (Rule 1: `design.md` + mocks are the
source; anything missing is a request back to Designer, not an improvisation). It also closes the e2e red
window: the existing combat and replay specs forge fresh (grid) worlds.

## Capabilities
- **CAP-06 Grid fight (integration owner: this session, checkpoint 3).** Entry: Roll (dark-fantasy, 42) →
  Character (Brynn) → Fight → placement board → Begin → Combat board → declare (reach/validity rejection
  card) → reposition → declare (hit) → … → record → restart → replay `complete`. Every position shown is
  `state.combatants[id].position` (the library's) or, before Begin, the store's `positions`.
- **Theater path (contribution).** An imported spatial-stripped pack → no board, chip `theater-of-mind`,
  Begin needs no placement.
- This is the first narrow journey of rev 2: the real Electron app, the real engine in the renderer, the real
  main storage and IPC, the real restart. Later sessions (panels, ally spawns, threat, resume) build on it.

## Contract Agreements
- **CA-12 (from S01).** The board shows positions only; it computes no reach, no adjacency, no legality. Shared
  squares render (stacked tokens); the viewport is display-only (design states its size). The pack's `spatial`
  section renders verbatim from `spatialOf(pack)` (model, every reach key/value, shapes).
- **CA-13 (from S01).** Reposition controls are enabled only when the store's `move` precondition holds
  (phase `awaiting-declare`, no open offers, spatial pack, not over). Mirror the store's state; do not
  re-implement the check (read `state.phase`, `pending.length`, `over`). A refused move shows the store
  `error` card. Label per design: "host repositioning — the engine has no movement rule".
- **CA-15 distance readout.** From the active combatant to each other combatant via `distance(rt, a, b)`
  (library `rt.spatial.distance`), shown as a number. No "in reach" judgement (EG-4: the engine's per-id reach
  lookup is private and keyed differently from the pack's reach table).
- Existing test ids and texts stay (`fight-*`, `combat-*` in PROGRAM-CONFIG Conventions and
  `arch/M15-combat.md`). `fight-spatial` text becomes `grid · seed 42` on new worlds (it prints
  `spatialLabel(pack)`); update the assertion, not the id.

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `views/fight/index.tsx` | modify | `PlacementPanel` on spatial packs: a cell/select per combatant, keyboard operable, `fight-place-<id>` (+ `data-x`, `data-y`), `fight-placement` container; hidden on theater packs |
| `views/fight/fight.css` | modify | Tokens-only |
| `views/combat/board.tsx` | create | `CombatBoard`: `combat-board`, tokens `combat-token-<id>` (`data-x`, `data-y`, `data-active`), `combat-spatial-def` (verbatim section), `combat-distance-<id>`; reposition controls `combat-move`, `combat-move-<id>` per design |
| `views/combat/index.tsx` | modify | Mount the board per design; the header chip keeps `spatialLabel` |
| `views/combat/controls.tsx` | modify | Only if the design moves anything into the Phase panel (e.g. the reposition entry point) |
| `views/combat/combat.css` | modify | Tokens-only |
| `ui/*` | modify only if the design names a component | — |
| `e2e/combat.spec.ts` | modify | Repair the three existing tests for grid worlds; add the CAP-06 grid journey |
| `e2e/replay.spec.ts` | modify | Repair CAP-10 on a grid world; add a recorded move to it |

## Implementation

### Checkpoint 0 — recheck (no commit)
Read the committed design rows and mocks for placement, board and reposition, and the FR-11 text. Absent →
`blocked`. Confirm the S01 store API (`positions`, `setPosition`, `move`, `error`) and engine exports
(`spatialOf`, `distance`) at HEAD. Run `pnpm exec playwright test --list` and record which tests exist; run
`pnpm e2e e2e/combat.spec.ts e2e/replay.spec.ts` under `e2e:out` once to record the red baseline (expected:
fights refused before S01; after S01 the default layout may already make some pass — record what you see).

### Checkpoint 1 — placement + board
Build `PlacementPanel` and `CombatBoard` per design. Keyboard: every placement/reposition control reachable
by Tab and operable by Enter/arrow keys or selects (NFR Accessibility). The existing keyboard test
(`e2e/combat.spec.ts` "keyboard only…") walks Declare → Step by Tab; place the board so that order holds, or
update that test's Tab count in checkpoint 3 with a comment.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass and `pnpm build` exits 0 (under `e2e:out`).

### Checkpoint 2 — reposition
Reposition controls call `store.move(fullPositionsMap)` (the store requires the complete map; build it from
the current `state.combatants[*].position` with the edited entry replaced — copying, not computing).
**Commit when:** as checkpoint 1.

### Checkpoint 3 — packaged proofs (closes the e2e red window)
Repair, preserving each test's assertions (only setup changes):
- `e2e/combat.spec.ts` CAP-09, keyboard, 500-event: the Node reference fight (`ref`) now passes the same
  positions the UI shows (read `data-x`/`data-y` from `fight-place-<id>` before Begin, never assume the default).
- `e2e/replay.spec.ts` CAP-10: same; the tamper leg unchanged.
New tests:
1. **CAP-06 grid journey** (`e2e/combat.spec.ts`): dark-fantasy · 42, Brynn vs 1 barrow-wight. Place the wight
   5 squares away. Begin. `combat-token-*` positions equal `ref.fight.state.combatants[*].position`.
   `combat-spatial-def` contains the pack's `spatial` JSON values verbatim (read from `worlds/<id>/pack.json`
   in userData). On Brynn's turn declare `cut-down` → `combat-rejection` text equals the reference fight's own
   `declare:rejected` payload message. Reposition Brynn adjacent (reference: `serializeCombat` →
   `deserializeCombat` with the same positions) → tokens moved, **no new `combat-event` rows**. Declare again
   → the log continues in lockstep with `ref`. `combat-distance-<id>` equals `ref.runtime.spatial.distance`.
   After a declare, `combat-move` is disabled.
2. **Record → restart → replay** (`e2e/replay.spec.ts`): the journey's fight recorded, `rw.restart()`,
   replay `complete`; the stored FightDoc has `start.positions` and one `move` entry equal to what the UI did.
3. **Theater world**: import (Roll → Import, paste) the dark-fantasy·42 pack with `spatial` removed → Fight
   shows no `fight-placement`, chip `theater-of-mind`, Begin works, no `combat-board`.
Negative control (not committed): change one expected token coordinate → fails; restore.
Run `pnpm verify` under `e2e:out`. Record `test-results/build-identity.json` (head, dirty).
**Commit when:** `pnpm verify` exits 0.

## Verification
- Gates per checkpoint as above; checkpoint 3 `pnpm verify` (full suite, `e2e:out` held).
- Integration proof CAP-06 (CA-12/13/14/15): `e2e/fixtures.ts` launches the built `out/` app through Playwright
  `_electron` with an isolated `mkdtempSync` userData (`RULESWRIGHT_USER_DATA`), removed at teardown;
  `rw.restart()` relaunches on the same dir. World and character are created in the app; the Node reference
  runs the same installed engine on the pack read from userData. Freshness: `e2e/global-setup.ts` rebuilds
  `out/` and writes the build identity — record it.
- Custom Rule 6 (tokens only), Rule 2 (no reach/adjacency math), Rule 7 (no paths over IPC).

## State Update
Report: design revisions used; any design row not honored (→ Designer request); CA-12/13/15 evidence; the
repaired tests and what changed in each (setup only); the new test ids; negative control; build identity.
Arch deltas: M14 `PlacementPanel`, M15 `board.tsx`. Close the e2e red window in STATE.
