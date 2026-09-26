# M08 — ui (`src/renderer/src/ui/`)

**Status:** planned (SESSION-02). **Imports:** React, M04 CSS. **Never** stores or engine.

## Components (design.md Component Inventory)
`Button` (primary/ghost/danger), `Input`, `Select`, `Kicker`, `Chip` (default/accent/danger), `Panel`/`Panel2`, `ProgressBar`, `StatNumeral`, `ThemeCard`, `ArtifactRow`, `CombatantRow`, `EventRow` (roll/mutation/system), `ErrorCard` (renders `AppError`; `data-testid="error-card"`), `OkCard` (`ok-card`), `EmptyState` well, `WorldPlate`, `DeterminismStrip` (pass/fail/unavailable), `SnapshotCard`, `ConfirmDialog`, `JsonView` (raw-JSON toggle body). Styles in `ui.css` consuming tokens only.

`ErrorCard` accepts the `AppError` shape by structural type (props interface declared in ui, compatible with `engine/errors.ts`), so ui does not import engine.

## Change history
- v1-shell plan: created (planned).


<!-- v1-shell SESSION-02 -->
## Realized — v1-shell SESSION-02

### M08 ui — realized (`6b9e658`)
Barrel `ui/index.ts` (imports `ui.css`). Files → exports:
- `Button.tsx` Button (forwardRef; `variant: primary|ghost|danger`, `size: m|s`)
- `Field.tsx` Input, Select (`invalid`), Field (kicker label wrapper)
- `Text.tsx` Kicker, Chip (`tone: default|accent|danger`), StatNumeral (`size: l|m`), ProgressBar
- `Panel.tsx` Panel, Panel2 (`kicker`, `aside`, `as`, `pad: s|m|l|none`)
- `ErrorCard.tsx` ErrorCard (`data-testid="error-card"`, `data-kind`), OkCard (`data-testid="ok-card"`)
- `ThemeCard.tsx` ThemeCard (`mood: MoodLike` → swatches/glyph in that mood's tokens)
- `Rows.tsx` ArtifactRow, CombatantRow, RecordRow (B-3 fight record row)
- `EventRow.tsx` EventRow (`variant: roll|mutation|system`, `why` slot)
- `Plates.tsx` WorldPlate, SnapshotCard, DeterminismStrip, EmptyWell
- `Combat.tsx` TriggerOffer, CombatOverBanner (DF-1; slot-based)
- `ConfirmDialog.tsx` ConfirmDialog (portal to body, focus trap, Esc, focus restore)
- `JsonView.tsx` JsonView
- `types.ts` AppErrorLike, ErrorCardLike, MoodLike (structural; ui imports no engine/moods)
