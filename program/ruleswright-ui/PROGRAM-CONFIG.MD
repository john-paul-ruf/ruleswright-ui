# PROGRAM-CONFIG — Ruleswright (UI)

> Authoritative program configuration. Created by Planner on the first planning run
> (feature `v1-shell`, 2026-09-26) from the Author handoff (`specs/*.md`, `mocks/*.html`).
> Stack and module structure are parsed from `specs/architecture.md`, not re-derived.
> File name is `PROGRAM-CONFIG.MD` (tracked name; macOS is case-insensitive).
> Reconciled to realized state by Archivist at v1-shell close (`7fac292`; code `98a14e3`, engine `01dcf77`) and again at
> combat-complete close (`2b55a04`; code `c22426a`, engine `dadf461`), folding in the loot-inventory deltas (LI-D8) that had no final pass.

## Program

| Field | Value |
|---|---|
| Name (P_NAME) | Ruleswright (UI) |
| Slug (P_SLUG) | `ruleswright-ui` |
| Program root | `program/ruleswright-ui/` (repo-relative) |
| Repo | `/Users/the.phoenix/WebstormProjects/ruleswright-ui` (branch `main`) |
| Intent | Electron desktop shell for the headless Ruleswright engine: roll a world, browse it, play one character, fight stepwise with provenanced events, see determinism. |
| Sibling engine | `../Ruleswright` — consumed as a library, **never edited** from this program |

## Stack (from `specs/architecture.md` → Stack Decision)

| Layer | Choice | Pinned at plan time (npm, 2026-09-26) |
|---|---|---|
| Language | TypeScript strict | `typescript@5.6.3` (same as engine) |
| Shell | Electron | `electron@^33` (33.4.11 resolves) |
| Build | electron-vite (main/preload/renderer) | `electron-vite@^2` (2.3.0; peer `vite ^4 \|\| ^5`) + `vite@^5` (5.4.21) |
| Renderer | React 18 | `react@^18.3.1`, `react-dom@^18.3.1`, `@vitejs/plugin-react@^4` (4.7.0) |
| State | zustand | `zustand@^5` (5.0.15) |
| Styling | Plain token CSS (no Tailwind, no CSS-in-JS) | — |
| Fonts | Self-hosted woff2 via `@fontsource/*` packages bundled by Vite (Design Decision D-08) | `@fontsource/{cinzel,spectral,oswald,inter,jetbrains-mono}@^5.3.0` (all OFL-1.1) |
| Engine | `"ruleswright": "file:../Ruleswright"` (built `dist/`, v0.1.0) | plan time `664d24f`; v1-shell `01dcf77`; loot-inventory `f792f49` (dist from `8b802b7`); **current: combat-complete `dadf461`** (clean, `check:engine` ok at `c22426a`) |
| Persistence | Plain JSON files under Electron `userData/` (`specs/database.md` store contract) | — |
| Packaging | electron-builder (dmg first-class) | `electron-builder@^25` (25.1.8) |
| Unit tests | vitest, **node environment** | `vitest@^2` (2.1.9) |
| E2E tests | Playwright `_electron` against the built app | `@playwright/test@^1.63` |
| Lint | ESLint 8 legacy config (`.eslintrc.cjs`, mirrors engine repo) + `@typescript-eslint@^8` | `eslint@8.57.1` |
| Package manager | pnpm | resolved `/Users/the.phoenix/.nvm/versions/node/v24.20.0/bin/pnpm` = 10.15.0 |
| Node (tooling) | Node | resolved `/Users/the.phoenix/.nvm/versions/node/v24.20.0/bin/node` = v24.20.0 (Electron 33 embeds its own Node for main) |

**Toolchain facts every session must honor** (verified at plan time, see STATE Verification Baseline):
- **pnpm 10 blocks dependency build scripts by default.** `package.json` must carry
  `"pnpm": { "onlyBuiltDependencies": ["electron", "esbuild"] }` or the Electron binary never downloads.
- **pnpm does not run `pre*`/`post*` scripts.** Chain guards explicitly (`"dev": "node scripts/check-engine.mjs && electron-vite dev"`).
- **Do not set `"type": "module"`** in this repo's `package.json`: the sandboxed preload must be CommonJS (electron-vite default). ESM-only helper scripts use `.mjs`.
- `file:` dependencies are **copied** by pnpm: rebuilding `../Ruleswright` requires `pnpm install` here. `scripts/check-engine.mjs` detects staleness by byte-comparing dist entry files.

## Architecture

