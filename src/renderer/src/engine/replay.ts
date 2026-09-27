/**
 * Record & replay (FR-14b, CA-09): a recording is the fight's start, every host call and every event;
 * replay re-rolls the pack from the world's stored params (CA-12 path), rebuilds the fight on a new
 * Runtime, re-applies the script and points at the first event that differs. Never guesses.
 */
import { serializeCombat } from 'ruleswright/runtime';
import type { WorldMeta } from '../../../shared/model';
import { begin, perform, subscribe, type Combat, type CombatSnapshot, type DeclareOptions, type FightStart, type RuntimeEvent, type ScriptEntry } from './combat';
import { allyProfile } from './combat-profile';
import { rerunSameSeed } from './determinism';
import { toAppError, type AppError } from './errors';
import { restore } from './runtime';
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

/**
 * FR-14b (database.md replay rule): re-roll → pack divergence, else restore the ally into a fresh Runtime,
 * re-derive its profile (B-1), spawn `start.enemies`, begin with `start.positions`, re-apply `script` (a `move`
 * through the reposition seam) and compare events index by index.
 * A world with null params or a record without `script` is unavailable. Returns the replayed events too.
 */
export function replay(
  meta: Pick<WorldMeta, 'theme' | 'seed' | 'knobs'>,
  storedPackJson: string,
  rec: Partial<Recording>,
): { result: ReplayResult; events: RuntimeEvent[] } {
  const events: RuntimeEvent[] = [];
  if (!rec.script || !rec.start || !rec.events) {
    return { result: { status: 'unavailable', reason: 'record has no replay script (recorded before B-2)' }, events };
  }
  const rerun = rerunSameSeed(meta, storedPackJson);
  if (rerun.status === 'unavailable' || rerun.status === 'error') return { result: rerun, events };
  if (rerun.status === 'fail') return { result: { status: 'diverged', stage: 'pack' }, events };

  const gate = openPack(storedPackJson, 'replay');
  if (!gate.ok) return { result: { status: 'error', error: gate.error }, events };
  const rt = gate.runtime;
  const ally = restore(rt, rec.start.ally.snapshot);
  if (!ally.ok) return { result: { status: 'error', error: ally.error }, events };
  const profile = allyProfile(rt, ally.value, rec.start.ally.id);
  if (!profile.ok) return { result: { status: 'error', error: profile.error }, events };

  const off = subscribe(rt, (e) => events.push(e));
  try {
    // A spatial pack without `start.positions` is the library's refusal, never guessed (CA-14).
    const live = begin(rt, profile.value, rec.start.enemies, rec.start.positions);
    if (!live.ok) return { result: { status: 'error', error: live.error }, events };
    // A call that now fails (e.g. a declare after the fight ended) is left to show up as an event difference.
    for (const entry of rec.script) perform(live.value, entry);
  } catch (e) {
    return { result: { status: 'error', error: toAppError('replay', e) }, events };
  } finally {
    off();
  }

  const index = firstDifference(rec.events, events);
  if (index === -1) return { result: { status: 'complete' }, events };
  return { result: { status: 'diverged', stage: 'events', index, expected: rec.events[index], actual: events[index] }, events };
}
