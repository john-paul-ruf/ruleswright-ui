# Database Design — Ruleswright (UI)

Reads as input: `specs/architecture.md` (engine + data-layer decision) and `specs/requirements.md` (what must persist). The stack decision is **plain JSON files under Electron `userData/`** — no SQL engine, no ORM. This document is therefore the *store contract*: record shapes, identity and integrity rules, canonical serialization, and the migration/compatibility policy that `src/main/storage.ts` implements (implementation is Coder's, under `main`'s module contract; **the on-disk format defined here is DB-owned for the life of the program**).

---

## Engine

**None.** Plain JSON files, one document per file, written by the main process only. Rationale (from architecture): nothing queries, data is tiny and keyed by id, and character snapshots / fight records must move freely to node scripts — files *are* the interchange format (FR-10, FR-5). "Wipe everything" is a directory delete. No native modules, no background process, no lock files: single-process app, all writes from main, no concurrency to guard against beyond atomic-rename discipline (below).

## Schema Overview

```
app.getPath('userData')/
├── settings.json                      — one document, always exists after first run
├── worlds/<worldId>/
│   ├── world.json                     — WorldDoc: identity + generation parameters
│   └── pack.json                      — the pack, canonical bytes, never rewritten
├── snapshots/<worldId>/<snapshotName>.json   — SnapshotDoc
└── fights/<worldId>/<fightName>.json         — FightDoc
```

Relationships are directory-encoded, not key-encoded: a snapshot belongs to a world by living under its `<worldId>` directory; a fight likewise. There are no foreign keys — **referential integrity is enforced by the one write path that can break it: deleting a world cascades to its `snapshots/<worldId>/` and `fights/<worldId>/` directories** (FR-3 delete confirmation covers the cascade; the UI names the counts in the confirm dialog).

`<worldId>` is a `crypto.randomUUID()` minted in main at forge/import time. `<snapshotName>` / `<fightName>` are user-named, sanitized by main to `[\w- ]+` (trimmed, ≤ 64 chars, collision within the same world dir rejected with a named error — never silently suffixed).

## Documents

### settings.json — `Settings`
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `formatVersion` | int | `1` | Store format version; see Migration Policy |
| `lastWorldId` | string \| null | — | World the app reopens at launch (FR-3); null if deleted since |
| `windowBounds` | `{x?,y?,width,height,maximized}` \| null | width/height ≥ 400 | Restored at window creation (NFR-Platform) |

Written atomically on change. Missing file = defaults; malformed file = log + defaults (settings are disposable; world data is not — see integrity rules).

### world.json — `WorldDoc`
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `formatVersion` | int | `1` | Store format version |
| `id` | string | UUID v4, matches directory name | Immutable identity |
| `name` | string | 1–80 chars after trim | User-renameable (FR-3); default `theme · seed` |
| `theme` | string \| null | — | Theme id at forge time (`dark-fantasy` / `zombie-urban`); **null for imported packs with unknown parameters** (FR-5) |
| `seed` | int \| null | — | Null ⇒ same-seed affordances render unavailable, never faked (FR-14) |
| `knobs` | object \| null | keys/values as passed to `generateCampaign` | Verbatim from the forge form; null for unknown-parameter imports |
| `schemaVersion` | int | pack's own `schemaVersion` at forge | Mirror of the pack's contract for list display |
| `packSha256` | string | 64 hex | Digest of `pack.json`'s exact bytes; the determinism check's fast pre-filter (full byte compare remains authoritative, FR-14) |
| `createdAt` / `updatedAt` | ISO-8601 string | — | Display ordering in the world list (last-opened first is `settings.lastWorldId` + `updatedAt`, not a query) |

### pack.json
The generated pack, written **verbatim** — the exact string the app serialized at forge time. Canonical serialization is `JSON.stringify(pack)` (compact, no reformatting, engine-produced key order preserved). **Never pretty-printed, never re-serialized on read**: byte-fidelity between disk and the FR-14 byte-compare is the point of this file. Re-open validation runs the pack through the library's schema validator before use (FR-3); validation failure ⇒ the world is listed but marked corrupt (chip, `danger`), not auto-deleted — recovery is a human decision.

