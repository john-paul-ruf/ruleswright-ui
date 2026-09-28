import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { describe, expect, it } from 'vitest';
import { begin, perform, subscribe, type LiveFight, type Position, type RuntimeEvent, type ScriptEntry, type SpawnSpec } from '../../src/renderer/src/engine/combat';
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
/** CX-D9 default layout for Brynn + ENEMIES (host input; the library judges it). */
const POSITIONS: Record<string, Position> = { brynn: { x: 0, y: 0 }, 'barrow-wight-1': { x: 1, y: 0 }, 'barrow-wight-2': { x: 1, y: 1 } };
/** Brynn + a hill-spider ally spawn vs one barrow-wight, CX-D9 layout (CA-04b). */
const SPIDER: SpawnSpec[] = [{ statblockId: 'hill-spider', instanceId: 'hill-spider-1' }];
const SPIDER_FIGHT = {
  enemies: ENEMIES.slice(0, 1),
  positions: { brynn: { x: 0, y: 0 }, 'hill-spider-1': { x: 0, y: 1 }, 'barrow-wight-1': { x: 1, y: 0 } },
  allySpawns: SPIDER,
};
/** The same relative layout two squares over: every melee stays legal. */
const SHIFTED: Record<string, Position> = { brynn: { x: 2, y: 0 }, 'barrow-wight-1': { x: 3, y: 0 }, 'barrow-wight-2': { x: 3, y: 1 } };

function value<T>(r: Outcome<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

function nextEntry({ fight }: LiveFight, tried: number): ScriptEntry {
  const { combatants, order, active, phase } = fight.state;
  const offer = fight.pendingTriggers[0];
  if (offer) return { op: 'respond', triggerId: offer.triggerId, choice: 'decline' };
  const side = (id: string) => combatants[id]?.side;
  const targetId = order.find((o) => side(o) !== side(active) && (combatants[o]?.hp.current ?? 0) > 0);
  const actionId = combatants[active]?.actions[tried];
  if (phase === 'awaiting-declare' && actionId !== undefined) return { op: 'declare', actionId, targetId };
  return { op: 'step' };
}

/**
 * Record a full fight exactly as the combat store does: snapshot, profile, subscribe, begin with the default
 * layout, script. With `moveAfter`, one `move` to SHIFTED is issued at the first quiet `awaiting-declare`
 * after that many calls; `eventsBeforeMove` counts the events recorded before it.
 */
function recordFight(
  moveAfter?: number,
  fightOf: { enemies: typeof ENEMIES; positions: Record<string, Position>; allySpawns?: SpawnSpec[] } = { enemies: ENEMIES, positions: POSITIONS },
): Recording & { eventsBeforeMove: number } {
  const gate = openPack(PACK_JSON);
  if (!gate.ok) throw new Error('gate rejected a forged pack');
  const rt = gate.runtime;
  const brynn = value(create(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }));
  const { enemies, positions, allySpawns } = fightOf;
  const start = { ally: { id: 'brynn', snapshot: serialize(rt, brynn) }, enemies, positions, ...(allySpawns ? { allySpawns } : {}) };
  const ally = value(allyProfile(rt, brynn, 'brynn'));
  const events: RuntimeEvent[] = [];
  const off = subscribe(rt, (e) => events.push(e));
  const live = value(begin(rt, ally, enemies, positions, allySpawns));
  const script: ScriptEntry[] = [];
  const declarations: Declaration[] = [];
  let tried = 0;
  let eventsBeforeMove = -1;
  for (let calls = 0; live.fight.state.phase !== 'combat-over' && calls < 2000; calls += 1) {
    const quiet = live.fight.state.phase === 'awaiting-declare' && live.fight.pendingTriggers.length === 0;
    const moveNow = moveAfter !== undefined && eventsBeforeMove === -1 && calls >= moveAfter && quiet;
    const entry: ScriptEntry = moveNow ? { op: 'move', positions: SHIFTED } : nextEntry(live, tried);
    if (moveNow) eventsBeforeMove = events.length;
    const combatantId = live.fight.state.active;
    const r = value(perform(live, entry));
    script.push(entry);
    if (entry.op === 'declare') {
      declarations.push({ combatantId, action: entry.actionId, options: entry.targetId === undefined ? {} : { targetId: entry.targetId } });
      tried = (r as { rejection: unknown }).rejection === null ? 0 : tried + 1;
    } else if (entry.op === 'step') tried = 0;
  }
  off();
  expect(live.fight.state.phase).toBe('combat-over');
  if (moveAfter !== undefined) expect(eventsBeforeMove).toBeGreaterThan(0);
  // What the file holds: the recording after a JSON round trip.
  const rec = JSON.parse(JSON.stringify(recordingOf(live.fight, start, script, events, declarations))) as Recording;
  return { ...rec, eventsBeforeMove };
}

