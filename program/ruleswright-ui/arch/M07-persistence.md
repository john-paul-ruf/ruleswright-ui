# M07 — persistence (`src/renderer/src/persistence/`)

**Status:** planned (SESSION-01 c3). **Imports:** M01 only.

## Public API
- `client.ts`: `type Persistence = RuleswrightApi`; `getPersistence(): Persistence` (defaults to `window.ruleswright`); `setPersistence(p: Persistence): void` (test DI). Promise wrappers only; no logic.

## Change history
- v1-shell plan: created (planned).


<!-- v1-shell SESSION-01 -->
## Realized — v1-shell SESSION-01

### M07 persistence — realized (`5fcf552`) as planned.
