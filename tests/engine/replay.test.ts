import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { serializeCombat, type PendingTrigger } from 'ruleswright/runtime';
import { describe, expect, it } from 'vitest';
import { begin, perform, subscribe, type LiveFight, type Position, type RuntimeEvent, type ScriptEntry, type SpawnSpec } from '../../src/renderer/src/engine/combat';
import { allyProfile } from '../../src/renderer/src/engine/combat-profile';
import { recordingOf, replay, resume, type Declaration, type Recording } from '../../src/renderer/src/engine/replay';
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

type Recorded = Recording & { eventsBeforeMove: number; hpAtStart: Record<string, number>; pending: PendingTrigger[] };

/**
 * Record a fight exactly as the combat store does: snapshot, profile, subscribe, begin with the default
 * layout, script — to combat-over, or until `until` holds (a mid-fight record). With `moveAfter`, one `move` to
 * SHIFTED is issued at the first quiet `awaiting-declare` after that many calls; `eventsBeforeMove` counts the
 * events recorded before it. `hpAtStart` is read right after begin; `pending` are the offers open at record time.
 */
function recordFight(
  moveAfter?: number,
  fightOf: { enemies: typeof ENEMIES; positions: Record<string, Position>; allySpawns?: SpawnSpec[] } = { enemies: ENEMIES, positions: POSITIONS },
  until?: (live: LiveFight, script: readonly ScriptEntry[]) => boolean,
): Recorded {
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
  const hpAtStart = Object.fromEntries(Object.values(live.fight.state.combatants).map((c) => [c.id, c.hp.current]));
  const script: ScriptEntry[] = [];
  const declarations: Declaration[] = [];
  let tried = 0;
  let eventsBeforeMove = -1;
  for (let calls = 0; live.fight.state.phase !== 'combat-over' && !until?.(live, script) && calls < 2000; calls += 1) {
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
  if (until) expect(until(live, script)).toBe(true);
  else expect(live.fight.state.phase).toBe('combat-over');
  if (moveAfter !== undefined) expect(eventsBeforeMove).toBeGreaterThan(0);
  // What the file holds: the recording after a JSON round trip.
  const rec = JSON.parse(JSON.stringify(recordingOf(live.fight, start, script, events, declarations))) as Recording;
  return { ...rec, eventsBeforeMove, hpAtStart, pending: JSON.parse(JSON.stringify(live.fight.pendingTriggers)) };
}

/** Mid-fight, after the move: a trigger offer is open (a wight's `attack:rolled` at the warden → `parry`). */
const offerOpenAfterMove = (live: LiveFight, script: readonly ScriptEntry[]) =>
  script.some((e) => e.op === 'move') && live.fight.pendingTriggers.length > 0;

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

describe('resume (FR-14, CA-09, CA-10)', () => {
  it('CA-09: a mid-fight record with a move and an open offer resumes to the same fight — snapshot, rng, positions, offers, events', () => {
    const rec = recordFight(6, undefined, offerOpenAfterMove);
    expect(rec.pending.map((p) => p.triggerId)).toContain('brynn.parry');
    const r = resume(PACK_JSON, rec);
    if (r.status !== 'resumed') throw new Error(`expected resumed, got ${JSON.stringify(r)}`);
    const snapshot = JSON.parse(JSON.stringify(serializeCombat(r.live.fight, { pairsWith: rec.start.ally.id })));
    expect(snapshot).toEqual(rec.combat);
    expect(snapshot.rng).toEqual(rec.combat.rng);
    expect(Object.fromEntries(Object.values(r.live.fight.state.combatants).map((c) => [c.id, c.position]))).toEqual(SHIFTED);
    expect(JSON.parse(JSON.stringify(r.live.fight.pendingTriggers))).toEqual(rec.pending);
    expect(JSON.stringify(r.events)).toBe(JSON.stringify(rec.events));
    expect(r.live.sides.allies.map((a) => a.id)).toEqual(['brynn']);
    expect(r.live.sides.enemies.map((e) => e.id)).toEqual(ENEMIES.map((e) => e.instanceId));
  });

  it('CA-10: hpAtStart is the begin-time hp, not the record-time hp', () => {
    const rec = recordFight(6, undefined, offerOpenAfterMove);
    const r = resume(PACK_JSON, rec);
    if (r.status !== 'resumed') throw new Error('expected resumed');
    expect(r.hpAtStart).toEqual(rec.hpAtStart);
    const now = Object.fromEntries(Object.values(r.live.fight.state.combatants).map((c) => [c.id, c.hp.current]));
    expect(now).not.toEqual(rec.hpAtStart);
  });

  it('the resumed fight continues: finishing it and recording the whole script replays complete', () => {
    const rec = recordFight(6, undefined, offerOpenAfterMove);
    const r = resume(PACK_JSON, rec);
    if (r.status !== 'resumed') throw new Error('expected resumed');
    const events = [...r.events];
    const off = subscribe(r.live.fight.runtime, (e) => events.push(e));
    const script = [...rec.script];
    let tried = 0;
    for (let calls = 0; r.live.fight.state.phase !== 'combat-over' && calls < 2000; calls += 1) {
      const entry = nextEntry(r.live, tried);
      const out = value(perform(r.live, entry));
      script.push(entry);
      if (entry.op === 'declare') tried = (out as { rejection: unknown }).rejection === null ? 0 : tried + 1;
      else if (entry.op === 'step') tried = 0;
    }
    off();
    expect(r.live.fight.state.phase).toBe('combat-over');
    const whole = JSON.parse(JSON.stringify(recordingOf(r.live.fight, rec.start, script, events, rec.declarations))) as Recording;
    expect(replay(META, PACK_JSON, whole)).toEqual({ result: { status: 'complete' }, events: whole.events });
  });

  it('an ally-spawn record resumes with the spawn on the allies side (the board reads live.sides)', () => {
    const rec = recordFight(undefined, SPIDER_FIGHT, (_live, script) => script.length >= 3);
    const r = resume(PACK_JSON, rec);
    if (r.status !== 'resumed') throw new Error('expected resumed');
    expect(r.live.sides.allies.map((a) => a.id)).toEqual(['brynn', 'hill-spider-1']);
    expect(JSON.parse(JSON.stringify(serializeCombat(r.live.fight, { pairsWith: 'brynn' })))).toEqual(rec.combat);
  });

  it('a tampered move → diverged at the first event after it, nothing handed over', () => {
    const rec = recordFight(6, undefined, offerOpenAfterMove);
    const far = Object.fromEntries(Object.keys(SHIFTED).map((id, i) => [id, { x: i * 10, y: 0 }]));
    const script = rec.script.map((e) => (e.op === 'move' ? { op: 'move' as const, positions: far } : e));
    const r = resume(PACK_JSON, { ...rec, script });
    expect(r).toMatchObject({ status: 'diverged', index: rec.eventsBeforeMove, expected: rec.events[rec.eventsBeforeMove] });
    expect(r).not.toHaveProperty('live');
    if (r.status === 'diverged') expect(r.actual?.type).toBe('declare:rejected');
  });

  it('a record without script, start or events → unavailable with the replay reason text', () => {
    const rec = recordFight(undefined, undefined, (_live, script) => script.length >= 4);
    const { script: _s, ...noScript } = rec;
    const { start: _t, ...noStart } = rec;
    const { events: _e, ...noEvents } = rec;
    const reason = 'record has no replay script (recorded before B-2)';
    for (const legacy of [noScript, noStart, noEvents]) expect(resume(PACK_JSON, legacy)).toEqual({ status: 'unavailable', reason });
    expect(replay(META, PACK_JSON, noScript).result).toEqual({ status: 'unavailable', reason });
  });

  it('a spatial-pack record without start.positions → error carrying the library E-SPAT-01 cards', () => {
    const rec = recordFight(undefined, undefined, (_live, script) => script.length >= 4);
    const { positions: _p, ...start } = rec.start;
    const r = resume(PACK_JSON, { ...rec, start });
    expect(r).toMatchObject({ status: 'error', error: { kind: 'library', operation: 'fight:begin' } });
    if (r.status === 'error' && r.error.kind === 'library') expect(r.error.cards.every((c) => c.rule === 'E-SPAT-01')).toBe(true);
  });
});
