# SESSION-04 — Resume a recorded fight

> **Program:** Ruleswright (UI)
> **Feature:** combat-complete
> **Modules:** M06, M09, M14, M17
> **Depends on:** SESSION-03 (or SESSION-02 when SESSION-03 is `skipped`); AUTHOR-SPEC-CX (Q3 = a) + AUTHOR-DESIGN-CX (Q3 part) committed
> **Concurrent with:** —
> **Owns:** `src/renderer/src/engine/replay.ts`, `src/renderer/src/store/combat.ts`, `src/renderer/src/views/fight/records.tsx`, `src/renderer/src/views/fight/fight.css`, `tests/engine/replay.test.ts`, `tests/store/combat.test.ts`, `e2e/replay.spec.ts`
> **Reads:** `program/ruleswright-ui/specs/requirements.md` (FR-14 amended), `program/ruleswright-ui/specs/design.md`, `program/ruleswright-ui/specs/database.md` (FightDoc, unchanged), `src/renderer/src/engine/combat.ts`, `src/renderer/src/views/combat/index.tsx`, `e2e/fixtures.ts`
> **Resources:** `e2e:out` (checkpoint 3 only)
> **Checkpoints:** 3

**Plan applies to Q3 = (a).** On Q3 = (c), mark it `skipped`. On Q3 = (b), Planner must replan this session:
it needs a DB field and a different engine path (`deserializeCombat`), so this prompt does not apply.

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M06 | engine | `replay.ts` | `resume()`: fresh Runtime on the stored pack, re-apply the script, require identical events |
| M09 | store | `combat.ts` | `resume(name)` → a live fight continuing the recorded script/log |
| M14 | views/fight | `records.tsx`, `fight.css` | Resume action on record rows; refusal rendering |
| M17 | tests | three files | Proofs |

## Context
A FightDoc already stores everything needed to rebuild a fight exactly: `start` (ally snapshot, enemies,
and `allySpawns` from SESSION-02), `script` (every host call), and `events`. Replay already re-applies the
script on a fresh Runtime and compares events. Resume uses that same path on the **stored pack bytes**; it
needs no re-roll, so imported worlds work too. When the events match exactly, the rebuilt fight is **handed
to the combat store live**. The engine's `deserializeCombat` was not chosen because it loses the live
pool/bound-slot spend and restarts `offerIndex` (CX-D6, AUTHOR-REQUEST-CX Q3).

## Capabilities
- **CAP-05 Resume (owned here, complete).** Entry: Fight or Combat → Records → **Resume** on a row. Path:
  1. `fight:load` (IPC) → `engine.resume(storedPackJson, rec)`:
     - `openPack` → a fresh Runtime
     - `restore(start.ally.snapshot)` → `allyProfile`
     - `subscribe`, then `begin(rt, ally, enemies, allySpawns ?? [])`
     - `perform` each script entry
     - `events` must deep-equal `rec.events` (same length, `JSON.stringify` per index, the `replay.ts`
       comparator)
  2. equal → the store adopts `{fight, start, script, declarations, log: events, hpAtStart}` and
     re-subscribes its log sink to `fight.runtime`; the view navigates to Combat
  3. different → refused with the first divergent index, shown like a diverged replay; the store is
     unchanged
- Continuing play appends to the adopted `script`. Recording under a **new** name produces a record that
  replays `complete` from begin. Durable read after restart: resume a record → continue one step → record →
  restart → replay `complete`.

## Contract Agreements
- **CA-09 resume identity.** The resumed state equals the recorded state:
  `serializeCombat(resumed, {pairsWith: start.ally.id})` deep-equals the record's `combat`, rng words
  included. Resumed `pendingTriggers` equal the offers open at record time. The adopted `log` deep-equals
  `rec.events`. A missing `script`/`start`/`events` → `unavailable` with the existing replay reason text.
  No partial adoption.
- **CA-10 hpAtStart.** Capture it from `fight.state` right after `begin` and before the first `perform`,
  exactly as `store.begin` does today. Never read it from the record.
