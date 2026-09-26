# M07 — persistence (`src/renderer/src/persistence/`)

**Status:** realized (SESSION-01 c3 `5fcf552`), exactly as planned. **Imports (mechanical, non-test):** M01 only (`../../../shared/ipc-contract`).

## Public API (realized)
- `client.ts`:
  - `type Persistence = RuleswrightApi`
  - `getPersistence(): Persistence` — `window.ruleswright` in the app, or whatever tests bound via `setPersistence`.
  - `setPersistence(p: Persistence): void` — test DI. Promise wrappers only; no logic.

## Change history
- v1-shell plan: created (planned).
- SESSION-01 c3 (`5fcf552`): realized as planned.