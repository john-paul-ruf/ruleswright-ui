# M14 — views/fight (`src/renderer/src/views/fight/`)

**Status:** realized (v1-shell S06 c3 `269c0e8`, c5 `98a14e3`; combat-complete S02 c1 `58fb329`, S04 c3 `9324268`, S05 c2 `ba3d122`, S06 c2 `81c835c`). Shared view rules: `M11-M15-views.md`. FR-11 fight assembly (grid when the pack declares `spatial`, theater-of-mind otherwise; placement; ally spawns; threat-budget assembly) and FR-14 replay/resume entry.

- Files: `index.tsx` (`FightView` → `Fight`, `AlliesPanel`, `EnemiesPanel`, `AssembleByThreat`, `PlacementPanel`, `CoordInput` — all internal), `determinism.tsx` (`DeterminismPanel`), `records.tsx` (`RecordsPanel`, `RECORD_NAME_INPUT`, `ResumeRefusal`), `fight.css`.
- Imports (mechanical): store (`character`, `combat` — incl. re-exports `listSpawnable`, `spatialLabel`, `spatialOf`, `spawnProfile`, type `Position`; `determinism`, `ui`, `worlds`), ui (incl. `Board`, `TokenMark`), shell `EmptyState`, `shared/model` type `FightRecordMeta`, and M15 `combat/log` `LogRow` (runtime).

## Panels (realized)
- Header: `fight-spatial` chip — `grid · seed <n>` on packs with `spatial` (every world forged on engine `dadf461`), `theater-of-mind · seed <n>` otherwise.
- **Allies panel** (design "Ally spawn row", S04): the character row, then one row per ally spawn — statblock name, mono `spawnMonster · <instanceId> · ally side`, ghost − remove; a bestiary picker + "+ Add bestiary spawn" below the note.
- **Enemies panel**: add/remove rows, then **Assemble by threat** (S05, design "Assemble by threat row (CX)"): budget + seed number inputs (finite numbers only enable Assemble), `⟳ Randomize` (user-initiated `crypto.getRandomValues`, Custom Rule 3), primary Assemble, dim hint, verbatim summary `encounter · groups <id ×n, …|(none)> · threat · budget · seedUsed · heuristic`; `fight:assemble` errors render under the row, not in the header. The summary stays on refusal.
- **Placement board** (S02, design "Placement board"): rendered between the Allies/Enemies panels and Determinism only when `spatialOf(pack) !== null`. Reads store `positions`/`defaultPositions`, writes `setPosition`/`resetPositions`; integer x/y inputs per row (a non-integer gives a danger border and nothing moves); a 12 × 8 `Board size="place"` with editing. The side is `enemy` only for enemy-roster ids; names come from both rosters (ally spawns show as `A2…`).
- **Determinism** panel and **Records** panel: records list (name, outcome chip, rng), Replay (status + divergence), and **Resume** (S06, design "Resume action"): a ghost `btn-s` beside Replay only when `recordable` is false, i.e. on Fight → Records and never in Combat (planning finding F5). Success → `navigate('combat')`. Refusal → `ResumeRefusal` status line under the row's actions: `chip-danger` "resume refused" + mono detail "first divergence at event n", or the unavailable reason, or an `ErrorCard` for `error`. The mock's Resume note appears under the rng note, Fight only. CSS `.resume-status`, `.resume-status-error`. The design does not yet cover the `unavailable`/`error` refusal kinds (carried to the next Designer pass).

## Test ids
`fight-surface`, `fight-spatial`, `fight-begin`, `fight-ally`, `fight-enemy-<instanceId>`, `fight-enemy-remove-<instanceId>`, `fight-add-enemy`, `fight-add-enemy-submit`, `fight-ally-spawn-<instanceId>`, `fight-ally-spawn-remove-<instanceId>`, `fight-add-ally`, `fight-add-ally-submit`, `fight-assemble-budget`, `fight-assemble-seed`, `fight-assemble-seed-randomize`, `fight-assemble`, `fight-encounter-summary`, `fight-assemble-error`, `fight-placement`, `fight-spatial-def`, `fight-place-<id>` (row; `data-x`, `data-y`), `fight-place-<id>-x|y`, `fight-token-<id>`, `fight-place-reset`, `fight-rerun`, `fight-determinism`, `fight-records`, `fight-record-<name>`, `fight-record-rng-<name>`, `fight-replay-<name>`, `fight-replay-status` (`data-status`), `fight-replay-event`, `fight-replay-divergence`, `fight-resume-<name>`, `fight-resume-status` (`data-status` = diverged | unavailable | error). `records.tsx` also renders `combat-record-name` / `combat-record` when mounted inside Combat.

## Change history
- v1-shell S02 c3 placeholder; S06 c3/c5 realized (assembly, determinism, records + replay).
- combat-complete S02 c1 (`58fb329`): `PlacementPanel` (arch `c02ec42`).
- combat-complete S04 c3 (`9324268`): Allies panel ally spawn rows; placement names both rosters (arch `79fe4fc`).
- combat-complete S05 c2 (`ba3d122`): `AssembleByThreat` (arch `a19a902`).
- combat-complete S06 c2 (`81c835c`): Resume + refusal status line (arch `acfc1fa`).
