# Design Spec — Ruleswright (UI)

The design is a constraint on architecture, not a suggestion. `specs/requirements.md` defines what the app does; this file defines what it looks like and how it behaves — palette, type, components, screens, flows, empty states, errors, motion, accessibility, and the FR-15 mood mechanism.

Working name used throughout: **Ruleswright**. App tagline for v1: *"Roll a world. Play in it."*

---

## Design Language

### Concept — "the artifact, lit by candle or flare"

The app displays generated artifacts (packs, characters, events). The design treats them as **illuminated objects on a dark stage**: near-black backgrounds, hairline borders, one accent doing all the pointing. Restraint is the craft: no drop-shadow stacking, no gradient decoration, no skeuomorphic parchment. The mood shifts per world's theme — candlelit gothic vs. quarantine dusk — while the *structure* of the UI never changes. Elevation is expressed by surface steps (`base` → `surface` → `surface2`), not shadows.

### The FR-15 mood mechanism (binding definition)

- **Structure:** CSS custom properties on `:root`, scoped by `data-mood` on the document root. Every component consumes tokens only; **no component may hardcode a color, font, or radius**.
- **Moods:** `fantasy` (dark-fantasy), `urban` (zombie-urban), `wild` (wyldwood), `archive` (neutral — no-world state, foreign/unknown-pack imports, error overlays before a world exists).
- **Source:** a static per-theme mapping keyed by theme id (`dark-fantasy → fantasy`, `zombie-urban → urban`, `wyldwood → wild`, `*unknown* → archive`). The bundled themes carry no usable mood metadata at spec time; when a future theme does, its metadata wins over the mapping if it declares mood-relevant values.
- **Fonts:** each mood swaps `--font-display` and `--font-reading` (fantasy: Cinzel + Spectral; urban: Oswald + Inter; wild: Spectral 600 + Spectral 400/400-italic; archive: Inter + Inter). Functional UI text is always Inter; data is always JetBrains Mono.
- **Legibility invariant:** WCAG 2.1 AA holds in every mood. `--dim` ≥ 4.5:1 on `--surface`; `--accent-ink` ≥ 4.5:1 on `--accent`. `--dim` is never used for body copy on `--base`.
- **Motion invariance:** mood switch animates as a ≤ 300ms crossfade of color variables, honoring `prefers-reduced-motion` (then instant).

### Color palette (token names, not fixed values — values live in the mood tables below)

| Token | Role |
|---|---|
| `--base` | app background |
| `--surface` | panels, cards |
| `--surface2` | nested panels, wells |
| `--hairline` | 1px borders (translucent, lightens slightly per mood) |
| `--ink` | primary text |
| `--dim` | secondary text, kickers |
| `--accent` | the one pointing color: primary buttons, active states, rolls |
| `--accent-strong` | accent hover / emphasis |
| `--accent2` | second voice: mutations, secondary highlights |
| `--accent-ink` | text on accent fills |
| `--danger` / `--ok` | error cards / verified states |

**Mood values:**

| Token | fantasy | urban | archive | wild |
|---|---|---|---|---|
| `--base` | `#0b0a12` | `#0c0f0d` | `#101113` | `#08100f` |
| `--surface` | `#131120` | `#141814` | `#17191c` | `#0f1a18` |
| `--surface2` | `#1a1730` | `#1a201b` | `#1e2124` | `#152421` |
| `--hairline` | `rgba(212,196,255,.14)` | `rgba(196,220,196,.13)` | `rgba(255,255,255,.12)` | `rgba(186,230,200,.13)` |
| `--ink` | `#eae3d6` | `#e4e8e0` | `#e7e7e5` | `#e3eadf` |
| `--dim` | `#a89fc0` | `#93a396` | `#9aa1a8` | `#94ab9f` |
| `--accent` | `#d8a94e` | `#e56432` | `#c8a86a` | `#9cc76a` |
| `--accent-strong` | `#f0c469` | `#f4794a` | `#dcbf85` | `#b4dc82` |
| `--accent-ink` | `#1a1206` | `#170a05` | `#171204` | `#0c1605` |
| `--accent2` | `#a08cf0` | `#a8b840` | `#8aa0b8` | `#d48ac4` |
| `--danger` | `#e06a78` | `#e05555` | `#e06a6a` | `#e8707a` |
| `--ok` | `#8fbf9a` | `#8fbf7f` | `#8fbf9a` | `#8fc7a8` |