- **Pattern:** Electron main = I/O host (fs, dialogs, window, CSP); renderer = engine + UI (engine is pure, bundled in-process); preload = allowlisted typed bridge; `shared` = pure types/constants.
- **Dependency flow (realized):** `shared ← main`, `shared ← preload`, `shared ← persistence ← store → engine → ruleswright/*`, `views → store + ui + (moods read-only) → shell/EmptyState (M12–M15)`, cross-view `M13 → M15` and `M14 ↔ M15` (shared `combat/log`, `fight/records`), `shell → store/ui + store/worlds (read) + ui + moods`, `ui → styles(tokens)`. `shared` imports nothing (only `ipc-contract.ts` → `./model` within the module). `main` never imports `ruleswright`. Known module-level cycle (recorded, not file-level): the views import `shell/EmptyState` and the shell imports the views — M12–M15 ↔ M10, plus the runtime import M12 → M06 (`views/world` imports `engine/determinism.rerunUnavailableReason`).
- **DI:** stores take their persistence client through a module setter (`setPersistence`) so node tests can bind an in-process bridge over the real main handlers.
- **State:** zustand stores `worlds`, `ui`, `character`, `combat` (+ `determinism` for the FR-14 rerun state — D-11).
- **Entry points:** `src/main/index.ts` (main), `src/preload/index.ts` (bridge), `src/renderer/index.html` → `src/renderer/src/main.tsx` → `App.tsx`.

## Module Registry

IDs are stable and never reused. Ordered leaves first. Edge rule: realized edges are derived
mechanically from non-test imports (strip `import type` and fully-`type` named clauses before
resolving value imports; resolve `export … from` **as** a runtime import). A symbol grep never
settles a module edge. Per-module detail: `program/ruleswright-ui/arch/Mxx-*.md`.

| ID | Module | Path | Owns | Imports From | Key Files |
|----|--------|------|------|--------------|-----------|
| M01 | shared | `src/shared/` | IPC channel table, request/response + error envelope, DB record shapes (realization of `specs/database.md`) | — | `ipc-contract.ts`, `model.ts` |
| M02 | main | `src/main/` | window lifecycle, CSP/network block, fs store, dialogs, IPC handlers | M01 [R] | `index.ts`, `window.ts`, `ipc.ts`, `storage.ts`, `dialogs.ts` |
| M03 | preload | `src/preload/` | the single `contextBridge` object `window.ruleswright` | M01 [R] | `index.ts` |
| M04 | styles | `src/renderer/src/styles/` | tokens (mood tables verbatim), base CSS, font faces | — | `tokens.css`, `base.css`, `fonts.css` |
| M05 | moods | `src/renderer/src/moods/` | theme id → mood id; `data-mood` applier | — | `map.ts` |
| M06 | engine | `src/renderer/src/engine/` | **only** importer of `ruleswright/*`; typed wrappers + error shaping | `ruleswright` (ext), M01 [R] | `errors.ts`, `compiler.ts`, `schema.ts`, `runtime.ts`, `determinism.ts`, `combat.ts`, `combat-profile.ts`, `replay.ts` |
| M07 | persistence | `src/renderer/src/persistence/` | typed client over `window.ruleswright` | M01 [R] | `client.ts` |
| M08 | ui | `src/renderer/src/ui/` | design-system components (tokens only; no store/engine imports) | M04 [R] (CSS) | `*.tsx`, `ui.css` |
| M09 | store | `src/renderer/src/store/` | all app state + transitions | M06 [R], M07 [R], M01 [R] | `worlds.ts`, `ui.ts`, `determinism.ts`, `character.ts`, `combat.ts` |
| M10 | shell | `src/renderer/src/shell/` | top bar, nav, surface routing, empty states | M09 [R], M08 [R], M05 [R] | `Shell.tsx`, `TopBar.tsx`, `EmptyState.tsx` |
| M11 | views/roll | `src/renderer/src/views/roll/` | Roll surface (FR-2/3/5) | M09 [R], M08 [R], M05 [R], M06 [R] (types), M01 [R] (types) | `index.tsx`, `ForgeForm.tsx`, `ImportPanel.tsx`, `WorldList.tsx`, `glyphs.ts` |
| M12 | views/world | `src/renderer/src/views/world/` | World surface (FR-4, FR-14 rerun) | M09 [R], M08 [R], M10 [R], M06 [R] (runtime + types), M01 [R] (types) | `index.tsx`, `sections.ts`, `details.tsx` |
| M13 | views/character | `src/renderer/src/views/character/` | Character surface (FR-6–10, FR-18 inventory & loot) | M09 [R], M08 [R], M10 [R], M15 [R] (`summaryOf`), M06 [R] (types) | `index.tsx`, `sheet.tsx`, `side.tsx`, `inventory.tsx` |
| M14 | views/fight | `src/renderer/src/views/fight/` | Fight assembly (FR-11: grid when the pack declares `spatial`, theater-of-mind otherwise; placement, ally spawns, threat-budget assembly) + FR-14 replay/resume entry | M09 [R], M08 [R], M10 [R], M15 [R] (LogRow), M01 [R] (types) | `index.tsx`, `determinism.tsx`, `records.tsx` |
| M15 | views/combat | `src/renderer/src/views/combat/` | Combat loop, board + host repositioning, turn order/initiative, economy detail, event log (FR-11/12/13) | M09 [R], M08 [R], M10 [R], M14 [R] (RecordsPanel) | `index.tsx`, `board.tsx`, `order.tsx`, `controls.tsx`, `log.tsx` |
| M16 | app | `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx` | renderer bootstrap, CSP meta, top-level wiring | M10 [R], M09 [R], M05 [R], M04 [R] | — |
| M17 | tests | `tests/`, `e2e/` | vitest unit/handler/gate tests; Playwright Electron journeys + fixtures | all [R] (each spec imports the modules it exercises) | `tests/support/in-process-bridge.ts`, `e2e/fixtures.ts` |
| M18 | build | `package.json`, `pnpm-lock.yaml`, `electron.vite.config.ts`, `tsconfig*.json`, `.eslintrc.cjs`, `vitest.config.ts`, `playwright.config.ts`, `electron-builder.yml`, `scripts/`, `.gitignore` | toolchain + gates | — | `scripts/check-engine.mjs` |

