# Architecture — Ruleswright (UI)

Reads as input: `specs/requirements.md` (what) and `specs/design.md` (constraint — the design language, mood mechanism, and component inventory bind this architecture). `specs/idea.md` gives the vision: the first shell of a game on the headless Ruleswright engine.

**The one-line shape:** an Electron app whose *renderer* runs the Ruleswright engine in-process (it is pure, no I/O, CSP-safe) while the *main process* is the host that owns storage, dialogs, and the window — exactly the split the engine's "hosts own storage" contract assumes. The UI implements zero rules math and never injects nondeterminism.

---

## Stack Decision

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript ~5.6, strict | Same language and tsconfig discipline as the engine repo; the library ships `.d.ts`, so the whole API surface is typed at the call boundary. |
| Shell | Electron ^33 (current stable at scaffold) | Builder-set requirement (FR-1). Also the runtime the engine's determinism matrix already tests (Node/browser/Electron). |
| Renderer framework | React 18 + Vite 5, via **electron-vite ^2** | Data-dense app with many stateful panels; React's ecosystem and the builder's TS familiarity beat lighter options. electron-vite gives one toolchain for main/preload/renderer with sane defaults. |
| State management | **zustand ^5** | The app is "library call → returned state → render". Four small stores (worlds, character, combat, ui) with plain actions wrapping library calls beat Redux boilerplate and Context re-render plumbing. |
| Styling | Plain CSS — token files + component classes (**no Tailwind, no CSS-in-JS**) | The design system is token-based (`design.md` mood tables). A small hand-rolled layer that consumes `--tokens` maps 1:1 from `design-language.html`; a utility framework would fight the token contract. |
| Fonts | Self-hosted woff2, vendored into the app | FR-17/CSP forbid remote content — Cinzel, Spectral, Oswald, Inter, JetBrains Mono ship as local assets (all OFL). |
| Engine consumption | `ruleswright` as a **`file:` dependency** on the sibling repo's built `dist/` | The library's exports map (runtime/schema/compiler, dual ESM/CJS) is exactly what a bundler wants. No vendoring script, no fork. Dev prerequisite: `pnpm build` in `../Ruleswright` (checked by a predev guard). |
| Persistence | Plain JSON files under Electron `userData/` | No queries, no concurrency, tiny data, and snapshots must move freely to node scripts (FR-10) — files *are* the interchange format. Schema + validation rules formalized in the database phase. |
| IPC | Typed, allowlisted channels over `contextBridge` (no `ipcRenderer` exposure) | FR-17/NFR-Security: contextIsolation on, sandbox on, nodeIntegration off, every channel validated in main. |
| Packaging | electron-builder ^25 (dmg first-class; nsis/AppImage targets configured but not v1-gated) | macOS first-class, Windows/Linux unblocked (NFR-Platform). No auto-update in v1. |
| Test framework | vitest ^2 (node + jsdom environments) | Same runner the engine repo uses; covers store logic, main-process handlers, determinism checks, and the design-token contrast assertions. |
| Lint boundary | eslint `no-restricted-imports` rule | Mechanical enforcement of the one rule that keeps the architecture honest: only `engine/` may import `ruleswright/*`. |

