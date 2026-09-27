# M11–M15 — views (`src/renderer/src/views/{roll,world,character,fight,combat}/`)

**Imports (mechanical, non-test):** `react`, M09 (`store/*` actions + state), M08 (`../ui`), M05 (`moods/map` — read-only: M11 glyph/mood of theme cards and rows), M01 types (`shared/model` — M11 rows, M14 `FightRecordMeta`), M10 (`shell/EmptyState`, M12–M15), and each surface's own CSS. **Never** `ruleswright` (Custom Rule 1). Mocks are the structural contract. Views reach the engine only through stores.

| ID | Surface | Mock | Session | Entry (realized) |
|---|---|---|---|---|
| M11 | roll | `mocks/roll.html` | S01 (minimal) → S03 (crafted) | `views/roll/index.tsx` exporting `RollView` |
| M12 | world | `mocks/world.html` | S02 (placeholder) → S04 | `views/world/index.tsx` exporting `WorldView` |
| M13 | character | `mocks/character.html` | S02 (placeholder) → S05 | `views/character/index.tsx` exporting `CharacterView` |
| M14 | fight | `mocks/fight.html` | S02 (placeholder) → S06 | `views/fight/index.tsx` exporting `FightView` |
| M15 | combat | `mocks/combat.html` | S02 (placeholder) → S06 | `views/combat/index.tsx` exporting `CombatView` |

## M11 — views/roll (S01 minimal `b9f3518`; S03 split `bfc2497`, forge→World c4 `e99a2e4`)
- SESSION-01 c4: minimal Roll view (theme cards, seed, forge) proven by `e2e/journey.spec.ts`.
- SESSION-03 split files: `index.tsx` (RollView: header + sections), `WorldList.tsx` (rows, inline rename, delete `ConfirmDialog`, corrupt chip + verdict card, skipped lines), `ImportPanel.tsx` (paste + file; success → `navigate('world')`), `ForgeForm.tsx` (ThemeCards, seed + randomize, knobs from `KnobSpec`; success → `navigate('world')`), `glyphs.ts` (mood → ✦/▲/◆), `roll.css` (tokens only). Imports `moods/map` read-only for glyph/mood of theme cards and rows; `engine/compiler` types (`KnobSpec`, `ThemeInfo`); `engine/errors` type `AppError`.
- Test ids: `nav-roll`, `roll-theme-<themeId>`, `roll-seed`, `roll-seed-randomize`, `roll-knob-<knobId>`, `roll-forge`, `roll-error` (knob-error wrapper around `ErrorCard`), `world-row` (one per world; contains name text), `world-open`, `world-rename`, `world-delete`, `world-corrupt`, `error-card`.
- Forge success calls `navigate('world')` (design.md flow 1); import success already did this since c2. Forge failure keeps entered parameters (`roll-seed`/`roll-knob-*` retain values, journey-asserted).

## M12 — views/world (S04 c2 `d310755`, proofs c3 `6af0163`)
- Files: `index.tsx` (`WorldView`), `sections.ts` (`sectionsOf(pack): WorldSection[]` — bespoke classes/spells/bestiary/tables first, then every other content subsection and top-level section except `content`/`progression` as raw), `details.tsx` (`EntryDetail`, `entryMeta`, `entryTitle`, `verbatim` — everything shown is pack data verbatim), `world.css`.
- Imports: store (`worlds`, `determinism`, `ui`), ui, shell `EmptyState`, engine `determinism.rerunUnavailableReason` (runtime) + `engine/schema` types.
- Test ids: `world-nav-<sectionId>`, `world-entry-<entryId>`, `world-detail`, `world-raw-toggle`, `world-raw`, `world-determinism` (strip; `data-state` idle|unavailable|fail), `world-determinism-pointer`, `world-export-status`; plus the shared `rerun-same-seed`, `export-pack`, `ok-card` (pass strip), `error-card` (library error / export error), `empty-state`.
- Deviation (recorded in S04 surprises): the subnav has one entry per raw section (prompt over mock); detail labels are pack keys; the mock's description prose / row-meta / copy+wrap chips data the pack lacks were omitted.

