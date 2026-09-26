# Archivist Log — Ruleswright (UI)

One dated entry per Archivist run, append-only across cycles.

---

## 2026-09-26 — final pass (feature `v1-shell`, repo `7fac292`, code `98a14e3`, engine `01dcf77`, installed dist `01dcf77`)

**Reconciled.** Rewrote `arch/` (14 files) from appended "Realized — v1-shell SESSION-NN" deltas over planned text into one coherent realized-state description: every planned-API section now reads as realized, with session commits cited (M01 `77d8e63`, M02 `ca1d972`+`77d8e63`, M04 `f03f38d`+`6b9e658`, M05 `ae1c762`, M06 `5fcf552`/`5fcf552`+`33481cf`/`c38946e`/`18119f9`/`0ad13c8`/`33481cf`/`d310755`/`98a14e3`, M07 `5fcf552`, M08 `6b9e658`, M09 `5fcf552`/`ae1c762`/`511ec2b`/`18119f9`/`8ac723d`/`98a14e3`, M10 `ae1c762`/`db3ac6d`, M11 split `511ec2b`/`bfc2497`/`920f64a`/`e99a2e4`, M12 `d310755`, M13 `0ad13c8`, M14/M15 `269c0e8`/`bf33cd3`, M16 `ae1c762`, M17 `43f660c`/`17d435e`, M18 `ca1d972`/`dcac5c4`). Collapsed two fragments that said the same thing twice (the views' store + engine edges are stated once, in the flow line and the cycle note, not duplicated). Resolved the "known upcoming blockers on first occurrence" channel: the M12–M15 ↔ M10 module cycle, the M12 → M06 runtime import (`views/world` imports `engine/determinism.rerunUnavailableReason`), and the M01/M02 `FightDoc` B-2 envelope (`FightRecordMeta` list projection = envelope + outcome + `rng` + `round` + `eventCount`) are described as present in the tree, verified mechanically — not as future work.

**Module registry.** PROGRAM-CONFIG edges flipped from `[D]` to `[R]` by non-test import inspection only: every product edge is realized. Two module-level cycles recorded verbatim (M12–M15 ↔ M10 EmptyState; M12 → M06 `rerunUnavailableReason`), with the mechanical consequence noted — `rerunUnavailableReason` is a pure function, so the direct import exists rather than being routed through a store. Nothing invented; every edge cell checked against the import statements of every non-test file in the module.

**Module edges verified mechanically** (value imports, `import type` stripped, `export … from` treated as a runtime import — per the edge rule; grep settled nothing):
- M02 → M01: value imports (`MAX_DOC_BYTES`, `MAX_RECORD_NAME`, `MAX_WORLD_NAME`, `RECORD_NAME_PATTERN`, `IPC`, `RuleswrightApi` type) plus type-only `Channel`/`IpcError`/`IpcRequest`/`IpcResponse`/`WindowBounds`/`Settings` clauses from `../shared/*`. Realized edge.
- M03 → M01: value import `IPC` + type `RuleswrightApi`. Realized edge.
- M06 → M01 (errors.ts, schema.ts): type-only (`IpcError`/`IpcErrorCode`; `PackIdentity`) — `import type` stripped before resolution; the module still depends on the shared envelope types, so the edge is real but carries no runtime value import.
- M06 → `ruleswright` (ext): namespace + named value imports (`compiler`, `runtime`, `schema` surfaces). External, in every engine file.
- M07 → M01: value import `IPC`. Realized edge.
- M09 → M06/M07/M01: value imports `forge`/`listThemes` (engine), `getPersistence`/`setPersistence` (persistence client), shared caps/types; type-only members stripped before resolution. Realized edges.
- M10 → M09/M08/M05: value imports `useUiStore`/`Surface`, `useWorldsStore`, `Button`/`EmptyWell`/`Chip`, `applyMood`/`moodForTheme`. Read-only on `worlds`. Realized edges. `EmptyState.tsx` imports no views.
- M11 → M09/M08/M05/M06(types)/M01(types): value imports `useWorldsStore`, `Kicker`/`Chip`/`Panel`/`Button`/`Input`/`ErrorCard`/`ConfirmDialog`/`ThemeCard`, `moodForTheme` + `MOOD_GLYPH` (moods), `KnobSpec`/`ThemeInfo` types. Realized edges.
- M12 → M09/M08/M10/M06(runtime import — `rerunUnavailableReason`)/M01(types): `views/world/index.tsx` imports `rerunUnavailableReason` directly. Realized edge; recorded as the second module-level cycle (not file-level).
- M13 → M09/M08/M10/M06(types): engine types only. Realized edges.
- M14 ↔ M15: `views/fight/records.tsx` → `views/combat/log` (`LogRow`) and `views/combat/index.tsx` → `views/fight/records` (`RecordsPanel`, `RECORD_NAME_INPUT`). Realized cycle (module-level, no file-level cycle).
- M15 → M09/M08/M10/M14 (`RecordsPanel`)/M01(types). Realized edges.
- M16 → M10/M09/M05/M04 (CSS). Realized edges.
- M17 → all (each spec imports the modules it exercises; e2e computes expected values with the real library — import restriction exempted by config). Realized.
- M18: imports nothing (leaf).

**No contradictions found** between the realized arch text, PROGRAM-CONFIG, or either STATE (feature `program/ruleswright-ui/prompts/v1-shell/STATE.md`, run folder `prompts/v1-shell/STATE.md`). Every realized claim above was re-checked against the tree after writing (same discipline Coder applies to a diff before committing): nothing Archivist wrote contradicts the next line down in the same file, or a sibling file.

**Module registry integrity check.** Verified every `[R]` cell names a dependency that exists in the tree at `98a14e3` (grep-level): M01 `ipc-contract.ts`/`model.ts`; M02 all five files; M03 `index.ts`; M04 `tokens.css`/`base.css`/`fonts.css`; M05 `map.ts`; M06 all eight files; M07 `client.ts`; M08 `ui.css` + twelve `.tsx` files; M09 all five files; M10 all four files; M11–M15 all listed files. No dead entries, no stale paths.

**Module registry — symbol-vs-edge discipline.** One standing evidence pair is preserved rather than collapsed: the M17 boundary self-test (`tests/lint/boundary.test.ts`) proves Custom Rules 1 and 3 by linting synthetic code — a symbol-consumer question answered by grep would not settle the module edges the lint rule enforces, so the arch text keeps the two claims separate (module edges from imports; symbol consumption from grep) exactly as the framework requires.

**`PROGRAM-CONFIG.MD` — conventions.** No conventions minted this pass: the two-axis test (three distinct program cycles, or three distinct sessions/recoveries/checkpoint returns within one cycle) was applied honestly and neither axis is crossed by what this feature actually needed. The candidate observations below are recorded as `tracking` in `CLEANUP-LEDGER.md` (create-if-absent discipline; nothing was deleted, rewritten or auto-cleaned — Archivist scouts, it does not sweep).

**Standing recommendations** (full open backlog carried forward — every open observation, not this pass's additions):

| id               | pattern                   | cycles | in-cycle instances | first seen | status                              |
| ---------------- | ------------------------- | -----: | -----------------: | ---------- | ----------------------------------- |
| 785c75731e5e9eb6 | Plan-time probes should drive the actual host loop (declare → step → respond to the end), not read type declarations | 1 | 1 | v1-shell | open |
| 97641a906d3c0447 | A session that changes navigation should lease every spec that navigates through that surface | 1 | 1 | v1-shell | open |
| 0d4dfe658858963c | Human visual review of screenshot sets owed as final-report debt | 1 | 1 | v1-shell | open |
| cc00aa16e2f5e7f5 | electron-builder output dir (release/) absent from .gitignore | 1 | 1 | v1-shell | open |

**Proposed for the framework** (no threshold on this channel; recorded at first observation, cycle count traveling with it as supporting evidence):

- *Adopted upstream in this cycle (commit `3a6deaf` — the framework-relayed granularity corrections):* E1's c3 lease plan-time probe (drive one fight to `combat-over` at c0, not read type declarations) and S03's c4 spec-collision correction (a session changing navigation leases the specs that navigate through that surface). Both are already reflected in the realized role text; recorded here as adopted, with the commit cited.
- New, 1 cycle / 1 in-cycle instance, first seen `v1-shell`: **"Unprepare" has no engine API** — the S05 surface omitted the control rather than improvising UI math; the honest-unavailable rendering (Custom Rule 9) was the correct disposition, and the gap is recorded in the engine program's follow-up ledger (`editDistance` hint bug, attack tables vs AC 11+, conditions not carried into combat, Unprepare/next-level-XP). Recommendation: when the engine program adds these APIs, the UI re-entry is a planned Coder lease, not a renderer checkpoint-0 investigation — a known gap assigned only to a renderer's checkpoint-0 investigation is unresolved planning work.

**Adoption check before carrying forward:** both open items above were re-read against the current tree this pass; neither has been adopted since the prior pass (the engine follow-ups are named, owned, and planned — not implemented in this feature). The standing-ledger table above is the single source of truth for the backlog; a reader needs no upward walk through prior entries.

**Not inspected** (stated, not implied reconciled): `../Ruleswright` engine internals beyond the public barrel consumed here; `mocks/*.html` beyond grep-level; provider/quota configuration. The engine repo's own `.program/` belongs to a different program and was not reconciled.

**Log entry:** this dated entry appended to `ARCHIVIST-LOG.md` (created this pass).