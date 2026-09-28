/**
 * Record, replay & resume (FR-14b, CA-09): a recording is the fight's start, every host call and every event;
 * replay re-rolls the pack from the world's stored params (CA-12 path), rebuilds the fight on a new
 * Runtime, re-applies the script and points at the first event that differs. Resume runs the same rebuild on
 * the stored pack bytes and hands the rebuilt fight over only when every event matches. Never guesses.
 */
import { serializeCombat } from 'ruleswright/runtime';
import type { WorldMeta } from '../../../shared/model';
import {
  begin,
  perform,
  subscribe,
  type Combat,
  type CombatSnapshot,
  type DeclareOptions,
  type FightStart,
  type LiveFight,
  type RuntimeEvent,
  type ScriptEntry,
} from './combat';
import { allyProfile } from './combat-profile';
import { rerunSameSeed } from './determinism';
import { toAppError, type AppError } from './errors';
import { restore, type Outcome } from './runtime';
import { openPack } from './schema';

export interface Declaration {
  combatantId: string;
  action: string;
  options: DeclareOptions;
}

export interface Recording {
  start: FightStart;
  script: ScriptEntry[];
  events: RuntimeEvent[];
  combat: CombatSnapshot;
  /** The declare calls, as `{combatantId, action, options}` (FightDoc `declarations`). */
  declarations: Declaration[];
}

export type ReplayResult =
  | { status: 'complete' }
  | { status: 'diverged'; stage: 'pack' }
  | { status: 'diverged'; stage: 'events'; index: number; expected?: RuntimeEvent; actual?: RuntimeEvent }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; error: AppError };

/** FR-14 resume (CA-09/10): the rebuilt fight and its log, or why it is not adopted. */
export type ResumeResult =
  | { status: 'resumed'; live: LiveFight; events: RuntimeEvent[]; hpAtStart: Record<string, number> }
  | { status: 'diverged'; index: number; expected?: RuntimeEvent; actual?: RuntimeEvent }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; error: AppError };

const NO_SCRIPT = 'record has no replay script (recorded before B-2)';

/**
 * FR-14b: what a record stores. `declarations` are the script's declare calls with the combatant that was
 * active when each was issued (the script itself does not name it); `combat` is `serializeCombat` paired
 * with the ally id.
 */
export function recordingOf(
  fight: Combat,
  start: FightStart,
  script: ScriptEntry[],
  events: RuntimeEvent[],
  declarations: Declaration[],
): Recording {
  return { start, script, events, declarations, combat: serializeCombat(fight, { pairsWith: start.ally.id }) };
}

function firstDifference(expected: readonly RuntimeEvent[], actual: readonly RuntimeEvent[]): number {
  const n = Math.max(expected.length, actual.length);
  for (let i = 0; i < n; i += 1) if (JSON.stringify(expected[i]) !== JSON.stringify(actual[i])) return i;
  return -1;
}

type Rebuilt = { live: LiveFight; hpAtStart: Record<string, number> };

/**
 * database.md replay rule, step 3 (shared by replay and resume): restore the ally into a fresh Runtime on
 * `storedPackJson`, re-derive its profile (B-1), spawn `start.allySpawns` (absent = none) and `start.enemies`,
 * begin with `start.positions`, then re-apply `script` (a `move` through the reposition seam). `hpAtStart` is read
 * right after begin, before the first call (CA-10). Returns every event emitted on the new Runtime.
 */
function rebuild(operation: string, storedPackJson: string, rec: Pick<Recording, 'start' | 'script'>): { outcome: Outcome<Rebuilt>; events: RuntimeEvent[] } {
  const events: RuntimeEvent[] = [];
  const gate = openPack(storedPackJson, operation);
  if (!gate.ok) return { outcome: gate, events };
  const rt = gate.runtime;
  const ally = restore(rt, rec.start.ally.snapshot);
  if (!ally.ok) return { outcome: ally, events };
  const profile = allyProfile(rt, ally.value, rec.start.ally.id);
  if (!profile.ok) return { outcome: profile, events };

  const off = subscribe(rt, (e) => events.push(e));
  try {
    // A spatial pack without `start.positions` is the library's refusal, never guessed (CA-14).
    const live = begin(rt, profile.value, rec.start.enemies, rec.start.positions, rec.start.allySpawns ?? []);
    if (!live.ok) return { outcome: live, events };
    const hpAtStart = Object.fromEntries(Object.values(live.value.fight.state.combatants).map((c) => [c.id, c.hp.current]));
    // A call that now fails (e.g. a declare after the fight ended) is left to show up as an event difference.
    for (const entry of rec.script) perform(live.value, entry);
    return { outcome: { ok: true, value: { live: live.value, hpAtStart } }, events };
  } catch (e) {
    return { outcome: { ok: false, error: toAppError(operation, e) }, events };
  } finally {
    off();
  }
}

/**
 * FR-14b (database.md replay rule): re-roll → pack divergence, else rebuild the fight on the stored pack and
 * compare events index by index. Ids used twice across both sides are `begin`'s refusal (CA-05), returned as
 * `error`. A world with null params or a record without `script` is unavailable. Returns the replayed events too.
 */
export function replay(
  meta: Pick<WorldMeta, 'theme' | 'seed' | 'knobs'>,
  storedPackJson: string,
  rec: Partial<Recording>,
): { result: ReplayResult; events: RuntimeEvent[] } {
  if (!rec.script || !rec.start || !rec.events) return { result: { status: 'unavailable', reason: NO_SCRIPT }, events: [] };
  const rerun = rerunSameSeed(meta, storedPackJson);
  if (rerun.status === 'unavailable' || rerun.status === 'error') return { result: rerun, events: [] };
  if (rerun.status === 'fail') return { result: { status: 'diverged', stage: 'pack' }, events: [] };

  const { outcome, events } = rebuild('replay', storedPackJson, { start: rec.start, script: rec.script });
  if (!outcome.ok) return { result: { status: 'error', error: outcome.error }, events };
  const index = firstDifference(rec.events, events);
  if (index === -1) return { result: { status: 'complete' }, events };
  return { result: { status: 'diverged', stage: 'events', index, expected: rec.events[index], actual: events[index] }, events };
}

/**
 * FR-14 resume (CX-D6, CA-09/10): the replay rebuild on the stored pack bytes — no re-roll, so imported worlds
 * resume too. Only when every re-applied event equals the record is the rebuilt fight returned (`resumed`), with
 * its events and begin-time hp; otherwise the first divergent index, and nothing is handed over. A record without
 * `script`/`start`/`events` is unavailable; a spatial record without `start.positions` is the library's refusal.
 */
export function resume(storedPackJson: string, rec: Partial<Recording>): ResumeResult {
  if (!rec.script || !rec.start || !rec.events) return { status: 'unavailable', reason: NO_SCRIPT };
  const { outcome, events } = rebuild('resume', storedPackJson, { start: rec.start, script: rec.script });
  if (!outcome.ok) return { status: 'error', error: outcome.error };
  const index = firstDifference(rec.events, events);
  if (index !== -1) return { status: 'diverged', index, expected: rec.events[index], actual: events[index] };
  return { status: 'resumed', live: outcome.value.live, events, hpAtStart: outcome.value.hpAtStart };
}
