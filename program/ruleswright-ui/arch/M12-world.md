# M12 — views/world (`src/renderer/src/views/world/`) — shared registry detail

**Note:** this file is the per-module detail page for M12. The combined views file `M11-M15-views.md` covers all five surfaces; this copy exists because PROGRAM-CONFIG's registry links here for M12. See `M11-M15-views.md` § M12 for the authoritative realized description. Summary of the realized state (SESSION-04 c2 `d310755`, proofs c3 `6af0163`):

- Files: `index.tsx` (`WorldView`), `sections.ts` (`sectionsOf(pack): WorldSection[]` — bespoke classes/spells/bestiary/tables, then every other content subsection and top-level section except `content`/`progression` as raw), `details.tsx` (`EntryDetail`, `entryMeta`, `entryTitle`, `verbatim`), `world.css`.
- Imports: store (`worlds`, `determinism`, `ui`), ui, shell `EmptyState`, engine `determinism.rerunUnavailableReason` (runtime) + `engine/schema` types.
- Test ids: `world-nav-<sectionId>`, `world-entry-<entryId>`, `world-detail`, `world-raw-toggle`, `world-raw`, `world-determinism` (strip; `data-state` idle|unavailable|fail), `world-determinism-pointer`, `world-export-status`; plus the shared `rerun-same-seed`, `export-pack`, `ok-card` (pass strip), `error-card` (library error / export error), `empty-state`.

## Change history
- v1-shell plan: created (planned; S02 placeholder renders the correct empty state so routing is complete before the surface lands).
- SESSION-04 c2 (`d310755`): realized as above.