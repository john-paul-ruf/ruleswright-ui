# M10 — shell (`src/renderer/src/shell/`)

**Status:** planned (SESSION-02). **Imports:** M09 (`ui`, `worlds` read), M08, M05.

- Top bar: glyph, `active-world-name`, `active-world-seed` chip (`theme · seed`, or `imported · seed unknown`), nav (`nav-roll|world|character|fight`, accent underline on active).
- Surface routing via `store/ui`; `combat` is reached from Fight.
- Empty states (design.md table): no world → Roll; world but no character → Character; never fought → Fight.
- Mood effect: subscribes to active world theme → `applyMood(moodForTheme(theme))`.

## Change history
- v1-shell plan: created (planned).


<!-- v1-shell SESSION-02 -->
## Realized — v1-shell SESSION-02

### M10 shell — realized (`ae1c762`)
- `Shell.tsx` (TopBar + surface switch + mood effect), `TopBar.tsx`, `EmptyState.tsx` (`kind: 'no-world'|'no-character'|'no-fights'`), `shell.css`.
- **New edge:** M12–M15 views → M10 (`views/*/index.tsx` import `shell/EmptyState`). Shell imports the views, so M10 ↔ M12–M15 is a module-level cycle without a file-level cycle (`EmptyState.tsx` imports only store/ui + ui).
