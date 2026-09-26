# M10 — shell (`src/renderer/src/shell/`)

**Status:** realized (SESSION-02 c3 `ae1c762`, proof c4 `db3ac6d`). **Imports (mechanical, non-test):** `react`, M09 (`../store/ui`, `../store/worlds` — read-only), M08 (`../ui`), M05 (`../moods/map`), intra-module `./TopBar`, and its own `./shell.css`. `EmptyState.tsx` imports only `store/ui` + `ui` — no views (the module cycle below has no file-level cycle).

- Top bar (`TopBar.tsx`): glyph, `active-world-name`, `active-world-seed` chip (`theme · seed`, or `imported · seed unknown`), nav (`nav-roll|world|character|fight` from `NAV`, accent underline on active via `aria-current`). Combat is reached from Fight, so Fight stays marked while fighting.
- Surface routing via `store/ui` (`Shell.tsx`: `VIEWS[surface]` switch under `<main data-surface>`).
- Empty states (`EmptyState.tsx`, design.md Empty States table): `kind: 'no-world'|'no-character'|'no-fights'` — centered EmptyWell, one-line why (design.md message split at its dash into title + line), one primary CTA that routes back (`no-world → roll`, `no-character → character`, `no-fights → fight`), `data-testid="empty-state" data-kind`.
- Mood effect (`Shell.tsx`): subscribes to active world theme → `applyMood(moodForTheme(theme))` on change (CA-10).

## Change history
- v1-shell plan: created (planned).
- SESSION-02 c3 (`ae1c762`): realized — `Shell.tsx` (TopBar + surface switch + mood effect), `TopBar.tsx`, `EmptyState.tsx` (`kind: 'no-world'|'no-character'|'no-fights'`), `shell.css`.
- **New edge:** M12–M15 views → M10 (`views/*/index.tsx` import `shell/EmptyState`). Shell imports the views, so M10 ↔ M12–M15 is a module-level cycle without a file-level cycle (`EmptyState.tsx` imports only store/ui + ui).
- SESSION-02 followUp: the placeholder Character branch keeps the `EmptyState` no-world CTA pointing to Roll (design.md table); S04–S06 keep the `EmptyState` no-world branch when replacing placeholder bodies.