**Module-level cycles (realized, recorded — not file-level cycles):**
- M12–M15 ↔ M10: the views import `shell/EmptyState` and the shell imports the views (`Shell.tsx` imports all five views; each `views/*/index.tsx` imports `EmptyState` for its no-world branch). No file imports a file that imports it back (`EmptyState.tsx` imports only `store/ui` + `ui`).
- M14 ↔ M15: `fight/records.tsx` imports `combat/log` (`LogRow`) and `combat/index.tsx` imports `fight/records` (`RecordsPanel`, `RECORD_NAME_INPUT`); M13 → M15 (`character/inventory.tsx` imports `combat/log` `summaryOf`, loot-inventory S02) joins the same shared file. No file-level cycle.
- M12 → M06 (runtime import): `views/world/index.tsx` imports `engine/determinism.rerunUnavailableReason` directly — a views→engine edge not in the plan-time dependency flow (views → store + ui). Mechanical consequence of `rerunUnavailableReason` being a pure function with no store dependency; recorded here rather than erased.

Edge rule: realized edges are derived mechanically from non-test imports (strip `import type`,
resolve `export … from` as runtime imports). A symbol grep never settles a module edge.

## Conventions

- **Naming:** files kebab-case (`combat-profile.ts`), React components PascalCase in `.tsx`, stores `useXxxStore`.
- **Engine boundary:** views/stores never import `ruleswright`; they import engine wrappers and the engine's re-exported types (lint-enforced, Custom Rule 1, incl. type imports).
- **Error handling:** every failure becomes an `AppError` (`engine/errors.ts`):
  `library` (the library's `ErrorCard[]`, verbatim) · `host` (IPC `IpcError`) · `unexpected` (operation + message).
  Rendered only via the `ErrorCard` component. Never paraphrase library messages. Stores never throw to views.
- **Logging:** main logs skipped/corrupt documents with `console.warn` (no telemetry, no files).
- **Docs:** TSDoc on exported functions naming the FR they serve.
- **Test ids (stable UI contract for e2e; each rendered at most once per screen):**
  `nav-roll`, `nav-world`, `nav-character`, `nav-fight` · `active-world-name`, `active-world-seed` ·
  `roll-theme-<themeId>`, `roll-seed`, `roll-seed-randomize`, `roll-knob-<knobId>`, `roll-forge`, `roll-error` ·
  `world-row` (one per world; contains name text), `world-open`, `world-rename`, `world-delete`, `world-corrupt` ·
  `import-paste`, `import-paste-submit`, `import-file`, `export-pack` ·
  `empty-state` · `error-card` · `ok-card` · `rerun-same-seed` ·
  `char-*`, `fight-*`, `combat-*` defined by their sessions; the full realized lists live in `arch/M13-character.md`,
  `arch/M14-fight.md`, `arch/M15-combat.md`. Changing an existing id requires updating every spec that uses it in the same checkpoint.
  - loot-inventory (Character inventory): `char-inventory`, `char-inventory-empty`, `char-item-<id>`, `char-item-qty-<id>`,
    `char-drop-amount-<id>`, `char-drop-<id>`, `char-grant-item`, `char-grant-qty`, `char-grant`, `char-loot-table`,
    `char-loot-seed`, `char-loot-seed-randomize`, `char-loot`, `char-loot-empty`, `char-inventory-error`, `char-inventory-event-<n>`.
  - combat-complete (Fight): `fight-placement`, `fight-spatial-def`, `fight-place-<id>` (+ `-x`/`-y`), `fight-token-<id>`,
    `fight-place-reset`; `fight-ally-spawn-<instanceId>`, `fight-ally-spawn-remove-<instanceId>`, `fight-add-ally` (+ `-submit`);
    `fight-assemble-budget`, `fight-assemble-seed` (+ `-randomize`), `fight-assemble`, `fight-encounter-summary`,
    `fight-assemble-error`; `fight-resume-<name>`, `fight-resume-status` (`data-status` diverged|unavailable|error).
  - combat-complete (Combat): `combat-board`, `combat-spatial-def`, `combat-token-<id>`, `combat-distance-<id>`,
    `combat-move` (+ `-banner`/`-apply`/`-cancel`/`-unavailable`); `combat-order`, `combat-order-<id>`,
    `combat-order-position`, `combat-initiative`, `combat-action-detail`, `combat-spatial-caption`; `combat-ledger-<id>`,
    `combat-pools-<id>`, `combat-bound-<id>`, `combat-conditions-<id>`.
  - Changed text: `fight-spatial` prints `grid · seed 42` on worlds forged on engine `dadf461` (`theater-of-mind · …` only
    for packs without `spatial`).
- **Moods (CA-10):** four moods — `fantasy` ✦ (`dark-fantasy`), `urban` ▲ (`zombie-urban`), `wild` ✻ (`wyldwood`),
  `archive` ◆ (default: unknown theme, imported pack, null). A new mood needs its token block, `MoodId`/`MoodLike`,
  `MOOD_GLYPH`, and a design.md column the contrast gate reads.
- **FR-11 spatial (requirements `24601f4`):** grid when the pack declares `spatial`, theater-of-mind otherwise. Grid adds
  pre-combat placement (default layout CX-D9: allies `x=0`, enemies `x=1`, `y` = index in own side), a board, verbatim
  reach/validity rejections, and host repositioning between declarations (only at `awaiting-declare` with no open offer,
  CX-D10); threat-budget assembly uses an explicit numeric seed. Positions are host input; the library judges them.
- **E2E reference fights (combat-complete):** specs that recompute a fight with the real library read the placement from
  `fight-place-<id>` (`data-x`/`data-y`) before Begin and pass those positions to the reference `startCombat`; never
  hardcode positions the store's default layout produces.
- **Plan-time engine probes drive the real host loop (minted combat-complete, Principle 4: 3 cycles).** A plan premise
  about engine behavior (who acts first, when slots/pools refill, which rejections a path can reach, whether an acceptance
  path is reachable in the UI at all) is established by a bounded probe that drives `declare → step → respond` on the
  installed engine, not by reading `.d.ts` declarations; record the observed facts (first actor, refill point) in the
  session prompt. Bound every probe loop (`step()` at `awaiting-declare` never ends a turn). Where a c0 probe could disprove
  the only planned proof path, the plan names the replacement proof up front. Evidence: v1-shell (E1 c3 host-loop probe),
  loot-inventory PC-1 (`loot-grants-nothing` unreachable), combat-complete (wight acts first; refill on first Step;
  unbounded planning probe exhausted the heap).
- **`store/combat.ts` is the combat spine (minted combat-complete, Principle 4: in-cycle axis, 6 of 6 sessions).** Every
  Fight/Combat capability so far routed through it, so sessions that lease it cannot run concurrently (CX-D8, effective
  concurrency 1). A plan touching combat states that serialization cost up front, or schedules a split (e.g. assembly /
  live fight / records, keeping the view-facing re-exports stable) as its own first session. Views keep reaching the
  engine only through its re-exports.

## Verification Commands (realized — created by SESSION-01; see STATE Verification Baseline)

| Command | Effective invocation | Scope |
|---|---|---|
| `pnpm check:engine` | `node scripts/check-engine.mjs` | sibling dist exists; installed copy version + bytes match |
| `pnpm typecheck` | `tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.test.json` | all TS |
| `pnpm lint` | `eslint . --ext .ts,.tsx` | incl. engine boundary + hygiene rules |
| `pnpm test` | `vitest run` (node env; `tests/**/*.test.ts`) | unit, handlers, gate self-tests |
| `pnpm build` | `node scripts/check-engine.mjs && electron-vite build` → `out/` | bundles |
| `pnpm e2e` | `playwright test` (globalSetup rebuilds `out/` and records build identity) | Electron journeys |
| `pnpm verify` | `pnpm check:engine && pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` | full gate |

`pnpm e2e` writes `out/` and `test-results/`: exclusive resource **`e2e:out`**.

## Git

- Branch `main`; author John Paul Ruf <john.paul.ruf@gmail.com>.
- Commit subject: `<feature> SESSION-NN: checkpoint N — <what>` (e.g. `combat-complete SESSION-06: checkpoint 3 — …`); Orchestrator records `<feature>: STATE — …` and `<feature>: arch deltas from SESSION-NN (…)`.
- Coder commits with an explicit pathspec = the session's `Owns`. Never `git add -A`, never `reset --hard`, never force-push.
- `program/ruleswright-ui/prompts/` is **gitignored** (demiurge lines in `.gitignore`); committing a file there requires `git add -f -- <path>`. No session edits the demiurge lines of `.gitignore`.

## Session Defaults

- 2–6 checkpoints; every checkpoint builds and passes `pnpm typecheck && pnpm lint && pnpm test` (+ `pnpm e2e` where the checkpoint says so).
- Sessions never write `specs/`, `mocks/`, `STATE.md`, `MASTER.md`, `PROGRAM-CONFIG.MD`, or `arch/`.

## Custom Rules

1. **Only `src/renderer/src/engine/**` may import `ruleswright` or `ruleswright/*`** (lint-enforced, incl. type imports).
2. **Zero rules math in the UI.** Every number shown or used in play comes from a library call or pack data verbatim.
3. **No nondeterminism into the engine.** The only randomness is user-initiated seed picks via `crypto.getRandomValues`: the Roll view world seed, the Character inventory loot seed `⟳` (`char-loot-seed-randomize`), and the Fight threat-assembly seed `⟳ Randomize` (`fight-assemble-seed-randomize`). Every seed is an explicit number shown to the user before it is used. `Math.random`, `eval`, `new Function`, `Date.now` inside `engine/` are lint errors.
4. **Pack gate = `new Runtime(parsed)`** (the library's full validator with its real DSL checker). Bare `validatePack(json)` without a checker emits ~60 deferred E-FORM-01 cards on a valid pack and must not be used as a gate (CA-02).
5. **Pack bytes are sacred:** `pack.json` is written verbatim and never re-serialized on read (CA-01).
6. **Tokens only:** no component hardcodes a color, font, or radius. Mood = `data-mood` on `<html>`.
7. **Renderer never sends or receives filesystem paths.** Ids and names only.
8. **`src/shared/model.ts` document shapes are DB-owned.** Any change to `Settings`/`WorldDoc`/`SnapshotDoc`/`FightDoc` is a DB re-entry. Current FightDoc (database `af47822`, additive, `formatVersion` 1): `start {ally, enemies, positions?, allySpawns?}` (`positions` iff the pack is spatial; `allySpawns` only when non-empty, ally order after the character), `script` ops `declare | respond | step | move` (`move` carries the complete positions map), `events`. Inventory lives inside the verbatim snapshot envelope (no DB change).
9. **Never fabricate a fact to stay green:** unavailable is not passed; missing params render unavailable.

## Author Sources

| Source | Path | Current revision (combat-complete close) | Used by |
|---|---|---|---|
| Idea / requirements | `specs/idea.md`, `specs/requirements.md` | requirements `24601f4` (loot-inventory `d0fe434` before it) | all |
| Design source (UI-Coder Rule 1) | `specs/design.md` + `mocks/*.html` (`design-language.html` = token spec) | design + `mocks/{combat,fight}.html` `9cb5aa8`; `wild` mood + inventory mock `3069b23` | every view/ui/styles session |
| Architecture | `specs/architecture.md` | unchanged since v1-shell | all |
| Data source | `specs/database.md` (store contract; no `src/migrations/` by design) | `af47822` | any session touching M01/M02 storage |

Known design housekeeping carried to the next Designer re-entry (Author-owned): `mocks/roll.html` shows `🎲 Randomize` (app: `⟳`); the design.md "Mock mood switch" row lists three chips; `mocks/{combat,fight}.html` have no `wild` mood block; the design does not cover the `unavailable`/`error` Resume refusals.

Author artifacts are never in any session's `Owns`. Changes route through Author re-entry (`program-agents/AUTHOR.md`).