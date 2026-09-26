import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { describe, expect, it } from 'vitest';
import { begin, perform, subscribe, type Combat, type RuntimeEvent, type ScriptEntry } from '../../src/renderer/src/engine/combat';
import { allyProfile } from '../../src/renderer/src/engine/combat-profile';
import { recordingOf, replay, type Declaration, type Recording } from '../../src/renderer/src/engine/replay';
import { create, serialize, type Outcome } from '../../src/renderer/src/engine/runtime';
import { openPack } from '../../src/renderer/src/engine/schema';

const META = { theme: 'dark-fantasy', seed: 42, knobs: {} };
const PACK_JSON = JSON.stringify(generateCampaign({ theme: loadTheme(META.theme), seed: META.seed, knobs: META.knobs }));
const ENEMIES = [
  { statblockId: 'barrow-wight', instanceId: 'barrow-wight-1' },
  { statblockId: 'barrow-wight', instanceId: 'barrow-wight-2' },
];

function value<T>(r: Outcome<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

function nextEntry(fight: Combat, tried: number): ScriptEntry {
  const { combatants, order, active, phase } = fight.state;
  const offer = fight.pendingTriggers[0];
  if (offer) return { op: 'respond', triggerId: offer.triggerId, choice: 'decline' };
  const side = (id: string) => combatants[id]?.side;
  const targetId = order.find((o) => side(o) !== side(active) && (combatants[o]?.hp.current ?? 0) > 0);
  const actionId = combatants[active]?.actions[tried];
  if (phase === 'awaiting-declare' && actionId !== undefined) return { op: 'declare', actionId, targetId };
  return { op: 'step' };
}

/** Record a full fight exactly as the combat store does: snapshot, profile, subscribe, begin, script. */
function recordFight(): Recording {
  const gate = openPack(PACK_JSON);
  if (!gate.ok) throw new Error('gate rejected a forged pack');
  const rt = gate.runtime;
  const brynn = value(create(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }));
  const start = { ally: { id: 'brynn', snapshot: serialize(rt, brynn) }, enemies: ENEMIES };
  const ally = value(allyProfile(rt, brynn, 'brynn'));
  const events: RuntimeEvent[] = [];
  const off = subscribe(rt, (e) => events.push(e));
  const fight = value(begin(rt, ally, ENEMIES));
  const script: ScriptEntry[] = [];
  const declarations: Declaration[] = [];
  let tried = 0;
  for (let calls = 0; fight.state.phase !== 'combat-over' && calls < 2000; calls += 1) {
    const entry = nextEntry(fight, tried);
    const combatantId = fight.state.active;
    const r = value(perform(fight, entry));
    script.push(entry);
    if (entry.op === 'declare') {
      declarations.push({ combatantId, action: entry.actionId, options: entry.targetId === undefined ? {} : { targetId: entry.targetId } });
      tried = (r as { rejection: unknown }).rejection === null ? 0 : tried + 1;
    } else if (entry.op === 'step') tried = 0;
  }
  off();
  expect(fight.state.phase).toBe('combat-over');
  // What the file holds: the recording after a JSON round trip.
  return JSON.parse(JSON.stringify(recordingOf(fight, start, script, events, declarations))) as Recording;
}

describe('recordingOf', () => {
  it('holds start, script, events, the declare calls and the combat envelope paired with the ally', () => {
    const rec = recordFight();
    expect(rec.start.ally.snapshot).toMatchObject({ kind: 'character' });
    expect(rec.events[0]?.type).toBe('combat:start');
    expect(rec.declarations).toHaveLength(rec.script.filter((e) => e.op === 'declare').length);
    expect(rec.combat).toMatchObject({ kind: 'combat', pairsWith: 'brynn' });
    expect(Object.keys(rec.combat.rng).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('replay (database.md replay rule, CA-09)', () => {
  it('re-applies the recorded script on a fresh runtime → complete, with identical events', () => {
    const rec = recordFight();
    const { result, events } = replay(META, PACK_JSON, rec);
    expect(result).toEqual({ status: 'complete' });
    expect(JSON.stringify(events)).toBe(JSON.stringify(rec.events));
  });

  it('two swapped script entries → diverged at the first differing event index', () => {
    const rec = recordFight();
    const [a, b, ...rest] = rec.script;
    if (!a || !b) throw new Error('short script');
    const swapped = { ...rec, script: [b, a, ...rest] };
    const { result, events } = replay(META, PACK_JSON, swapped);
    const expected = rec.events.findIndex((e, i) => JSON.stringify(e) !== JSON.stringify(events[i]));
    expect(expected).toBeGreaterThan(0);
    expect(result).toMatchObject({ status: 'diverged', stage: 'events', index: expected });
    if (result.status === 'diverged' && result.stage === 'events') expect(result.expected).toEqual(rec.events[expected]);
  });

  it('negative control: one recorded event altered → diverged exactly there', () => {
    const rec = recordFight();
    const events = rec.events.map((e, i) => (i === 5 ? { ...e, why: { ...e.why, rule: 'tampered' } } : e));
    expect(replay(META, PACK_JSON, { ...rec, events }).result).toMatchObject({ status: 'diverged', stage: 'events', index: 5 });
  });

  it('one altered byte of the stored pack → diverged at stage pack, before any combat', () => {
    const rec = recordFight();
    const at = PACK_JSON.indexOf('barrow-wight');
    const altered = `${PACK_JSON.slice(0, at)}B${PACK_JSON.slice(at + 1)}`;
    expect(replay(META, altered, rec)).toEqual({ result: { status: 'diverged', stage: 'pack' }, events: [] });
  });

  it('null params, or a record without script, is unavailable — never guessed', () => {
    const rec = recordFight();
    expect(replay({ theme: null, seed: null, knobs: null }, PACK_JSON, rec).result).toMatchObject({ status: 'unavailable' });
    const { script: _s, ...legacy } = rec;
    expect(replay(META, PACK_JSON, legacy).result).toMatchObject({ status: 'unavailable' });
  });
});
