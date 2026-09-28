# M12 — views/world (`src/renderer/src/views/world/`)

**Status:** realized (v1-shell S04 c2 `d310755`, proofs c3 `6af0163`). Shared view rules: `M11-M15-views.md`.

- Files: `index.tsx` (`WorldView`), `sections.ts` (`sectionsOf(pack): WorldSection[]` — bespoke classes/spells/bestiary/tables first, then every other content subsection and top-level section except `content`/`progression` as raw), `details.tsx` (`EntryDetail`, `entryMeta`, `entryTitle`, `verbatim` — everything shown is pack data verbatim), `world.css`.
- Imports (mechanical): store (`worlds`, `determinism`, `ui`), ui, shell `EmptyState`, **engine `determinism.rerunUnavailableReason` (runtime import — the recorded M12 → M06 edge)**, `engine/schema` types.
- Test ids: `world-nav-<sectionId>`, `world-entry-<entryId>`, `world-detail`, `world-raw-toggle`, `world-raw`, `world-determinism` (strip; `data-state` idle|unavailable|fail), `world-determinism-pointer`, `world-export-status`; shared `rerun-same-seed`, `export-pack`, `ok-card` (pass strip), `error-card`, `empty-state`.
- Deviation (v1-shell S04 surprises): one subnav entry per raw section (prompt over mock); detail labels are pack keys; mock prose/row-meta/copy chips the pack lacks are omitted.

## Change history
- v1-shell S02 c3 placeholder; S04 c2 (`d310755`) realized. No change in loot-inventory or combat-complete.