describe('recordingOf', () => {
  it('holds start, script, events, the declare calls and the combat envelope paired with the ally', () => {
    const rec = recordFight();
    expect(rec.start.ally.snapshot).toMatchObject({ kind: 'character' });
    expect(rec.events[0]?.type).toBe('combat:start');
    expect(rec.declarations).toHaveLength(rec.script.filter((e) => e.op === 'declare').length);
    expect(rec.combat).toMatchObject({ kind: 'combat', pairsWith: 'brynn' });
    expect(Object.keys(rec.combat.rng).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(rec.start.positions).toEqual(POSITIONS);
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

  it('a recorded move replays through the reposition seam → complete; declarations exclude it', () => {
    const rec = recordFight(6);
    expect(rec.script.filter((e) => e.op === 'move')).toEqual([{ op: 'move', positions: SHIFTED }]);
    expect(rec.declarations).toHaveLength(rec.script.filter((e) => e.op === 'declare').length);
    expect(rec.combat.combatants.map((c) => [c.id, c.position])).toEqual(expect.arrayContaining(Object.entries(SHIFTED)));
    const { result, events } = replay(META, PACK_JSON, rec);
    expect(result).toEqual({ status: 'complete' });
    expect(JSON.stringify(events)).toBe(JSON.stringify(rec.events));
  });

  it('a tampered move (far apart) → diverged at the first event after it: a rejection instead of the recorded call', () => {
    const rec = recordFight(6);
    const far = Object.fromEntries(Object.keys(SHIFTED).map((id, i) => [id, { x: i * 10, y: 0 }]));
    const script = rec.script.map((e) => (e.op === 'move' ? { op: 'move' as const, positions: far } : e));
    const { result } = replay(META, PACK_JSON, { ...rec, script });
    expect(result).toMatchObject({ status: 'diverged', stage: 'events', index: rec.eventsBeforeMove });
    if (result.status === 'diverged' && result.stage === 'events') {
      expect(result.expected).toEqual(rec.events[rec.eventsBeforeMove]);
      expect(result.actual?.type).toBe('declare:rejected');
    }
  });

  it('a spatial-pack record without start.positions → error carrying the library E-SPAT-01 cards, never guessed', () => {
    const rec = recordFight();
    const { positions: _p, ...start } = rec.start;
    const { result } = replay(META, PACK_JSON, { ...rec, start });
    expect(result).toMatchObject({ status: 'error', error: { kind: 'library', operation: 'fight:begin' } });
    if (result.status === 'error' && result.error.kind === 'library') {
      expect(result.error.cards.length).toBeGreaterThan(0);
      expect(result.error.cards.every((c) => c.rule === 'E-SPAT-01')).toBe(true);
    }
  });

  it('CA-04b: a record with an ally spawn replays complete; without start.allySpawns it no longer matches', () => {
    const rec = recordFight(undefined, SPIDER_FIGHT);
    expect(rec.start.allySpawns).toEqual(SPIDER);
    expect(rec.events[0]?.payload.order).toContain('hill-spider-1');
    const { result, events } = replay(META, PACK_JSON, rec);
    expect(result).toEqual({ status: 'complete' });
    expect(JSON.stringify(events)).toBe(JSON.stringify(rec.events));
    const { allySpawns: _a, ...start } = rec.start;
    expect(replay(META, PACK_JSON, { ...rec, start }).result.status).not.toBe('complete');
  });

  it('CA-06: a record without allySpawns (every pre-CX record) replays exactly as before', () => {
    const rec = recordFight();
    expect(rec.start).not.toHaveProperty('allySpawns');
    expect(replay(META, PACK_JSON, rec).result).toEqual({ status: 'complete' });
  });

  it('CA-05: a record whose ids collide across sides → error, never begun', () => {
    const rec = recordFight(undefined, SPIDER_FIGHT);
    const start = { ...rec.start, allySpawns: [{ statblockId: 'hill-spider', instanceId: 'barrow-wight-1' }] };
    const { result, events } = replay(META, PACK_JSON, { ...rec, start });
    expect(result).toMatchObject({ status: 'error', error: { kind: 'unexpected', operation: 'fight:begin' } });
    if (result.status === 'error' && result.error.kind === 'unexpected') expect(result.error.message).toContain('"barrow-wight-1" is used twice');
    expect(events).toEqual([]);
  });

  it('null params, or a record without script, is unavailable — never guessed', () => {
    const rec = recordFight();
    expect(replay({ theme: null, seed: null, knobs: null }, PACK_JSON, rec).result).toMatchObject({ status: 'unavailable' });
    const { script: _s, ...legacy } = rec;
    expect(replay(META, PACK_JSON, legacy).result).toMatchObject({ status: 'unavailable' });
  });
});
