# M08 — ui (`src/renderer/src/ui/`)

**Status:** realized (v1-shell S02 c2 `6b9e658`; DF-1 components consumed by v1-shell S06; `MoodLike` `wild` loot-inventory S03 `5b5b84b`; `Board`/`TokenMark` combat-complete S02 c1 `58fb329`). **Imports (mechanical, non-test):** `react`, `react-dom` (portal), intra-module `./Button`/`./Text`/`./types`, and its own `./ui.css`. **Never** stores, engine or moods — shapes are structural copies (`ui/types.ts`), so `engine/errors.ts` `AppError` is assignable to `AppErrorLike` (CA-05, proven by typecheck).

## Components (realized — design.md Component Inventory)
Barrel `ui/index.ts` (imports `ui.css`). Files → exports:
- `Button.tsx` — Button (forwardRef; `variant: primary|ghost|danger`, `size: m|s`)
- `Field.tsx` — Input, Select (`invalid`), Field (kicker-labelled wrapper)
- `Text.tsx` — Kicker, Chip (`tone: default|accent|danger`), StatNumeral (`size: l|m`), ProgressBar
- `Panel.tsx` — Panel, Panel2 (`kicker`, `aside`, `as`, `pad: s|m|l|none`)
- `ErrorCard.tsx` — ErrorCard (`data-testid="error-card"`, `data-kind`), OkCard (`data-testid="ok-card"`; no consumer — see CLEANUP-LEDGER C2)
- `ThemeCard.tsx` — ThemeCard (`mood: MoodLike` → swatches/glyph in that mood's tokens via a `data-mood` subtree; works for `wild` with no change)
- `Rows.tsx` — ArtifactRow, CombatantRow, RecordRow (B-3 fight record row: name, outcome chip, meta, `rng` slot, actions)
- `EventRow.tsx` — EventRow (`variant: roll|mutation|system`, `why` slot, `rolls` slot)
- `Plates.tsx` — WorldPlate, SnapshotCard (pack-identity line), DeterminismStrip (pass/fail/unavailable/idle, `data-state`), EmptyWell
- `Combat.tsx`:
  - TriggerOffer, CombatOverBanner (DF-1; slot-based).
  - `Board({cols, rows, size: 'place'|'combat', pieces, label, editing?, focusRequest?, onPlace?, onHome?, onEscape?})` — the design's "Board token" row, shared by the Placement board (M14) and the Combat board (M15). A display-only viewport (CX-D12: nothing is clamped): origin `(min(0, min x), min(0, min y))`; pieces beyond the viewport are listed ("outside the viewport · A1 id (x, y)"); shared squares stack with a `×n` badge. When `editing`, tokens are focusable and movable (click a token then a square, or drag; arrows → `onPlace(id, x±1, y±1)`; Home → `onHome(id)`; Esc clears the selection → `onEscape()`); focus follows the moved token. Computes no reach or legality.
  - `BoardPiece {id, label ('A<n>'|'E<n>'), side ('ally'|'enemy'), x, y, title, active?, testId?}`; tokens carry `data-x`, `data-y`, `data-active`. `BoardProps` exported.
  - `TokenMark({label, side})` — 24px roster token (aria-hidden) for rows.
- `ConfirmDialog.tsx` — ConfirmDialog (portal to body, focus trap, Esc, focus restore)
- `JsonView.tsx` — JsonView
- `types.ts` — `AppErrorLike`, `ErrorCardLike`, `MoodLike = 'fantasy'|'urban'|'wild'|'archive'` (structural; ui imports no engine/moods)
- Styles in `ui.css`, tokens only; board geometry px (`.board-place` 36px squares / 28px tokens, `.board-combat` 28 / 22) come from design.md. Classes: `.board`, `.board-token(-ally|-enemy|.active|.selected|-mark)`, `.board-sq`, `.board-ax`, `.board-stack`, `.board-note`. No hex literals (contrast-gate asserted).

## Change history
- v1-shell S02 c2 (`6b9e658`): realized. All DF-1 components gained consumers in S03–S06 except `OkCard`.
- loot-inventory S03 (`5b5b84b`): `MoodLike` gains `'wild'`.
- combat-complete S02 c1 (`58fb329`): `Board`, `TokenMark`, `BoardPiece`, `BoardProps`. S03: no change (DF-CX-1 rows are combat-surface markup).
