# M08 — ui (`src/renderer/src/ui/`)

**Status:** realized (SESSION-02 c2 `6b9e658`; DF-1 components consumed by SESSION-06). **Imports (mechanical, non-test):** `react`, `react-dom` (portal), intra-module `./Button`/`./Text`/`./types`, and its own `./ui.css`. **Never** stores, engine or moods — shapes are structural copies (`ui/types.ts`), so `engine/errors.ts` `AppError` is assignable to `AppErrorLike` (CA-05, proven by typecheck).

## Components (realized — design.md Component Inventory)
Barrel `ui/index.ts` (imports `ui.css`). Files → exports:
- `Button.tsx` — Button (forwardRef; `variant: primary|ghost|danger`, `size: m|s`)
- `Field.tsx` — Input, Select (`invalid`), Field (kicker-labelled wrapper; the label element makes the whole block the control's label)
- `Text.tsx` — Kicker, Chip (`tone: default|accent|danger`), StatNumeral (`size: l|m`), ProgressBar
- `Panel.tsx` — Panel, Panel2 (`kicker`, `aside`, `as`, `pad: s|m|l|none`)
- `ErrorCard.tsx` — ErrorCard (`data-testid="error-card"`, `data-kind`), OkCard (`data-testid="ok-card"`)
- `ThemeCard.tsx` — ThemeCard (`mood: MoodLike` → swatches/glyph in that mood's tokens via `data-mood` subtree)
- `Rows.tsx` — ArtifactRow, CombatantRow, RecordRow (B-3 fight record row: name, outcome chip, meta, `rng` slot, actions)
- `EventRow.tsx` — EventRow (`variant: roll|mutation|system`, `why` slot, `rolls` slot)
- `Plates.tsx` — WorldPlate, SnapshotCard (pack-identity line, B-3/D-20), DeterminismStrip (pass/fail/unavailable/idle, `data-state`), EmptyWell
- `Combat.tsx` — TriggerOffer, CombatOverBanner (DF-1; slot-based: title/triggerId/provenance/controls/actions and kicker/headline/provenance/actions)
- `ConfirmDialog.tsx` — ConfirmDialog (portal to body, focus trap, Esc, focus restore)
- `JsonView.tsx` — JsonView
- `types.ts` — AppErrorLike, ErrorCardLike, MoodLike (structural; ui imports no engine/moods)
- Styles in `ui.css` consuming tokens only (`--accent`, `--surface`, `--text-…`, `--radius-…`); no hex literals (contrast-gate asserted).

## Change history
- v1-shell plan: created (planned).
- SESSION-02 c2 (`6b9e658`): realized as above.
- SESSION-02 followUp: ConfirmDialog, DeterminismStrip, EventRow, CombatantRow, RecordRow, SnapshotCard, TriggerOffer, CombatOverBanner, JsonView, ArtifactRow had no consumer at c2; all were consumed and seen rendered by S03–S06 (ConfirmDialog by S03 rename-delete + S05 snapshot-delete; DeterminismStrip/EventRow/RecordRow/SnapshotCard by S04–S06; TriggerOffer/CombatOverBanner by S06; JsonView/ArtifactRow by S04). `OkCard` remains exported with no consumer outside its own module (the World pass strip carries the `ok-card` test id on `DeterminismStrip` instead).

<!-- loot-inventory SESSION-03 -->
### loot-inventory SESSION-03 delta — fourth mood `wild`
- **M08 ui** (`types.ts`): `MoodLike` gains `'wild'`. ThemeCard needs no change; it previews through `data-mood`.
