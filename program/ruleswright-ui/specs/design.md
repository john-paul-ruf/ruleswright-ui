# Design Spec — Ruleswright (UI)

The design is a constraint on architecture, not a suggestion. `specs/requirements.md` defines what the app does; this file defines what it looks like and how it behaves — palette, type, components, screens, flows, empty states, errors, motion, accessibility, and the FR-15 mood mechanism.

Working name used throughout: **Ruleswright**. App tagline for v1: *"Roll a world. Play in it."*

---

## Design Language

### Concept — "the artifact, lit by candle or flare"

The app displays generated artifacts (packs, characters, events). The design treats them as **illuminated objects on a dark stage**: near-black backgrounds, hairline borders, one accent doing all the pointing. Restraint is the craft: no drop-shadow stacking, no gradient decoration, no skeuomorphic parchment. The mood shifts per world's theme — candlelit gothic vs. quarantine dusk — while the *structure* of the UI never changes. Elevation is expressed by surface steps (`base` → `surface` → `surface2`), not shadows.

### The FR-15 mood mechanism (binding definition)

- **Structure:** CSS custom properties on `:root`, scoped by `data-mood` on the document root. Every component consumes tokens only; **no component may hardcode a color, font, or radius**.
- **Moods:** `fantasy` (dark-fantasy), `urban` (zombie-urban), `archive` (neutral — no-world state, foreign/unknown-pack imports, error overlays before a world exists).
- **Source:** a static per-theme mapping keyed by theme id (`dark-fantasy → fantasy`, `zombie-urban → urban`, `*unknown* → archive`). The bundled themes carry no usable mood metadata at spec time; when a future theme does, its metadata wins over the mapping if it declares mood-relevant values.
- **Fonts:** each mood swaps `--font-display` and `--font-reading` (fantasy: Cinzel + Spectral; urban: Oswald + Inter; archive: Inter + Inter). Functional UI text is always Inter; data is always JetBrains Mono.
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

| Token | fantasy | urban | archive |
|---|---|---|---|
| `--base` | `#0b0a12` | `#0c0f0d` | `#101113` |
| `--surface` | `#131120` | `#141814` | `#17191c` |
| `--surface2` | `#1a1730` | `#1a201b` | `#1e2124` |
| `--hairline` | `rgba(212,196,255,.14)` | `rgba(196,220,196,.13)` | `rgba(255,255,255,.12)` |
| `--ink` | `#eae3d6` | `#e4e8e0` | `#e7e7e5` |
| `--dim` | `#a89fc0` | `#93a396` | `#9aa1a8` |
| `--accent` | `#d8a94e` | `#e56432` | `#c8a86a` |
| `--accent-strong` | `#f0c469` | `#f4794a` | `#dcbf85` |
| `--accent-ink` | `#1a1206` | `#170a05` | `#171204` |
| `--accent2` | `#a08cf0` | `#a8b840` | `#8aa0b8` |
| `--danger` | `#e06a78` | `#e05555` | `#e06a6a` |
| `--ok` | `#8fbf9a` | `#8fbf7f` | `#8fbf9a` |

Atmosphere accents (the only non-token color use): `fantasy` gets a candle-glow radial (`rgba(216,169,78,.07–.10)`) from the top edge; `urban` gets a hazard-stripe motif (45° accent/transparent) on section headers; `archive` gets neither. Both are `color-mix` derivations of the accent, not new colors.

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