## Alternatives Considered

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Shell | Electron | Tauri, plain web app | Electron was builder-set (FR-1) and matches the engine's tested determinism matrix. Tauri adds a Rust toolchain and a *different* system webview per platform — the "byte-identical" story is proven on Chromium, not on WKWebView/WebView2. Plain web would need a server or a browser tab, breaking the desktop-game identity. |
| Engine host process | Renderer (bundled) | Main process behind IPC, separate utility process | The engine is pure and does no I/O — nothing requires it to live behind IPC. Bundling it into the renderer makes `declare`/`step` synchronous local calls (< 100 ms NFR is trivial) and keeps the IPC surface minimal (files + dialogs only). Main stays a dumb, auditable I/O shell. |
| Engine dependency | `file:` dependency on `../Ruleswright` dist | Vendoring copied `dist/` into the repo, git submodule | Vendoring silently rots; submodules add workflow friction for a solo developer. A `file:` dep + predev guard ("dist/ exists and its version matches package.json") gives fresh-engine dev with an explicit failure mode. |
| UI framework | React | Svelte, vanilla TS + lit | Requirements weight (17 FRs, five surfaces, many list/detail/filter interactions) favors the largest ecosystem and the builder's TS tooling. Svelte would be leaner but is not worth a second paradigm for one app. Vanilla would hand-roll what React gives for free at this scale. |
| Styling | Token CSS | Tailwind, CSS-in-JS | Design binds: "components consume tokens only" (`design.md`). Tailwind CDN was a *mock* speed affordance (Designer's convention), not an app requirement. Token CSS compiles to nothing, works offline, and is diffable against `design-language.html`. |
| Persistence | JSON files | SQLite (better-sqlite3), IndexedDB | Nothing queries: worlds list, snapshots list, fight records — all small, all keyed by id. Files keep snapshots node-script-interchangeable (FR-10/FR-5 story), survive without native modules, and make "wipe everything" a directory delete. SQLite would buy joins we don't need and native-rebuild headaches. |
| Combat log rendering | Plain list, windowing if > ~1000 events | react-window/virtualizer up front | Design requires 500+ events to scroll smoothly — a flat list of lightweight rows handles that on Chromium; windowing is an optimization, not a dependency, and is noted as the fallback if measurements disagree. |

## Module Structure

```
ruleswright-ui/
├── package.json / electron.vite.config.ts / electron-builder.yml
├── src/
│   ├── main/                    — Electron main process (I/O shell)
│   │   ├── index.ts             — app entry: single window, lifecycle, CSP/session headers
│   │   ├── window.ts            — BrowserWindow creation, bounds restore, menu
│   │   ├── ipc.ts               — allowlisted channel table; validates every input
│   │   ├── storage.ts           — worlds / snapshots / fights file persistence
│   │   └── dialogs.ts           — native open/save dialogs
│   ├── preload/
│   │   └── index.ts             — contextBridge: typed `window.ruleswright` API, nothing else
│   ├── shared/
│   │   ├── ipc-contract.ts      — channel names + request/response types (single source of truth)
│   │   └── model.ts             — WorldMeta, SnapshotMeta, FightRecordMeta, Settings
│   └── renderer/
│       └── src/
│           ├── App.tsx          — wiring: nav router, mood application to <html data-mood>
│           ├── engine/          — THE ONLY importer of ruleswright/* surfaces
│           │   ├── compiler.ts  — generateCampaign, knobs, theme loader (typed wrappers)
│           │   ├── runtime.ts   — Runtime, character, pools, conditions, progression, combat
│           │   ├── schema.ts    — pack validation, error-card shaping
│           │   └── determinism.ts — rerun-same-seed byte compare; fight record/replay runner
│           ├── store/           — zustand stores (all app state transitions)
│           │   ├── worlds.ts    — world list, active world, import/export state
│           │   ├── character.ts — active character, pools, conditions, snapshots
│           │   ├── combat.ts    — combat state machine mirror, event log, records
│           │   └── ui.ts        — active surface, transient UI state
│           ├── persistence/     — typed client of preload bridge (renderer's only main-process access)
│           ├── moods/
│           │   └── map.ts       — theme id → mood id (fantasy/urban/archive) — the FR-15 mapping
│           ├── ui/              — design-system components; consume tokens only
│           ├── shell/           — top bar, nav, empty states, route switching
│           ├── views/
│           │   ├── roll/        — FR-2/3/5
│           │   ├── world/       — FR-4/14
│           │   ├── character/   — FR-6–10
│           │   ├── fight/       — FR-11/14
│           │   └── combat/      — FR-12/13
│           └── styles/
│               ├── tokens.css   — mood tables verbatim from design.md; `:root[data-mood]`
│               ├── base.css     — reset, type scale, focus rings, motion rules
│               └── fonts/       — vendored woff2 + @font-face
└── tests/                       — vitest: unit (stores/engine wrappers), main-process handlers, token contrast
```

Every path above is a leaseable unit: Planner should treat each directory under `renderer/src` and each `main` file-group as its own Module Registry entry.

## Module Contracts

### main (src/main)
- **Owns:** window lifecycle, session/CSP headers, the entire filesystem (worlds, snapshots, fights, settings), native dialogs, the allowlisted IPC surface.
- **Exports:** app entry (`index.ts`); nothing else is imported by anything outside `src/main`.
- **Depends on:** `src/shared`, Electron, Node `fs/promises`. Never imports `ruleswright/*` (main does zero rules).
- **Key types:** handlers matching `shared/ipc-contract.ts` exactly; `WorldMeta`, `Settings` from `shared`.

### preload (src/preload)
- **Owns:** the single `contextBridge.exposeInMainWorld('ruleswright', …)` object; validation that renderer calls carry no unserializable payloads.
- **Exports:** nothing importable; it *is* the bridge. Its surface is defined by and must mirror `shared/ipc-contract.ts`.
- **Depends on:** `src/shared`, Electron `contextBridge`/`ipcRenderer`. No logic, no engine, no fs.

### shared (src/shared)
- **Owns:** the IPC contract (channel names, request/response types, error envelope) and persistent-record shapes. Pure types + constants, no runtime behavior.
- **Depends on:** nothing. (Both `main` and `renderer` import it; it imports neither.)

### renderer/src/engine
- **Owns:** every `ruleswright/*` import in the codebase. Thin, typed, side-effect-free wrappers: generate + validate, create/progress/pools/conditions, combat start/declare/step, serialize/restore, the determinism byte-compare, and the record/replay runner.
- **Exports:** call-shaped functions returning plain data or library error objects — **never** library class instances leaking into stores beyond what the runtime API itself returns.
- **Depends on:** `ruleswright` (compiler, runtime, schema surfaces), `src/shared`.
- **Boundary rule (lint-enforced):** `ruleswright` imports outside `src/renderer/src/engine/` fail lint. Views and stores never touch the library directly.

### renderer/src/store
- **Owns:** all application state and its transitions — world list + active world, active character + pools/conditions/snapshots, combat state mirror + accumulated event log, UI surface selection. Actions call `engine` and put returned state in the store; failure paths put library errors in the store (rendered by `ui`'s error cards — FR-16).
- **Depends on:** `engine`, `persistence`, `moods` (for mood-on-world-open), `shared`.

### renderer/src/persistence
- **Owns:** the typed client over `window.ruleswright` (the preload bridge). Promise wrappers, nothing more.
- **Depends on:** `shared` only.

### renderer/src/moods
- **Owns:** theme id → mood id mapping (`dark-fantasy → fantasy`, `zombie-urban → urban`, unknown → `archive`) and the tiny applier that sets `data-mood` on the document root with the ≤ 300 ms crossfade/reduced-motion behavior.
- **Depends on:** nothing (pure data + one DOM write). Future themes fall to `archive` until mapped.

### renderer/src/ui
- **Owns:** every visual component in the design inventory (buttons, inputs, chips, panels, bars, rows, cards, empty states, world plate, determinism strip, snapshot cards). Consumes `--tokens` exclusively — zero hardcoded colors/fonts/radii (design binding).
- **Depends on:** React, `styles`. Does not import stores or engine (presentational + callbacks).

### renderer/src/shell
- **Owns:** the persistent top bar (glyph, world name, `theme · seed` chip, nav), active-surface state routing, empty-state routing (FR-1), and global error-card presentation points.
- **Depends on:** `store/ui`, `ui`.

### renderer/src/views/{roll,world,character,fight,combat}
- **Owns:** their surface's composition, exactly per `design.md`'s screen inventory and the mocks (mocks are the contract for structure and behavior).
- **Depends on:** `store` (actions + state), `ui`, `moods` (read-only, for mood-aware accents if needed). Never imports `ruleswright`.

### renderer/src/styles
- **Owns:** `tokens.css` (the mood tables from `design.md`, verbatim), base typography/focus/motion rules, vendored fonts.
- **Depends on:** nothing (pure CSS).

## Data Flow

1. **Forge (Roll):** view → `store/worlds.forge(params)` → `engine.generateCampaign(theme, seed, knobs)` → `engine.validatePack(pack)` → on success `persistence.saveWorld(meta, pack)` → main validates inputs, writes `worlds/<id>/world.json` + `pack.json`, returns `WorldMeta` → store sets active world → `moods.apply(themeId)` → World surface opens in the mapped mood.
2. **Play (Character):** view action → `store/character.*` → `engine.runtime` calls (`createCharacter`, `awardXp`, `castSpell`, `applyCondition`, …) → returned state in store → render. Rejections (library error objects) land in store → error card (FR-16).
3. **Fight:** `store/combat.start(spawns)` → `engine.startCombat` → subscribe `rt.events` → every event appended to the log store verbatim (`type`, `why.rule`, `why.rolls`) → `declare`/`step` are direct engine calls; state mirrors `fight.state`.
4. **Durable state:** save snapshot / record fight → `store` → `persistence` → main writes JSON; restore/open → main reads → renderer validates pack via `schema` surface → library `restoreCharacter`/`deserializeCombat` (pack identity checked by the library, mismatch → error card).
5. **Determinism check:** `engine.determinism` re-runs `generateCampaign` from stored theme/seed/knobs and byte-compares serialized packs → `okcard`/`errorcard` (FR-14). Replay re-applies a stored declaration sequence against a restored combat in the re-rolled pack and flags any event-stream divergence.

## Dependency Flow

```
                Electron
        main  ──────────▶  preload ──contextBridge──▶ renderer
      (fs, dialogs,         (allowlisted api)          │
       window, CSP)                                   │
            ▲                                         │
            └──────────── typed IPC (shared) ─────────┤
                                                      ▼
   shared ◀── shared ──▶ persistence ──▶ store ──▶ engine ──▶ ruleswright/*
     ▲                    (bridge client)   │                     (compiler / runtime / schema)
     │                                      │
     └────────────── moods ◀────────────────┤
                                            ▼
 views ──▶ store + ui ◀── styles (tokens only)          shell ──▶ store/ui
```

Hard rules: `ruleswright` imports live only in `engine/`; `main` imports no engine; `shared` imports nothing; `ui` consumes tokens, never raw values.

## IPC API (the whole surface — minimal by design)

| Channel | Direction | Purpose | Request | Response |
|---------|-----------|---------|---------|----------|
| `world:list` | R→M→R | Worlds at startup | — | `WorldMeta[]` |
| `world:open` | R→M→R | Read a world's pack | `worldId` | `{ meta, packJson }` |
| `world:save` | R→M→R | Persist a forged/imported world | `{ meta, packJson }` | `WorldMeta` |
| `world:rename` / `world:delete` | R→M→R | Metadata ops | `worldId`, `name?` | `WorldMeta` / `ok` |
| `settings:get` / `settings:set` | R→M→R | lastWorldId, window bounds | partial `Settings` | `Settings` |
| `snapshot:list` / `snapshot:save` / `snapshot:load` / `snapshot:delete` | R→M→R | Character snapshots (FR-10) | `worldId`, name, json | `SnapshotMeta[]` / `ok` / `{ meta, json }` |
| `fight:list` / `fight:save` / `fight:load` / `fight:delete` | R→M→R | Recorded fights for replay (FR-14) | `worldId`, name, record | mirrors snapshots |
| `pack:export` | R→M→R | Native save dialog + write | `worldId` | `ok` / `cancelled` |
| `pack:import` | R→M→R | Native open dialog + read | — | `packJson` / `cancelled` |

Main validates shape and size of every payload before touching disk; JSON.parse only (no eval anywhere — NFR-Security). All channels are request/response; no events cross the bridge.

## On-disk Layout (formalized in the database phase)

```
app.getPath('userData')/
├── settings.json                    — { lastWorldId, windowBounds }
├── worlds/<worldId>/
│   ├── world.json                   — { id, name, theme, seed, knobs, createdAt, schemaVersion }
│   └── pack.json                    — the generated pack, verbatim bytes as returned by the compiler
├── snapshots/<worldId>/<name>.json  — { meta, snapshot: <serializeCharacter output> }
└── fights/<worldId>/<name>.json     — { meta, combat: <serializeCombat output>, declarations: [...] }
```

World identity note (FR-5/FR-14): an imported pack whose generation parameters are unknown stores `theme/seed/knobs: null` and every same-seed affordance renders as explicitly unavailable — never faked.

## Security Posture

- **Authentication/Authorization:** none — single-user local desktop app; no accounts by design.
- **Renderer hardening:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; CSP delivered via session headers blocking all remote sources; no remote fonts, images, or scripts (fonts vendored).
- **IPC:** allowlisted channels only; every handler validates payload shape and clamps file paths under `userData`; dialogs return paths that main itself reads/writes.
- **Data at rest:** plain JSON in the OS user-data dir, no encryption (game data; nothing secret).
- **Data in transit:** none — the app performs zero network I/O (FR-17).
- **Parsing:** `JSON.parse` only; the engine's own validator is the pack gate; no dynamic code execution anywhere.

## Deployment Architecture

- **Target:** macOS first-class (dmg via electron-builder); Windows (nsis) and Linux (AppImage) configured and unblocked but not v1-gated.
- **Build:** `pnpm build` in `../Ruleswright` → `pnpm dev` (electron-vite dev with HMR) / `pnpm build` (main+preload+renderer bundles) → `pnpm dist` (electron-builder).
- **Runtime:** one Electron process pair — main (I/O shell, no engine) + renderer (engine + UI, bundled, no node). No server, no auto-update in v1.
- **Dev guard:** predev/prebuild check that `../Ruleswright/dist` exists and its version matches the dependency spec — fail loudly with instructions, never silently bundle a stale engine.

## Open Architectural Questions

- None blocking. Two deferred calls for later phases/owners: (1) combat-log virtualization threshold (> ~1000 events) — measured, not decided now; (2) packaging targets beyond dmg get real attention when v1 ships.