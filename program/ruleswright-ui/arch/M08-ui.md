# M08 — ui (`src/renderer/src/ui/`)

**Status:** planned (SESSION-02). **Imports:** React, M04 CSS. **Never** stores or engine.

## Components (design.md Component Inventory)
`Button` (primary/ghost/danger), `Input`, `Select`, `Kicker`, `Chip` (default/accent/danger), `Panel`/`Panel2`, `ProgressBar`, `StatNumeral`, `ThemeCard`, `ArtifactRow`, `CombatantRow`, `EventRow` (roll/mutation/system), `ErrorCard` (renders `AppError`; `data-testid="error-card"`), `OkCard` (`ok-card`), `EmptyState` well, `WorldPlate`, `DeterminismStrip` (pass/fail/unavailable), `SnapshotCard`, `ConfirmDialog`, `JsonView` (raw-JSON toggle body). Styles in `ui.css` consuming tokens only.

`ErrorCard` accepts the `AppError` shape by structural type (props interface declared in ui, compatible with `engine/errors.ts`), so ui does not import engine.

## Change history
- v1-shell plan: created (planned).