### SnapshotDoc — `snapshots/<worldId>/<name>.json`
| Field | Type | Notes |
|-------|------|-------|
| `formatVersion` | int (`1`) | Store format version |
| `id` | string | UUID, for stable references |
| `worldId` | string | Redundant with path; written for interchange safety when the file travels to node scripts |
| `name` | string | The filename stem, echoed |
| `createdAt` | ISO-8601 string | |
| `packIdentity` | object | The pack identity block from `serializeCharacter` output, echoed top-level so a mismatched restore is detectable without parsing the snapshot body (FR-10) |
| `snapshot` | object | **Verbatim `serializeCharacter` output** — never wrapped, re-keyed, or summarized. Carries no RNG state (the library's character envelope has none); RNG words live in `FightDoc.combat.rng` (FR-14, revised B-3) |

### FightDoc — `fights/<worldId>/<name>.json`
| Field | Type | Notes |
|-------|------|-------|
| `formatVersion` / `id` / `worldId` / `name` / `createdAt` | as SnapshotDoc | |
| `declarations` | array | **Verbatim, ordered declaration sequence** — each entry `{combatantId, action, options}` as passed to `declare`; this is the replay script (FR-14) |
| `combat` | object | `serializeCombat` output at record time, for inspection and post-hoc diffing |
| `outcome` | string enum | `'complete' \| 'diverged' \| 'abandoned'` — CHECK-equivalent enforced by main on write; updated if a replay later diverges (the only in-place rewrite of a FightDoc; all other fields untouched) |
| `start` | object | *(added B-2; extended CX)* `{ ally: { id: string, snapshot: <verbatim serializeCharacter output at begin> }, enemies: [{ statblockId: string, instanceId: string }], positions?: { [combatantId]: { x: int, y: int } }, allySpawns?: [{ statblockId: string, instanceId: string }] }` — enemies in the order passed to `startCombat`. `positions` (optional) are the positions passed to `startCombat`, present iff the pack declares a spatial model. `allySpawns` (optional) are in `startCombat` ally order after the character, written only when non-empty. On replay the ally is restored into the re-rolled pack and its combatant profile is re-derived through the engine's character→combatant export; the UI does no profile math |
| `script` | array | *(added B-2; extended CX)* **The replay script:** every host call from begin to record, in order — `{op:'declare', actionId, targetId?}` \| `{op:'respond', triggerId, choice:'take'\|'decline', targetId?}` \| `{op:'step'}` \| `{op:'move', positions: { [combatantId]: { x: int, y: int } }}` — a `move` entry is the complete positions map after the reposition (every combatant). Rejected declares are included (they are host calls that emit `declare:rejected`). `declarations` is derived from it |
| `events` | array | *(added B-2)* Every `RuntimeEvent` observed from begin to record, verbatim and in order (`type, at, actor?, target?, payload, why`) — the reference stream for divergence pointing |

**FightDoc replay rule (B-2; extended CX):** (1) re-roll the pack from the world's stored parameters; (2) if its bytes differ from the stored `pack.json`, report a *pack* divergence before any combat; (3) otherwise restore the ally from `start.ally.snapshot`, spawn `start.allySpawns` (absent = none), spawn `start.enemies`, begin with `start.positions` (absent = none), and re-apply `script` in order — a `move` entry re-applies the reposition through the engine's serialize → restore seam with the same sides, the live balances and the entry's positions; (4) compare the new events with `events` index by index — the first mismatch is the flagged divergence and `outcome` becomes `diverged`; (5) a world with null parameters, or a record without `script` (legacy), shows replay as unavailable — never guessed. A record on a spatial pack without `start.positions` replays as the library's refusal, never guessed. The B-2 fields are additive: `formatVersion` stays `1` (Migration Policy rule 2); legacy records without them still list and load.

**Integrity rules (all enforced in main, the only writer):**
- Every write is atomic: temp file + rename in the same directory; a crash never leaves a half-written document.
- Directory names are validated UUIDs; file reads resolve only inside `userData/` (path clamping — no `..`, no absolute paths from renderer payloads).
- Unknown fields in any document are **tolerated and preserved** on rewrite (forward compatibility); missing optional fields get defaults. Required-field violation ⇒ the document is skipped and reported, never silently repaired.
- `worldId` cascade: deleting a world removes `worlds/<id>`, `snapshots/<id>/`, `fights/<id>/` in that order, then clears `settings.lastWorldId` if it pointed at it.
- The renderer never receives or sends paths — only ids and names (NFR-Security).
- FightDoc (B-2; extended CX): `script[].op` ∈ `declare | respond | step | move` with each entry's fields type-checked and `choice` ∈ `take | decline`; `start.enemies[]` items are `{statblockId, instanceId}` strings; `start.allySpawns[]` items are `{statblockId, instanceId}` strings; `start.positions` values are `{x, y}` integers keyed by strings, and a `move` entry's `positions` has the same shape; `start.ally.snapshot.kind === 'character'`; `events` is an array; every document is capped at 16 MiB.

## Seed Data

None. The store's empty state (no worlds, no settings) is the designed first-run state: the app opens in `archive` mood on the world list with an empty-state CTA to Roll (FR-1, design.md). `settings.json` is created on first write, not at install.

## Query Patterns

No query engine — patterns are the fs operations `main/storage.ts` implements, each O(small n):

| Pattern | Operation | Serves |
|---------|-----------|--------|
| List worlds at startup | read each `worlds/*/world.json` | FR-3 |
| Open a world | read `world.json` + `pack.json` (validate pack) | FR-1/3 |
| Persist forge/import result | write `world.json` + `pack.json` (atomic) | FR-2/5 |
| Rename/delete world | rewrite `world.json` / cascade rmdir | FR-3 |
| List/save/load/delete snapshots | dir scan of `snapshots/<worldId>/` | FR-10 |
| List/save/load/delete fight records | dir scan of `fights/<worldId>/` | FR-14 |
| Settings read/write | read/atomic-write `settings.json` | FR-3, NFR-Platform |

Sizes are bounded by design: dozens of worlds, tens of snapshots/fights each; no index structures are warranted. If a future requirement ever implies search across all worlds' packs, that is a re-entry to DB, not an improvised index.

## Migration Policy

Forward-only, load-time, implemented in `main/storage.ts` (Coder) to the rules below — **no rewrite tools, no destructive steps**:

1. Every document carries `formatVersion`. v1 ships `1`; the reader accepts `≤ current` and normalizes upward in memory.
2. Unknown fields are preserved on rewrite (above) — additive change needs no version bump.
3. A **breaking** shape change bumps `formatVersion` and adds a named, purely-additive normalization step in storage (e.g. `v1→v2: default missing field`). Old files keep working or are explicitly marked `legacy` in the UI — never deleted.
4. Pack bytes are untouchable by this policy: `pack.json` is the engine's artifact. Pack *schema* evolution belongs to the engine (`schemaVersion`), and this app's obligation is to re-validate and surface the library's verdict (FR-3 open path).
5. There is no released history yet — `formatVersion` 1 is the initial and only version at handoff.

## Migration History (DB-owned paths)

| # | Description | Artifact |
|---|-------------|----------|
| 1 | File-store contract: directory layout, document shapes, canonical serialization, integrity + migration rules | `specs/database.md` (this document — DB-owned) |
| 2 | B-2/B-3 (human-approved 2026-09-26): FightDoc gains `start`, `script`, `events` + replay rule + integrity rules; SnapshotDoc note corrected — character snapshots carry no RNG (RNG words live in `FightDoc.combat.rng`). Additive, `formatVersion` stays 1 | `specs/database.md` |
| 3 | CX (combat-complete; human-approved 2026-09-27, AUTHOR-REQUEST-CX rev 2, decision "q4 a-i, q1 a, q2 a, q3 a"): FightDoc gains optional `start.positions` (present iff the pack declares a spatial model), optional `start.allySpawns` (written only when non-empty) and a fourth `script` entry kind `move` (the complete post-reposition positions map, every combatant); replay rule step (3) extended to spawn `start.allySpawns`, begin with `start.positions` and re-apply `move` through the engine's serialize → restore seam; integrity rules extended to match. Additive, `formatVersion` stays 1 | `specs/database.md` |

No `src/migrations/*` files exist **by design**: the stack idiom for a JSON file store is the store contract itself, implemented under `main`'s module contract. These paths are therefore spoken for at Planner time and excluded from every session's `Owns`:

- `specs/database.md` — the on-disk format defined above
- The shapes it defines (`WorldDoc`, `SnapshotDoc`, `FightDoc`, `Settings`, `formatVersion` semantics) as realized in `src/shared/model.ts` — Coder writes the file, but **any change to these shapes is a DB re-entry**, not a session scope adjustment.

*"Data outlives code." Here the data is deliberately plain: the pack is the artifact, and every byte of it survives the trip to disk.*