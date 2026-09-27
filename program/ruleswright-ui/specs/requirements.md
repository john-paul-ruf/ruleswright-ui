# Requirements — Ruleswright (UI)

Derived from the approved `specs/idea.md`. The app is the game's first shell on the headless Ruleswright engine: set a theme, roll a pack, play in that world. Quests and campaign systems are engine v2 and explicitly out of scope here.

## Functional Requirements

### FR-1: App shell & navigation
- **User story:** As the developer-player, I want one desktop window with clear navigation between Roll, World, Character, and Fight, so that I always know where I am in the loop of playing in a generated world.
- **Acceptance criteria:**
  - [ ] The app opens as a native desktop window (Electron); no browser is involved.
  - [ ] All four surfaces — Roll, World (inspect), Character, Fight — are reachable from anywhere in one click.
  - [ ] The active world's name and seed are persistently visible in the shell.
  - [ ] Surfaces that require a loaded world show an explicit empty state with a path back to Roll.

### FR-2: Roll a world
- **User story:** As the developer-player, I want to pick a theme, set a seed and knobs, and generate a validated campaign pack, so that I can play in that world.
- **Acceptance criteria:**
  - [ ] The theme picker reflects the themes the library exposes (currently `dark-fantasy`, `zombie-urban`, `wyldwood`, loaded via the library's theme loader — not a hardcoded UI-side theme list).
  - [ ] Seed is a numeric input with an explicit "randomize" affordance (a user-initiated UI pick; the engine itself never receives UI-generated randomness).
  - [ ] Knob controls are generated from the theme's machine-readable knob declarations (`listThemeKnobs`), honoring each declaration's type and constraints.
  - [ ] Generate produces a pack via the compiler and validates it with the schema validator before the world opens.
  - [ ] Generation failure (`GenerationError`) or knob rejection (`KnobRejection`) surfaces inline without losing the entered parameters.
  - [ ] Generation completes well inside the library's 2 s budget (typically milliseconds); if slow, the UI shows activity rather than freezing.

### FR-3: World persistence & management
- **User story:** As the developer-player, I want my rolled worlds saved and listed at startup, so that I can return to any of them without regenerating.
- **Acceptance criteria:**
  - [ ] Each world is persisted (pack JSON plus its theme, seed, and knobs) under the app's user-data directory.
  - [ ] A world list at startup shows name / theme / seed; opening a world re-validates its pack and loads it into every surface.
  - [ ] Worlds get a default name (`theme · seed`) that the user can rename; renames persist.
  - [ ] Deleting a world removes its files after an explicit confirmation.
  - [ ] Multiple worlds coexist; the app remembers the last-opened world.

### FR-4: Browse the world
- **User story:** As the developer-player, I want readable views over a pack's artifacts, so that I can see what the compiler actually produced.
- **Acceptance criteria:**
  - [ ] Bespoke views for classes, spells, bestiary, and tables; each lists entries and opens a detail view.
  - [ ] Every view has a raw-JSON toggle; artifact types without a bespoke view fall back to raw JSON.
  - [ ] Views are driven entirely by pack data — the UI hardcodes no rule content.

### FR-5: Pack import & export
- **User story:** As the developer-player, I want to export a pack to a JSON file and import one from file or paste, so that packs move freely between node scripts and the app.
- **Acceptance criteria:**
  - [ ] Export writes the pack as JSON through a native save dialog.
  - [ ] Import accepts file or pasted JSON and runs schema validation before accepting; failure shows the library's error cards and loads nothing.
  - [ ] An imported pack becomes a world (FR-3). If its generation parameters (theme/seed/knobs) are unknown, it is fully playable but the same-seed affordances (FR-14) show as unavailable rather than pretending.

### FR-6: Create a character
- **User story:** As the developer-player, I want to create a character in the active world through the library's real creation path, so that the UI exercises exactly what a host app would.
- **Acceptance criteria:**
  - [ ] The create form offers name, race, and class(es) + level sourced from the pack (`Runtime.createCharacter`).
  - [ ] Derived stats (hp, ac, saves per the pack's own formulas) display after creation.
  - [ ] Invalid builds surface the library's build-validation errors — never a silent failure.
  - [ ] Exactly one active character per world (v1); creating a new character clears the previous one after confirmation.

### FR-7: Progression
- **User story:** As the developer-player, I want to award XP and set levels and watch derived stats recompute, so that I can exercise the pack's progression rules.
- **Acceptance criteria:**
  - [ ] Award-XP and set-level controls go through the library's progression API (`awardXp`, `levelSet`).
  - [ ] Level changes visibly recompute derived stats.
  - [ ] Invalid states surface `validateBuild` errors inline.

### FR-8: Pools & spells
- **User story:** As the developer-player, I want to prepare and cast spells and watch pools drain and replenish, so that I can exercise the pack's magic economy.
- **Acceptance criteria:**
  - [ ] Pool balances and the pack's pool vocabulary (`poolVocabulary`) are displayed; all spending flows through the library's pool API.
  - [ ] Prepare and cast use `prepareSpell` / `castSpell` against the pack's known spells (`knownSpells`); rejections (insufficient pool or slots) surface inline with the reason.
  - [ ] Rest (`rest`) replenishes pools and slots in one action.

### FR-9: Conditions
- **User story:** As the developer-player, I want to apply and remove conditions and see what they restrict, so that I can exercise the pack's condition rules.
- **Acceptance criteria:**
  - [ ] Conditions are applied/removed via the library's conditions API; the available list comes from the pack.
  - [ ] Active conditions display with their effects and restrictions (e.g., restricted ids surfaced via the library's restriction API).
  - [ ] Ticking conditions is an explicit user action.

### FR-10: Character snapshots
- **User story:** As the developer-player, I want to save and restore character snapshots, so that state survives restarts and can be handed to node scripts.
- **Acceptance criteria:**
  - [ ] Serialize (`serializeCharacter`) to a named snapshot stored on disk; snapshots list, load, and delete.
  - [ ] Restore (`restoreCharacter`) reproduces the state; restoring against a mismatched pack is rejected with a clear error (snapshot pack identity is checked).
  - [ ] Snapshots persist across app restarts.
  - [ ] Snapshot views show the snapshot's pack identity (id, schemaVersion, contentHash). *(Revised 2026-09-26, B-3: character snapshots carry no RNG state; RNG display moved to fight records, FR-14.)*

### FR-11: Start a fight
- **User story:** As the developer-player, I want to assemble a fight from my character plus bestiary spawns, so that I can enter combat in the world I rolled.
- **Acceptance criteria:**
  - [ ] Ally side is the active character; the enemy side is composed of bestiary spawns chosen from the pack (`bestiaryIds`, `spawnMonster`).
  - [ ] Either side may hold multiple bestiary-spawned combatants.
  - [ ] Theater-of-mind (`theaterOfMind`) is the spatial model for v1.
  - [ ] Starting combat (`startCombat`) renders initial state immediately: round, phase, active combatant.

### FR-12: Stepwise combat loop
- **User story:** As the developer-player, I want declare and step as buttons driving the real combat loop, so that the UI adds zero combat logic of its own.
- **Acceptance criteria:**
  - [ ] All advancement goes through `declare` + `step`; the UI implements no combat rules.
  - [ ] Current phase, round, active combatant, and pending actions are rendered at all times.
  - [ ] Invalid declarations (`DeclareRejection`) surface inline with the library's reason.
  - [ ] Combat end is announced as the library reports it, and the log remains reviewable afterward.

### FR-13: Provenanced event log
- **User story:** As the developer-player, I want every event shown with its provenance, so that I can see which pack rule and which dice produced what happened.
- **Acceptance criteria:**
  - [ ] Every runtime event renders with type, a human-readable summary, `why.rule`, and `why.rolls` verbatim (e.g. `d20[9]=9 < ac11` alongside `actions.cut-down.attackBonus`).
  - [ ] The log is the primary panel of the Fight surface; filterable by round and event type.
  - [ ] Events accumulate across rounds; nothing is silently dropped.

### FR-14: Determinism affordances
- **User story:** As the developer-player, I want the engine's byte-determinism promise made visible and checkable, so that regressions show up as a visible mismatch instead of a hidden test failure.
- **Acceptance criteria:**
  - [ ] The active world's seed is always visible (FR-1).
  - [ ] "Rerun same seed" regenerates the pack from the stored theme + seed + knobs and reports byte-identical vs. the stored pack — a pass/fail, not a shrug.
  - [ ] A recorded fight can be replayed: the UI stores the declaration sequence and re-applies it against a fresh fight in the re-rolled pack, flagging any divergence in the event log rather than silently continuing.
  - [ ] RNG state is inspectable through fight-record views: each record shows its combat snapshot's four RNG words. *(Revised 2026-09-26, B-3.)*

### FR-15: Theme-driven mood
- **User story:** As the developer-player, I want the app's mood to respond to the world I rolled, so that dark-fantasy and zombie-urban feel like different games.
- **Acceptance criteria:**
  - [ ] The app's visual mood responds to the active world's theme; **each bundled theme** (`dark-fantasy`, `zombie-urban`, `wyldwood`) produces a clearly distinct mood.
  - [ ] The mood mechanism is defined in the design phase; where theme data carries usable mood metadata the UI consumes it, otherwise a per-theme mapping keyed by theme id is acceptable for v1.
  - [ ] Legibility never degrades in any mood (see NFR Accessibility).

### FR-16: Error surfacing
- **User story:** As the developer-player, I want every library rejection rendered as a readable card, so that failures are information instead of silence.
- **Acceptance criteria:**
  - [ ] All library error types (`PackLoadError`, `GenerationError`, `KnobRejection`, `RuntimeRuleError`, `DeclareRejection`, cost and spatial rejections, build/progression errors) render as readable cards; where the library provides error/rule cards, those are used.
  - [ ] Unexpected errors surface in-app with enough context to file an issue (operation + message); nothing dies silently.

### FR-17: Fully offline
- **User story:** As the developer-player, I want the app to work with networking disabled, so that it honors the engine's no-I/O identity end to end.
- **Acceptance criteria:**
  - [ ] Zero network I/O: generate → play works with networking disabled.
  - [ ] The renderer loads no remote content (CSP enforced).

### FR-18: Inventory & loot
- **User story:** As the developer-player, I want my character to hold pack items and roll the pack's loot tables into their inventory, so that I can exercise the pack's item economy.
- **Acceptance criteria:**
  - [ ] Held items show as `{id, qty}` stacks, named from the pack's `content.items` (name, kind), never invented.
  - [ ] Grant an item from the pack's item list with a qty (`grantItem`), and drop held qty (`dropItem`). Rejections render the library's card verbatim and change nothing.
  - [ ] Roll a loot table (`grantLoot`) with an explicit numeric **loot seed** the user types or picks with a user-initiated randomize. Offered tables are the pack's `-loot`-suffixed tables. A pack with none shows an honest empty state. A flavor roll shows the library's `loot-grants-nothing` card verbatim.
  - [ ] Each mutation's events (`loot:rolled`, `item:granted`, `item:dropped`) show with `why.rule` verbatim.
  - [ ] Inventory survives save → restart → restore through the existing character snapshot (FR-10). No new store.

## Non-Functional Requirements

- **Performance:**
  - Pack generation completes well inside the library's 2 s budget (typically milliseconds).
  - Declare/step and other combat interactions respond within 100 ms perceived.
  - Cold start reaches an interactive world list in under 3 s.
  - Browsing a large pack (thousands of lines of JSON) shows no visible jank; a combat log of 500+ events scrolls smoothly.
- **Security:**
  - Electron secure defaults: `contextIsolation` on, sandboxed renderer, `nodeIntegration` off.
  - Minimal IPC surface; every IPC input validated in the main process.
  - All pack/theme JSON parsed with plain JSON parsing — no `eval` / `new Function` anywhere.
  - CSP blocks remote resources; no telemetry, no analytics.
- **Accessibility:**
  - WCAG 2.1 AA contrast maintained in every theme mood.
  - The combat loop is fully playable from the keyboard (declare/step reachable and operable).
  - Visible focus states; respects `prefers-reduced-motion`.
- **Platform:**
  - Electron desktop app; macOS is first-class (the developer's machine), but no macOS-only APIs — Windows/Linux builds stay unblocked.
  - Minimum window 1280×800; resizable.
  - No auto-update in v1.

## Constraints

- Consumes Ruleswright as a library (sibling repo, built `dist/`); never forks or edits the engine's source. Engine changes are a separate program in that repo. Consumption mechanism (file dependency vs vendored dist) is Architecture's call.
- All mechanics flow through library API calls — the UI implements zero rules math.
- The UI never injects nondeterminism into engine calls; the only "random" is an explicit user-initiated seed pick (the Roll seed and the Character loot seed).
- Design bar (builder-set, binding): simple, generic surface with best-in-class craft — "art to be proud of." Interpreted as *simple in surface, exceptional in craft*: a restrained feature set executed beautifully, not a sprawling feature set skinned pretty. The design phase owns the concrete expression of this bar.
- v2 awareness: quests/campaign are coming engine-side. v1 makes no promises about them beyond not precluding them architecturally.

## Dependencies

- **Ruleswright** — sibling repository (`../Ruleswright`), built dual-ESM/CJS `dist/`; surfaces used: `ruleswright/compiler`, `ruleswright/runtime`, `ruleswright/schema`.
- **Electron** — shell, main/renderer split, native dialogs, file system access for host-owned storage.
- Node ≥ 18, pnpm (the builder's existing ecosystem).
- No other runtime services — zero backend by design.

## Assumptions

- The library's three surfaces as read at spec time (runtime: characters, pools, conditions, progression, combat, triggers, snapshots, events; compiler: `generateCampaign`, knobs, themes; schema: pack format, validator, error cards) are the v1 API. API drift discovered mid-build is handled as a requirements/architecture re-entry, not silent adaptation.
- Both bundled themes load offline via `loadTheme` and validate.
- The pack schema validator and error-card machinery are exported for host reuse.
- Single developer-user; no onboarding, accounts, or multi-user concerns.
- Persistence store design (plain files vs embedded store) is decided in the database phase; these requirements specify *what* must persist, not *how*.

## Glossary

- **Pack:** the generated campaign artifact (classes, spells, bestiary, tables, formulas) — JSON, schema-versioned, byte-deterministic for a given theme + seed + knobs.
- **World:** the app's unit of play — a persisted pack plus its generation parameters (theme, seed, knobs).
- **Theme:** the input template the compiler turns into a pack; currently `dark-fantasy`, `zombie-urban`, `wyldwood`.
- **Knob:** a declared generation parameter with machine-readable type and validation.
- **Seed:** the RNG seed controlling generation and, via the runtime's seeded RNG, play.
- **Provenance:** event metadata — `why.rule` (the pack artifact responsible) and `why.rolls` (the dice, quoted).
- **Stepwise combat:** the begin → declare → resolve → end loop advanced explicitly via `declare`/`step`.
- **Theater-of-mind:** the spatial model without positions or grids.
- **Snapshot:** serialized character or combat state carrying pack identity for restore checks. Character snapshots carry no RNG state; combat snapshots carry the four RNG words.
- **Derived stats:** hp / ac / saves resolved through the pack's own formulas — never hardcoded in the engine or the UI.
- **Surface:** one of the library's three import entry points: `ruleswright/runtime`, `ruleswright/compiler`, `ruleswright/schema`.