## M13 — views/character (S05 c3 `0ad13c8`, proof c4 `f128e78`)
- Files: `index.tsx` (`CharacterView`), `sheet.tsx` (Derived/PoolsSpells/Conditions/Progression panels), `side.tsx` (Snapshots/Create panels), `character.css`.
- Imports M09 (`character`, `worlds`, `ui`), M08, M10 `shell/EmptyState`, and engine **types** only.
- Test ids: `char-surface`, `char-name-display`, `char-hp`, `char-ac`, `char-saves`, `char-pool-<id>`, `char-spend-amount-<id>`, `char-spend-<id>`, `char-rest`,
  `char-slots`, `char-slot-<level>-<i>`, `char-spell-<id>`, `char-prepare-<id>`, `char-cast-<id>`, `char-spells-empty`, `char-condition-select`,
  `char-apply-condition`, `char-tick`, `char-condition-<id>`, `char-remove-<id>`, `char-restricted-actions`, `char-restricted-spells`,
  `char-class-<id>`, `char-xp`, `char-xp-amount`, `char-award-xp`, `char-set-level-<classId>`, `char-set-level`, `char-snapshot-name`,
  `char-snapshot-save`, `char-snapshot-load-<name>`, `char-snapshot-delete-<name>`, `char-snapshot-pack-<name>`, `char-name`, `char-race`,
  `char-class`, `char-level`, `char-create`.
- Beyond mock: per-pool Spend, single `char-tick`, snapshot-delete confirm, "Take to a fight →". Omitted (no pack/API support): Unprepare (no API), "next: 300" (rules math), "hp/ac descending" chip (no pack field). Untokenized: 340px / 72px.

## M14/M15 — views/fight, views/combat (SESSION-06 c3 `269c0e8`, c4 `bf33cd3`, c5 `98a14e3`)
- `views/fight/{index.tsx, determinism.tsx, records.tsx, fight.css}`; `views/combat/{index.tsx, log.tsx, controls.tsx, combat.css}`.
- `views/fight/records.tsx` imports `views/combat/log` (`LogRow`); `views/combat/index.tsx` imports `views/fight/records` (`RecordsPanel`, `RECORD_NAME_INPUT`). Views reach the engine only through `store/combat`.
- Test ids: `fight-surface, fight-spatial, fight-begin, fight-ally, fight-enemy-<instanceId>, fight-enemy-remove-<instanceId>, fight-add-enemy, fight-add-enemy-submit, fight-rerun, fight-determinism, fight-records, fight-record-<name>, fight-record-rng-<name>, fight-replay-<name>, fight-replay-status (data-status), fight-replay-event, fight-replay-divergence` · `combat-surface, combat-log, combat-event (data-type, data-round), combat-filter-round, combat-filter-type, combat-phase, combat-round, combat-active, combat-declare-select, combat-target-select, combat-declare, combat-step, combat-rejection, combat-offers, combat-trigger-<n>, combat-trigger-target-<n>, combat-trigger-take-<n>, combat-trigger-decline-<n>, combat-combatant-<id>, combat-over, combat-over-record, combat-back, combat-record-name, combat-record`.
- DF-1 provenance (`offerEvents`): each open offer maps to the latest `trigger:fired` event for its id (duplicate triggerIds `<actor>.<action>` repeat; the library answers the oldest open offer of a `triggerId` first). Declare/Step/offers disable while offers are open and after combat-over; the combat-over banner announces `combat:ended` payload `{winner, defeated}` verbatim; the log stays reviewable.

## Change history
- v1-shell plan: created (planned; S02 placeholders render the correct empty state so routing is complete before each surface lands).
- SESSION-01 c4 (`b9f3518`): minimal Roll view.
- SESSION-02 c3 (`ae1c762`): placeholders (world/character/fight/combat).
- SESSION-03 c2 (`bfc2497`) + c4 (`e99a2e4`): Roll crafted; forge success opens World.
- SESSION-04 c2 (`d310755`): World surface.
- SESSION-05 c3 (`0ad13c8`): Character crafted.
- SESSION-06 c3 (`269c0e8`), c4 (`bf33cd3`), c5 (`98a14e3`): Fight + Combat surfaces; keyboard round + 500-event log; records + replay.

<!-- loot-inventory SESSION-03 -->
### loot-inventory SESSION-03 delta — fourth mood `wild`
- **M11 views/roll** (`glyphs.ts`): `MOOD_GLYPH.wild = '✻'`.