Atmosphere accents (the only non-token color use): `fantasy` gets a candle-glow radial (`rgba(216,169,78,.07–.10)`) from the top edge; `urban` gets a hazard-stripe motif (45° accent/transparent) on section headers; `wild` gets canopy light — two soft radials from the top corners at `color-mix(in srgb, var(--accent) 6%, transparent)`, fading by 55%; `archive` gets none. All are `color-mix` derivations of the accent, not new colors.

`wild` legibility pre-check (WCAG relative luminance, the contrast gate's nine pairs): `--dim`/`--surface` 7.27 · `--dim`/`--surface2` 6.57 · `--accent-ink`/`--accent` 9.53 · `--ink`/`--base` 15.67 · `--ink`/`--surface` 14.48 · `--ink`/`--surface2` 13.09 · `--danger`/`--surface` 5.95 · `--ok`/`--surface` 9.23 · `--accent`/`--surface` 9.14 — all ≥ 4.5:1. Mood glyph: ✻ (fantasy ✦, urban ▲, archive ◆). Font note: Spectral 600 is a new *weight* of a bundled family (display role); no new family.

### Typography

| Role | Face | Weight | Notes |
|---|---|---|---|
| Display (titles, numerals, big stats) | `--font-display` | 600–700 | letterspacing .03em |
| Reading (descriptions, flavor) | `--font-reading` | 400 (+italic) | used for flavor prose |
| Functional UI | Inter | 400/500/600/700 | all labels, buttons, forms |
| Data | JetBrains Mono | 400/500 | seeds, formulas, provenance, JSON, RNG words |

Scale (px): 40 · 32 · 24 · 20 · 18 · 16 · 14 (body) · 12 · 11 (kickers, mono annotations) · 10. Kickers: 11px JetBrains Mono, uppercase, +.16em tracking. Line-height 1.5 body, 1.2 display.

### Geometry & space

- Radii: `--radius-s` 2px (buttons, inputs, rows) · `--radius-m` 4px (panels) · `--radius-l` 8px (modals).
- Borders: 1px hairline everywhere. **No drop shadows** — selection/active is expressed as an accent glow ring (`box-shadow: 0 0 0 1px accent, 0 0 18–24px accent@22–25%`), reserved for active combatants, selected theme cards, and focused critical actions.
- Spacing base 4px; scale ×1, ×2, ×3, ×4, ×6, ×8. Section rhythm: 24–40px between panels.
- Content max-width 1152px (`max-w-6xl`), centered, ≥32px side padding. Desktop-first (≥1280×800); all layouts degrade to single-column ≥ 480px.
- Density: data-dense but airy — generous row padding (10–14px), hairline-separated lists, no zebra striping.

### Iconography

Glyph set only, chosen for mood-neutrality: ✦ ▲ ◆ ✻ ⟳ 🎲. No icon library in v1; glyphs render in text color/accent. (Swap to a proper set in polish if needed.)

### Motion

- All transitions ≤ 150ms (hover, border, glow).
- New combat events fade+rise ≤ 120ms. Log auto-scrolls to newest unless the reader has scrolled up.
- Mood switch crossfade ≤ 300ms.
- `prefers-reduced-motion`: all of the above become instant.
- **Never animate a die roll's arithmetic** — the roll is text, verbatim (FR-13). Rolls may *flash* their accent on arrival, nothing more.

---

## Component Inventory

| Component | Description | States |
|-----------|-------------|--------|
| Button (primary) | The action that advances the flow | default, hover (accent-strong), active, disabled (45% opacity + not-allowed) |
| Button (ghost) | Secondary actions | default, hover (accent border + accent-strong text), disabled |
| Button (danger) | Destructive actions | default, hover (danger fill, base text) |
| Input / Select | Text & option entry, base fill, hairline border | default, focus (accent border + 1px ring), error (danger border), disabled |
| Kicker | Mono caps micro-label over every panel | — |
| Chip | Small rounded metadata pill (counts, states, tags) | default, accent (`chip-accent`), danger (`chip-danger`) |
| Panel / Panel2 | Surface / surface2 card with hairline border | — |
| Progress bar | Pool balances, hp | fill % via accent |
| Stat numeral | Display-font number for hp/ac | — |
| Theme card | Theme picker card with glyph, palette swatches | default, hover, **selected** (accent glow) |
| Artifact row | List row in World views | default, hover (accent border), open |
| Combatant row | hp bar + numeral + status | default, **active** (accent glow) |
| Event row | Provenance-colored log entry | roll (accent border), mutation (accent2), system (hairline) |
| Error card | Library rejection, verbatim | static |
| OK card | Verified/determinism pass state | static |
| Empty state | Centered panel2 well + one-line why + primary CTA | — |
| World plate | Name + theme · seed · schema · actions header | — |
| Determinism strip | Rerun-same-seed + replay panel | pass (ok), fail (danger + diff pointer) |
| Snapshot card | Named snapshot + rng words | default, restore hover |
| Mock mood switch | Fixed top-right ✦/▲/◆ chips — **mock-only affordance; not an app feature** | — |
| Trigger offer (DF-1) | Combat control-column panel, one surface2 row per `pendingTriggers` entry: reactor · action, triggerId (mono), matching event as provenance (type, rolls verbatim, `why.rule`), target select only when the reaction takes a target, **Take** / **Decline** → `respond(triggerId, 'take'\|'decline', targetId?)` | shown only in phase `awaiting-trigger-response`; Declare/Step disabled while any offer is open; the log's `trigger:offered` row is provenance only |
| Combat-over banner (DF-1) | Panel above the combat grid, accent left rule: kicker (round), outcome headline from the library's `combat-over` report verbatim, event provenance (mono), actions Record this fight · View records · ← Back to Fight assembly | shown only after `step()` returns `combat-over`; all combat controls disabled; log stays reviewable |
| Inventory panel (FR-18) | Character sheet-column panel after Conditions: kicker **Inventory**; held stacks as Item rows (hairline-separated in a panel2 well); a **Grant** row (item select from the pack's `content.items` + qty input + Grant, ghost — mirrors Conditions' apply row); a **Loot** row (`-loot` table select + mono **seed** input with `⟳ Randomize` ghost, same affordance as Roll's seed + **Roll loot**, primary); the last mutation's events as Event rows (`loot:rolled` roll-border, `item:granted` / `item:dropped` mutation-border, `why.rule` mono verbatim); inline Error card for rejections, adjacent to the action | populated, empty held ("Nothing held yet."), no loot tables (loot row replaced by "This pack declares no loot tables."), rejection (error card, nothing changed, inputs keep values), flavor roll (`loot-grants-nothing` error card verbatim) |
| Item row (FR-18) | surface2 row: item name (`--font-reading`), kind chip, `×qty` (stat numeral, display font, accent-strong), id (mono, dim); right side: Drop qty input (mono, narrow) + **Drop** (ghost) | default, drop rejected (error card below the panel's rows, e.g. `insufficient-qty`) |
| Fight record row (B-3) | surface/surface2 row in Fight → Records and Combat → Replay & records: name, outcome chip, rounds · events · age, `rng a:<hex8> b:<hex8> c:<hex8> d:<hex8>` (mono, from the stored `combat.rng`), Replay | complete (chip), diverged (chip-danger + first divergent event), abandoned (chip) |
| Snapshot pack-identity line (B-3) | Snapshot card data line `pack <id> · schema <n> · <contentHash>` (mono, full hash, wraps) — **supersedes the "rng words" of the Snapshot card row** (D-20: character snapshots carry no RNG) | — |
| Turn order panel (DF-CX-1) | Combat control column, **directly above Combatants**, below Board (grid) / Trigger offers. Kicker **Turn order** + mono `round N · turn T of K` (accent-strong; T = `state.turn + 1`, K = `state.order.length`). One row per `state.order` entry in library order: order index (mono, dim), name, side chip (library `side` verbatim: `allies` = chip-accent, `enemies` = chip), hp numeral (display font). Followed by the Initiative provenance block | default, **active** row (accent glow, numeral accent-strong); hp ≤ 0 renders like any other row — **no down/skipped label** (CX-D3) |
| Initiative provenance block (DF-CX-1) | panel2 well at the foot of the Turn order panel, from the `combat:start` event verbatim: `initiative` = `payload.initiative` (e.g. `barrow-wight-1 +2 · brynn +1`), `why.rolls` (accent-strong, e.g. `d20[18]+2=20 (barrow-wight-1)`), `why.rule` (`combat.startCombat`); all mono, label column in kickers | static; entries joined with ` · `, never re-sorted |
| Combatant detail (DF-CX-1) | Disclosure (`details`/`summary` "Detail", keyboard-togglable) directly under each Combatant row, surface2 well, label/value grid: **slots** chips `<slot> <remaining>/<grant>` (remaining = `state.slots.remaining`, grant = the pack's slot grants, e.g. `main 1/1 · move 0/1 · reaction 1/1`); **pools** `<id> <n>` mono (`ember 18`); **bound** `L<level> ×<n>` mono (`L1 ×0`), row omitted when the library reports no bound slots; **conditions** `<id> · <duration>` mono + `restricts <patterns>` mono dim (`sapped · 3` / `restricts actions.tagged:main`) | active combatant open by default, others collapsed; empty: "no pools", "no conditions"; no affordability preview |
| Action detail (DF-CX-1) | panel2 well **between the Declare select and the Declare button**, for the selected action (`pack.actions[id]`): kicker `Action · <id>`; `cost` (JSON verbatim), `tags`, `trigger.on`, `valid` (e.g. `hasTarget(adjacent)`), all mono; absent field = `—` | updates with the select; never a pre-judgement (CX-D4) |
| Spatial caption (DF-CX-1) | Beside the Combat header spatial chip (top-right of the world strip): dim mono caption. `grid` chip → `model grid · reach.default <n>` (pack `spatial.model`, `spatial.reach.default` verbatim); `theater-of-mind` chip → "this pack declares no spatial model" | grid, theater-of-mind |
| Board token (CX) | Square token for one combatant, shared by Placement board and Combat board (M08 candidate): mono 10px label `A<n>` (allies) / `E<n>` (enemies) by roster order, 1px border + `color-mix(side 18%, --surface2)` fill, side colour **`--accent` allies, `--accent2` enemies** (existing tokens); title/aria-label `name (id) · side · (x, y)`; placement 28px in 36px squares, combat 22px in 28px squares | default, **active** (combat only: accent glow, same as Combatant row), **selected** (2px `--accent-strong` ring), focus (1px accent ring), stacked (tokens on one square overlap; square shows a `×n` count badge) |
| Placement board (CX) | Fight assembly panel **Placement · grid**, full width **between the Allies/Enemies panels and Determinism**; grid packs only. Header chip "host input, not a rule"; pack `spatial` section verbatim (mono). Left: board, **viewport 12 × 8 squares, display only**, axis labels (mono), origin = `(min(0, min x), min(0, min y))`, off-viewport combatants listed `outside the viewport · A1 brynn (15, 0)`; nothing clamped or refused (CX-D12). Right: one row per combatant (token, name, `id · side · default (x, y)`, mono **x** and **y** inputs) + **Reset to default layout** (ghost) + key legend. Default layout CX-D9 (allies x=0, enemies x=1, y = index in own roster), re-applied when the roster changes. **Pointer:** click a token, then a square (or drag). **Keyboard:** Tab / Shift+Tab through tokens then the x/y inputs; ← → ↑ ↓ move the focused token one square; Home = that token back to its default square; Esc = clear selection; x/y inputs accept any integer | default layout, edited, shared square, off-viewport, input error (non-integer: danger border, position unchanged); theater pack → panel not rendered |
| Combat board (CX) | Combat control column panel **Board**, **after Trigger offers, before Turn order** (Declare → Step stay first in Tab order); grid packs only. Kicker + **Reposition…** (ghost) top-right; pack `spatial` section verbatim (mono); board **viewport 8 × 6 squares, display only** (same origin/off-viewport rules as Placement); tokens at `state.combatants[id].position`, active marker = glow; below, **Distance from <active> (active) · library**: one mono line per other combatant `id  <distance> · (x, y)` from the library's distance; dim note "Distances are the library's (`spatial.distance`); reach is judged only at Declare." No reach/"in reach" hints (EG-4); no burst targeting (EG-7) | default; tokens not focusable outside reposition; theater pack → panel not rendered |
| Reposition control (CX) | In the Combat board: **Reposition…** enters reposition mode — accent-ruled surface2 banner "host repositioning — the engine has no movement rule" + key line; tokens become focusable/movable (same pointer and keys as Placement; Home = back to the square it held when the mode opened; Esc = Cancel); **Apply reposition** (primary) + **Cancel** (ghost) under the board. Apply records one `move` with the complete positions map; distances refresh from the library after Apply | available only at `awaiting-declare` with no open offers (CX-D10); **disabled** (45% opacity) with dim line "Reposition is unavailable after a declare / while offers are open."; disabled after combat-over |
| Declare rejection examples (CX) | The existing Error card, in the Phase panel under the DeclareRejection example: `declare:rejected · <kind> · <rule> · <resource>` then the payload message verbatim (mono, danger) + dim explainer. Validity: `valid · E-REF-01 · cut-down` / `action "cut-down" is not valid right now — its valid clause failed (…)`. Reach: `spatial · E-SPAT-01 · brynn` / `action requires a target within reach 1; nearest brynn is 2 away. …` | static; nothing in the fight changes, select keeps its value |
| Ally spawn row (CX) | Allies panel, Combatant-row shape **after the character row, before "+ Add bestiary spawn…"**: statblock name, mono `spawnMonster · <instanceId> · ally side`, remove (−, ghost). On grid packs it gets a token/row on the Placement board like any combatant | default |
| Assemble by threat row (CX) | Enemies panel, **below "+ Add spawn…"**, mirrors the Inventory Loot row: kicker **Assemble by threat**; mono **budget** input + mono **seed** input + `⟳ Randomize` (ghost) + **Assemble** (primary); dim mono hint; the library's encounter summary line mono accent-strong `encounter · groups barrow-choir ×1 · threat 5 · budget 5 · seedUsed 42 · heuristic threat-weighted-uniform` | non-empty groups replace the enemy roster (grid: default layout refreshed); empty groups → summary `groups (none)`, roster unchanged (CX-D5); rejection → Error card under the row, inputs keep values |
| Resume action (CX) | Fight → Records: **Resume** (ghost) beside **Replay** on each Fight record row. Success opens Combat at the point the script reached. Refusal: status line under the row's actions — `chip-danger` **resume refused** + mono dim `first divergence at event <n>`, exactly like a diverged replay; record unchanged | idle, refused; Combat → Replay & records rows carry no Resume |

---

## Screen Inventory

| Screen | Mock file | Purpose |
|--------|-----------|---------|
| Prototype hub | `mocks/index.html` | Links the whole flow; describes the loop |
| Roll a World | `mocks/roll.html` | FR-2/3/5: world list, import (with example rejected paste), theme cards, seed + randomize, knobs from declarations, forge action |
| Browse the World | `mocks/world.html` | FR-4/14: world plate, artifact subnav with counts, list + detail (Warden, pack formulas verbatim), raw-JSON example |
| Character | `mocks/character.html` | FR-6–10: derived stats, pools/spells with rejection example, conditions, progression, snapshots with rng words, create form |
| Fight assembly | `mocks/fight.html` | FR-11/14: allies/enemies panels, spawn add/remove, determinism strip (pass + replay) |
| Combat | `mocks/combat.html` | FR-12/13: **event log as primary panel** (filters, roll/mutation/system rows), declare+step controls, combatant column, DeclareRejection example, replay records |
| Shell states | `mocks/shell.html` | FR-1/16: three empty states, error-card gallery |
| Design language | `mocks/design-language.html` | The visual spec itself: live tokens, typography, components, motion/a11y — per mood |
| Character — Inventory (FR-18) | `mocks/character.html` | FR-18: Inventory panel after Conditions — held Item rows, Grant row, Loot row (table + seed ⟳ + Roll loot), last mutation's Event rows, inline rejection card, both empty states shown as state examples |
| Combat — trigger & end states (DF-1) | `mocks/combat.html` | FR-12/14: Trigger offers panel (`awaiting-trigger-response`), combat-over banner, record rows with RNG words — shown inline as state examples |
| Combat — turn order & economy (DF-CX-1) | `mocks/combat.html` | FR-11/12/16: spatial caption on the header chip; Action detail under the Declare select; Turn order panel + Initiative block above Combatants; Combatant detail under each Combatant row; hp ≤ 0 unlabelled |
| Combat — grid board & reposition (CX) | `mocks/combat.html` | FR-11/16: Board panel (8 × 6 viewport, tokens, pack `spatial` verbatim, library distances) after Trigger offers; Reposition mode + disabled state; validity (`E-REF-01`) and reach (`E-SPAT-01`) rejection cards in the Phase panel; theater-of-mind state example |
| Fight assembly — placement, ally spawns, threat, resume (CX) | `mocks/fight.html` | FR-11/14: Placement panel (12 × 8 viewport, CX-D9 default layout, pointer + keyboard) between Allies/Enemies and Determinism; ally spawn row; Assemble by threat row; Resume + refused-resume state on Records rows |

**Global shell (implemented, not mocked as a separate screen):** one persistent top bar — Ruleswright glyph + world name + `theme · seed` chip (FR-1), nav Roll / World / Character / Fight, and Import/Export within Roll/World. Active surface is marked by accent underline. The `archive` mood covers shell states with no world open.

**Mock conventions (not app features):** every mock carries the fixed mood-switch chips (top right) and a floating mock-nav (bottom right). Mock data is illustrative, not canonical; the pack's own data always wins at runtime.

---

## User Flows

1. **Primary loop (first play):** Launch (archive mood, world list empty) → Roll: pick `dark-fantasy`, seed 42 → randomize if desired → adjust knobs → **Forge the world** → generation (~6ms) + validation → World opens in `fantasy` mood → browse Classes → open Warden (formulas verbatim) → Character: create Brynn (hillfolk · warden 1) → derived stats resolve → Fight: wight ×2 → **Begin combat** → Combat: declare `cut-down` → **Step** → event log fills with provenance → round completes → fight ends, log reviewable.
2. **Return to a world:** Launch → world list (last-opened first) → Open → world re-validates → every surface resumes.
3. **Import path:** Roll → Paste JSON → validation fails → error card verbatim, paste stays editable → fix → import → becomes a world (parameters unknown → determinism affordances render as unavailable, never fake).
4. **Determinism check:** World → **Rerun same seed** → pass (ok card: byte-identical) or fail (danger card + diff pointer). Fight → record declarations → replay after engine change → divergence flagged in log, never silent.
5. **Character lifecycle:** play → conditions tick explicitly → pools drain/reject with library reasons → Save snapshot (`pre-combat`, rng words shown) → app restart → restore (pack identity checked).
6. **Mood shift:** Forge `zombie-urban` world → app mood transitions to `urban` ≤ 300ms → hazard-stripe headers, Oswald display — same structure, different game feel.

---

## Empty States (FR-1)

| Where | Message | CTA |
|---|---|---|
| World / Character / Fight, no world | "No world yet — Roll one, or import a pack." | → Roll |
| Character / Fight, world but no character | "No character in this world yet — create one." | → Character |
| Combat, never fought | "No fights yet — assemble one." | → Fight setup |

All three render in the archive mood's centered panel2 well.

---

## Error & Rejection Display (FR-16)

**One pattern, every failure:** `errorcard` — danger hairline, danger-tinted surface wash, mono verbatim message, dim explainer line. The library's message is quoted, never paraphrased, never replaced with a friendlier paraphrase. Placement: inline, adjacent to the action that failed (form fields, declare control, import dialog). Nothing is lost on failure — form values persist. The `okcard` mirrors it for determinism passes.

Unexpected (non-library) errors use the same card with operation + message, enough to file an issue.

---

## Accessibility (binding on implementation)

- WCAG 2.1 AA contrast in **every** mood (values above are pre-checked; any new mood must re-check).
- Full keyboard play for combat: declare select + Declare/Step reachable and operable; visible focus rings (accent 1px ring).
- `prefers-reduced-motion` honored everywhere.
- Event log is a single region with round/type filters — no content flashes out from under the reader.

---

## Binding on the build

- The mood-switch chips and mock-nav in the mocks are **mock conventions only** — the shipped app gets no mood picker and no floating nav.
- The design language sheet (`design-language.html`) is the visual spec: implement tokens exactly; components consume tokens only.
- Mocks are the contract for structure and behavior of every named surface; mock copy is illustrative, pack data wins at runtime.