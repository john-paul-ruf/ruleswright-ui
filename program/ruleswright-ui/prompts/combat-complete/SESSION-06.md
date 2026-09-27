# SESSION-06 — Resume a recorded fight

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete (plan rev 2; this was SESSION-04 in rev 1)
> **Modules:** M06, M09, M14, M17
> **Depends on:** SESSION-05 (or the latest non-skipped of SESSION-04/03); human Q3 = (a); AUTHOR-SPEC-CX + AUTHOR-DESIGN-CX (Q3 parts) committed
> **Concurrent with:** —
> **Owns:** `src/renderer/src/engine/replay.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/records.tsx`, `src/renderer/src/views/fight/fight.css`, `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`, `e2e/replay.spec.ts`
> **Reads:** `program/ruleswright-ui/specs/requirements.md` (FR-14 amended), `program/ruleswright-ui/specs/design.md`, `program/ruleswright-ui/specs/database.md` (FightDoc as amended by AUTHOR-DB-CX), `src/renderer/src/engine/combat.ts`, `src/renderer/src/views/combat/index.tsx`, `e2e/fixtures.ts`
> **Resources:** `e2e:out` (checkpoints 2–3)
> **Checkpoints:** 3

**Applies to Q3 = (a).** Q3 = (c) → `skipped`. Q3 = (b) → Planner replans (different engine path + DB field).

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M06 | engine | `replay.ts` | `resume()`: fresh Runtime on the stored pack, re-apply the script (moves included), require identical events |
| M09 | store | `combat.ts` | `resume(name)` adopts the rebuilt `LiveFight` |
| M14 | views/fight | `records.tsx`, `fight.css` | Resume action; refusal rendering |
| M17 | tests | three files | Proofs |

## Context
A FightDoc holds `start` (ally snapshot, enemies, `allySpawns?`, `positions?`), `script` (declare / respond /
step / move) and `events`. Replay already rebuilds from them on a fresh Runtime through S01's shared `perform`.
Resume uses the same path on the **stored pack bytes** (no re-roll, so imported worlds work) and hands the
rebuilt `LiveFight` to the store when events match exactly. `deserializeCombat` from the record's `combat`
snapshot was not chosen: it loses the live pool/bound-slot spend and restarts the log and `offerIndex` (CX-D6).

## Capabilities
- **CAP-05 Resume (owned here, complete).** Records → **Resume** → `fight:load` → `engine.resume(storedPackJson,
  rec)` (openPack → restore ally → `allyProfile` → subscribe → `begin(…, positions, allySpawns)` → `perform`
  each entry → events deep-equal `rec.events`) → equal: the store adopts `{live, start, script, declarations,
  log, hpAtStart}` and re-subscribes; different: refused with the first divergent index, store unchanged.
  Continuing appends to the adopted script; recording under a new name replays `complete` from begin.

## Contract Agreements
- **CA-09 resume identity.** `serializeCombat(resumed, {pairsWith})` deep-equals the record's `combat` (rng
  words **and positions** included); resumed `pendingTriggers` equal those open at record time; adopted log
  deep-equals `rec.events`. Missing `script`/`start`/`events` → `unavailable` (existing reason text). A spatial
  record without `start.positions` → the library refusal as `error`. No partial adoption.
- **CA-10 hpAtStart** read from `fight.state` right after `begin`, before the first `perform`; never from the
  record, and not re-read after a replayed `move` (a move changes no hp).
- **CA-11 subscription handoff.** End the old subscription → subscribe the store sink to the new
  `live.fight.runtime` → publish. Proof: one step after adoption appends exactly that call's events. A move
  after adoption replaces `live.fight` on the **same** runtime, so the sink stays attached (S01 CA-13).
- Resume never rewrites `outcome`.

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `engine/replay.ts` | modify | `ResumeResult` (`resumed` with `live: LiveFight`, `events`, `hpAtStart` \| `diverged` \| `unavailable` \| `error`); `resume(storedPackJson, rec)`; share the rebuild/comparator with `replay` (behavior unchanged) |
| `store/combat.ts` | modify | `resume(name): Promise<boolean>`; `resumed` for refusal display |
| `views/fight/records.tsx`, `fight.css` | modify | `fight-resume-<name>`, `fight-resume-status`; success → `navigate('combat')` |
| tests | modify | CA-09 incl. rng, positions, an open offer; tampered move → refused; legacy unavailable; CA-10/11; resume → step → record → replay `complete` |

## Implementation
### Checkpoint 0 — recheck (no commit)
Amended FR-14 + design row present, else `blocked`. Confirm `LiveFight`, `perform(live, entry)`, `begin`
signature and `records.tsx` ids at HEAD.
### Checkpoint 1 — engine + store
Open-offer case: build the record with the engine in test setup (a wight's `attack:rolled` targeting a warden
yields a `parry` offer); never hand-write events. **Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass.
### Checkpoint 2 — UI
Keyboard reachable. **Commit when:** unit gates pass and `pnpm build` exits 0 (`e2e:out`).
### Checkpoint 3 — CAP-05 e2e (`e2e/replay.spec.ts`)
Grid world: begin, a few calls including one reposition, record `mid-1`; `rw.restart()`; Resume `mid-1` →
same round/active/phase, same token positions, log row count = stored `events.length`; one more step → record
`mid-2` → replay `complete`; tamper `mid-1`'s stored `move` positions → Resume refused with the divergent index,
Combat unchanged. **Commit when:** `pnpm verify` exits 0.

## Verification
Unit gates; build at 2; `pnpm verify` at 3. Unit leg over real main handlers (`in-process-bridge`); packaged
leg via `e2e/fixtures.ts` (isolated userData, restart on the same dir); build identity recorded.

## State Update
Spec/Design revisions; CA-09 evidence (rng, positions, pending offer); tamper refusal; build identity. Arch:
M06 `resume`/`ResumeResult`, M09 `resume`, M14 Resume. New test ids.
