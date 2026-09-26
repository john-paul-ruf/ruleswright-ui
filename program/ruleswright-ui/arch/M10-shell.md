# M10 — shell (`src/renderer/src/shell/`)

**Status:** planned (SESSION-02). **Imports:** M09 (`ui`, `worlds` read), M08, M05.

- Top bar: glyph, `active-world-name`, `active-world-seed` chip (`theme · seed`, or `imported · seed unknown`), nav (`nav-roll|world|character|fight`, accent underline on active).
- Surface routing via `store/ui`; `combat` is reached from Fight.
- Empty states (design.md table): no world → Roll; world but no character → Character; never fought → Fight.
- Mood effect: subscribes to active world theme → `applyMood(moodForTheme(theme))`.

## Change history
- v1-shell plan: created (planned).
