# SESSION-03 — A dedicated mood for `wyldwood` (FR-15, Q2 = b)

> **Program:** Ruleswright (UI)
> **Feature:** loot-inventory
> **Modules:** M04 M05 M08 M11 M17 (M18 only if a new font family is designed)
> **Depends on:** SESSION-01 (serial owner of `tests/moods/map.test.ts` and `e2e/shell.spec.ts`); AUTHOR-DESIGN-LI part B (fourth mood committed in `specs/design.md` + `mocks/design-language.html`). AUTHOR-SPEC-LI item 2 (FR-15 "each bundled theme") should be committed too; it's text only, so its absence is recorded but doesn't block.
> **Concurrent with:** SESSION-02 (disjoint Owns, checked path by path: 02 writes `views/character/character.css`, never `styles/**`; `e2e:out` serializes e2e steps)
> **Owns:** `src/renderer/src/styles/tokens.css`, `src/renderer/src/styles/base.css`, `src/renderer/src/styles/fonts.css`, `src/renderer/src/moods/map.ts`, `src/renderer/src/ui/types.ts`, `src/renderer/src/views/roll/glyphs.ts`, `tests/moods/map.test.ts`, `tests/styles/contrast.test.ts`, `e2e/shell.spec.ts`, `package.json`, `pnpm-lock.yaml`
> **Reads:** `program/ruleswright-ui/specs/{design,requirements}.md`, `program/ruleswright-ui/mocks/design-language.html`, `src/renderer/src/ui/ThemeCard.tsx`, `src/renderer/src/views/roll/WorldList.tsx`, `src/renderer/src/shell/Shell.tsx`
> **Resources:** `e2e:out`
> **Checkpoints:** 2 (+ c0 recheck)

`package.json` / `pnpm-lock.yaml` are leased **only** for the case where design.md names a font family that isn't bundled (see c1). If it doesn't, they must appear in no commit. Nothing else owns them in this run.

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M04 | styles | `tokens.css` `[data-mood='…']` blocks (l.41–90); `base.css` atmosphere rules (l.106–138); `fonts.css` (12 `@fontsource` imports) | new mood block, atmosphere, any font weight |
| M05 | moods | `map.ts` `MoodId`, `MOOD_BY_THEME` | `wyldwood → <id>` |
| M08 | ui | `types.ts` `MoodLike` (l.25) | the union grows with `MoodId` (ThemeCard renders swatches through `data-mood`, so no component change) |
| M11 | views/roll | `glyphs.ts` `MOOD_GLYPH: Record<MoodId,string>` | typecheck forces the new glyph |
| M17 | tests | `contrast.test.ts` `MOODS` (l.12) and `designTable()` (l.15–31), which reads columns by position `[, token, fantasy, urban, archive]` | fourth column |

## Context
Today `design.md` maps unknown themes to `archive`, and SESSION-01 proved `wyldwood` renders archive. The human approved a dedicated mood (Q2 (b)). Designer commits its id, token column, fonts, glyph, and optional atmosphere. This session implements exactly that, with **no invented values** (Custom Rule 6: token values come from the design table verbatim).

## Capabilities
- **CAP-03 (integration owner, c2):** forge `wyldwood` → `moodForTheme` → `data-mood="<id>"` on `<html>` → the new tokens apply (computed `--accent` equals the design value) → the mood's display face is loaded → AA contrast holds. The picker's `roll-theme-wyldwood` card and its world row show the new glyph and swatches.
- Required facts: the mood id, 12 token values, fonts, glyph, and atmosphere from committed `design.md` (producer AUTHOR-DESIGN-LI; planned). `meta.theme` (ready, v1-shell).