- **CA-11 subscription handoff.** Adoption order is: end the old fight's subscription → subscribe the store
  sink to `fight.runtime` → publish. No event is double-logged or dropped. Proof: one step after adoption
  appends exactly the events `fight.runtime` emitted for that call.
- `outcome` is unchanged by resume. A refused resume does **not** rewrite `outcome` (only replay
  divergence does, per database.md).

## Files to Create/Modify
| File | Action | What Changes |
|------|--------|--------------|
| `src/renderer/src/engine/replay.ts` | modify | `export type ResumeResult = {status:'resumed'; fight: Combat; events: RuntimeEvent[]; hpAtStart: Record<string, number>} \| {status:'diverged'; index; expected?; actual?} \| {status:'unavailable'; reason} \| {status:'error'; error}`; `resume(storedPackJson, rec)`. Share the comparator/rebuild with `replay` (extract a private helper; `replay`'s behavior is unchanged) |
| `src/renderer/src/store/combat.ts` | modify | `resume(name): Promise<boolean>`, `resumed: {name; result} \| null` for refusal display |
| `src/renderer/src/views/fight/records.tsx` | modify | `fight-resume-<name>` button beside `fight-replay-<name>`. `fight-resume-status` for refusals. On success, `navigate('combat')` |
| `src/renderer/src/views/fight/fight.css` | modify | Tokens-only |
| `tests/engine/replay.test.ts` | modify | CA-09 identity (incl. rng and an open trigger offer), divergence refusal (tampered script), unavailable (legacy) |
| `tests/store/combat.test.ts` | modify | CA-10/11; resume → step → record → replay `complete` through the in-process bridge |
| `e2e/replay.spec.ts` | modify | CAP-05 journey |

## Implementation

### Checkpoint 0 — recheck (no commit)
Read the amended FR-14 and the design row. If either is absent, return `blocked`. Confirm the
`perform`/`begin` signatures after SESSION-02/03. Confirm `records.tsx` ids (`fight-replay-<name>`,
`fight-replay-status`) at HEAD.

### Checkpoint 1 — engine + store
Build `resume` and `store.resume` as specified. The unit test for an open trigger offer: record while a
`parry` offer is pending, from a reference fight where a wight's `attack:rolled` targets a warden. Search
seeds/steps with the engine in the test setup, or build the record from a script that reaches one. Never
hand-write events.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` pass.

### Checkpoint 2 — UI
Resume button + refusal status per AUTHOR-DESIGN-CX. Keyboard reachable.
**Commit when:** typecheck, lint and test pass, and `pnpm build` exits 0 (under `e2e:out`).

### Checkpoint 3 — CAP-05 e2e
In `e2e/replay.spec.ts`:
1. begin a fight, step/declare a few calls, record `mid-1` (outcome `abandoned`)
2. `rw.restart()`
3. Resume `mid-1` → the Combat surface shows the same round/active/phase and the same log row count as
   `mid-1`'s stored `events.length`
4. one more step → record `mid-2` → replay `mid-2` → `complete`
5. tamper `mid-1`'s stored script (the existing tamper helper pattern) → Resume → refused status with the
   divergent index; the Combat surface is unchanged

**Commit when:** `pnpm verify` exits 0.

## Verification
- Per checkpoint: `pnpm typecheck && pnpm lint && pnpm test`. Checkpoint 2: build. Checkpoint 3:
  `pnpm verify` under `e2e:out`.
- Integration proof CAP-05 (CA-09/10/11):
  - Unit leg: real main handlers via `in-process-bridge` on a temp dir.
  - Packaged leg: the built app via `e2e/fixtures.ts`, isolated userData, `restart()` on the same dir.
  - Real pieces: storage, engine, preload. The build identity is recorded.

## State Update
Report: the Spec/Design revisions, CA-09 deep-equality evidence (incl. rng words and a pending offer), the
tamper refusal, and the build identity. Arch delta: M06 `resume`/`ResumeResult`, M09 `resume`, M14 Resume
action. Report new test ids.