## Contract Agreements
- **CA-10 (amended; provisional against AUTHOR-DESIGN-LI's commit):** `dark-fantasy→fantasy`, `zombie-urban→urban`, `wyldwood→<id>`, else/null/`__proto__`→`archive`. Recheck the id against the committed text at c0.
- **Contrast invariant (design.md Legibility):** for the new column, `--dim` on `--surface` ≥ 4.5 and `--accent-ink` on `--accent` ≥ 4.5. The tokens.css block must equal the design table for all 12 tokens (the existing gate's per-mood equality check, extended).

## Files to Create/Modify
| File | Action | What Changes |
|---|---|---|
| `styles/tokens.css` | modify | new `[data-mood='<id>']` block: `--font-display`, `--font-reading`, and the 12 tokens verbatim from design.md, in the same selector form as the existing three |
| `styles/base.css` | modify | the mood's atmosphere rule, only if design.md specifies one (a `color-mix` of `--accent`, matching the fantasy/urban rules) |
| `styles/fonts.css` | modify | only if design.md uses a weight/family not already imported (e.g. `@fontsource/spectral/600.css`) |
| `package.json`, `pnpm-lock.yaml` | modify | only if design.md names a family with no installed `@fontsource/*` package: `pnpm add @fontsource/<family>@^5` (OFL-licensed, D-08) |
| `moods/map.ts` | modify | `MoodId` += `'<id>'`; `MOOD_BY_THEME['wyldwood'] = '<id>'`; update the doc comment |
| `ui/types.ts` | modify | `MoodLike` += `'<id>'` |
| `views/roll/glyphs.ts` | modify | `MOOD_GLYPH['<id>']` per design.md; update the comment |
| `tests/moods/map.test.ts` | modify | SESSION-01's `['wyldwood','archive']` → `['wyldwood','<id>']` |
| `tests/styles/contrast.test.ts` | modify | `MOODS` += `'<id>'`; `designTable()` reads the 5th column (after archive) into the new mood; existing assertions iterate the 4 moods |
| `e2e/shell.spec.ts` | modify | SESSION-01's wyldwood leg: `data-mood` `archive` → `<id>`, plus the computed `--accent` = the design value and the display face loaded (same `document.fonts` pattern as the Cinzel check). Change no other assertion |

## Implementation

### Checkpoint 0 — recheck (no commit)
1. Read committed `design.md` and `design-language.html`; record the Designer revision, mood id, 12 values, fonts, glyph, and atmosphere. Confirm the new mood is the column **after** archive. If it isn't, adapt `designTable()` to the actual header order by name, not position.
2. Confirm SESSION-01 is done: `grep -n wyldwood tests/moods/map.test.ts e2e/shell.spec.ts` hits.
3. Fonts: compare the design's faces and weights with `fonts.css` and `node_modules/@fontsource/`. Record which Files-table conditional rows apply.
4. `pnpm test` green at start (expect SESSION-01's count).
5. If the design isn't committed, return `blocked`.

### Checkpoint 1 — tokens, mapping, contrast gate
Apply the rows above. Any new font dependency: `pnpm add`, then `pnpm check:engine` is still ok.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` exit 0; the contrast suite covers 4 moods, and the new pairs are ≥ 4.5 (quote the values). Pathspec = the files actually changed (subset of Owns).

### Checkpoint 2 — e2e
Edit `e2e/shell.spec.ts` as above.
**Commit when:** `pnpm verify` exit 0 holding `e2e:out`; quote `test-results/build-identity.json` (head, dirty false).

## Verification
- `pnpm verify` holding `e2e:out` (H-1); GUI required (H-2).
- Custom Rule 6: `grep -rnE "#[0-9a-fA-F]{3,8}\b" src/renderer/src --include=*.tsx` shows no new hit; the contrast suite's no-hardcoded-hex check stays green.
- FR-17: fonts still come from `'self'` (the shell e2e's `expectOnlyLocalRequests` stays green).
- CAP-03 and CA-10 in the handoff.

## State Update
Mood id, Designer revision checked, contrast ratios measured, font rows applied (or none), commits, and the new CA-10 mapping (for PROGRAM-CONFIG / arch M05).
