import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { assemble, begin, perform, subscribe, type Combat, type Position, type RuntimeEvent, type ScriptEntry } from '../../src/renderer/src/engine/combat';
import { allyProfile } from '../../src/renderer/src/engine/combat-profile';
import { recordingOf } from '../../src/renderer/src/engine/replay';
import { restore, serialize } from '../../src/renderer/src/engine/runtime';
import { openPack } from '../../src/renderer/src/engine/schema';
import { setPersistence } from '../../src/renderer/src/persistence/client';
import { createCharacterStore } from '../../src/renderer/src/store/character';
import { createCombatStore, initiativeOf, offerEvents, roundsOf, typesOf, visibleLog } from '../../src/renderer/src/store/combat';
import { createWorldsStore } from '../../src/renderer/src/store/worlds';
import { createInProcessBridge } from '../support/in-process-bridge';
import { makeTmpDir } from '../support/tmp';

const KNOBS = { threat: 'medium', 'spell-density': 3, grittiness: 'heroic', 'demihuman-caps': 'on' };
const BRYNN = { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] };
/** CX-D9 for Brynn + two barrow-wights: allies x=0, enemies x=1, y = index in its own side. */
const CX_D9: Record<string, Position> = { brynn: { x: 0, y: 0 }, 'barrow-wight-1': { x: 1, y: 0 }, 'barrow-wight-2': { x: 1, y: 1 } };

let cleanup: () => void;
let root: string;

beforeEach(() => {
  const tmp = makeTmpDir('combat-store-');
  cleanup = tmp.cleanup;
  root = tmp.dir;
  setPersistence(createInProcessBridge(tmp.dir));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

async function setup() {
  const worlds = createWorldsStore();
  expect(await worlds.getState().forge({ themeId: 'dark-fantasy', seed: 42, knobs: KNOBS })).toBe(true);
  const chars = createCharacterStore(worlds);
  expect(chars.getState().create(BRYNN)).toBe(true);
  const store = createCombatStore(worlds, chars);
  return { worlds, chars, store };
}

/** Same policy as the engine test: offers first (decline), else the active's k-th action at its first standing foe, else step. */
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

describe('combat store over the real library', () => {
  it('builds the enemy roster with `${statblockId}-${n}` ids, reusing the smallest free n', async () => {
    const { store } = await setup();
    expect(store.getState().begin()).toBe(false);
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('hill-spider');
    store.getState().removeEnemy('barrow-wight-1');
    store.getState().addEnemy('barrow-wight');
    expect(store.getState().enemies.map((e) => e.instanceId)).toEqual(['barrow-wight-2', 'hill-spider-1', 'barrow-wight-1']);
  });

  it('records start + script and logs every event; the log equals eventsSince(0) minus what preceded begin, at every call', async () => {
    const { worlds, chars, store } = await setup();
    const active = worlds.getState().active;
    const character = chars.getState().character;
    if (!active || !character) throw new Error('setup');
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    const snapshotBefore = serialize(active.runtime, character);
    const before = active.runtime.events.sinceRound(0).length;

    expect(store.getState().begin()).toBe(true);
    const s0 = store.getState();
    expect(s0.start).toEqual({ ally: { id: 'brynn', snapshot: snapshotBefore }, enemies: s0.enemies, positions: CX_D9 });
    expect(s0.state?.phase).toBe('awaiting-declare');
    expect(s0.log[0]?.type).toBe('combat:start');

    let tried = 0;
    let calls = 0;
    let sawOffers = false;
    while (!store.getState().over && calls < 2000) {
      const { fight } = store.getState();
      if (!fight) throw new Error('fight lost');
      const entry = nextEntry(fight, tried);
      if (entry.op === 'respond') {
        sawOffers = true;
        const fired = offerEvents(store.getState().pending, store.getState().log);
        fired.forEach((e, i) => expect(e?.payload.triggerId).toBe(store.getState().pending[i]?.triggerId));
        store.getState().respond(entry.triggerId, entry.choice);
      } else if (entry.op === 'declare') {
        store.getState().declare(entry.actionId, entry.targetId);
        tried = store.getState().rejection ? tried + 1 : 0;
      } else {
        store.getState().step();
        tried = 0;
      }
      calls += 1;
      expect(store.getState().error).toBeNull();
      expect(store.getState().log.length).toBe(fight.eventsSince(0).length - before);
      expect(store.getState().pending).toEqual(fight.pendingTriggers);
    }
    const done = store.getState();
    expect(done.over).toBe(true);
    expect(sawOffers).toBe(true);
    expect(done.script).toHaveLength(calls);
    expect(done.log.filter((e) => e.type === 'combat:ended')).toHaveLength(1);

    // Re-issuing `script` against a fresh fight built from `start` gives an identical event array.
    const gate = openPack(active.packJson);
    if (!gate.ok || !done.start) throw new Error('reopen');
    const rt = gate.runtime;
    const restored = restore(rt, done.start.ally.snapshot);
    if (!restored.ok) throw new Error('restore');
    const ally = allyProfile(rt, restored.value, done.start.ally.id);
    if (!ally.ok) throw new Error('ally');
    const events: RuntimeEvent[] = [];
    const off = subscribe(rt, (e) => events.push(e));
    const fresh = begin(rt, ally.value, done.start.enemies, done.start.positions);
    if (!fresh.ok) throw new Error('begin');
    for (const entry of done.script) perform(fresh.value, entry);
    off();
    expect(JSON.stringify(events)).toBe(JSON.stringify(done.log));
  });

  it('a rejected declare is recorded, shows its event, leaves state unchanged; the next accepted call clears it', async () => {
    const { store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    store.getState().begin();
    const state = store.getState().state;
    store.getState().declare('no-such-action');
    const s = store.getState();
    expect(s.rejection?.type).toBe('declare:rejected');
    expect(s.log.at(-1)).toEqual(s.rejection);
    expect(s.script).toEqual([{ op: 'declare', actionId: 'no-such-action' }]);
    expect(s.state).toEqual(state);
    store.getState().step();
    expect(store.getState().rejection).toBeNull();
  });

  it('filters are pure selectors over the log', async () => {
    const { store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().begin();
    for (let i = 0; i < 40 && !store.getState().over; i += 1) {
      const { fight } = store.getState();
      if (!fight) break;
      const entry = nextEntry(fight, 0);
      if (entry.op === 'declare') store.getState().declare(entry.actionId, entry.targetId);
      else if (entry.op === 'respond') store.getState().respond(entry.triggerId, entry.choice);
      else store.getState().step();
    }
    const log = store.getState().log;
    const copy = structuredClone(log);
    const rounds = roundsOf(log);
    expect(rounds.length).toBeGreaterThan(1);
    const last = rounds.at(-1) as number;
    const kept = visibleLog(log, { round: last, type: 'all' });
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((e) => e.at.round === last)).toBe(true);
    expect(kept.length).toBe(log.filter((e) => e.at.round === last).length);
    const type = typesOf(log)[0] as string;
    expect(visibleLog(log, { round: 'all', type }).every((e) => e.type === type)).toBe(true);
    expect(visibleLog(log, { round: 'all', type: 'all' })).toEqual(log);
    expect(log).toEqual(copy);
  });

  it('a world change ends the fight, clears the roster and stops listening to the old runtime', async () => {
    const { worlds, store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().addAllySpawn('hill-spider');
    store.getState().begin();
    const old = store.getState().fight;
    expect(await worlds.getState().forge({ themeId: 'dark-fantasy', seed: 43, knobs: KNOBS })).toBe(true);
    const s = store.getState();
    expect([s.fight, s.state, s.start, s.enemies, s.allySpawns, s.log, s.script]).toEqual([null, null, null, [], [], [], []]);
    old?.step();
    expect(store.getState().log).toEqual([]);
  });
});

describe('record & replay through the store (CAP-10 producer)', () => {
  it('records the finished fight, replays it complete, and marks a tampered record diverged on disk', async () => {
    const { worlds, store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    store.getState().begin();
    let tried = 0;
    for (let calls = 0; !store.getState().over && calls < 2000; calls += 1) {
      const fight = store.getState().fight as Combat;
      const entry = nextEntry(fight, tried);
      if (entry.op === 'declare') {
        store.getState().declare(entry.actionId, entry.targetId);
        tried = store.getState().rejection ? tried + 1 : 0;
      } else if (entry.op === 'respond') store.getState().respond(entry.triggerId, entry.choice);
      else {
        store.getState().step();
        tried = 0;
      }
    }
    const s = store.getState();
    expect(s.declarations).toHaveLength(s.script.filter((e) => e.op === 'declare').length);
    expect(await store.getState().record('barrow watch')).toBe(true);
    const [meta] = store.getState().records;
    const fight = s.fight as Combat;
    expect(meta).toMatchObject({ name: 'barrow watch', outcome: 'complete', eventCount: s.log.length, round: fight.state.round });
    expect(meta?.rng).toEqual(fight.state.rng);

    await store.getState().replay('barrow watch');
    expect(store.getState().replayed?.result).toEqual({ status: 'complete' });

    const worldId = worlds.getState().active?.meta.id as string;
    const file = join(root, 'fights', worldId, 'barrow watch.json');
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    const [a, b, ...rest] = doc.script;
    writeFileSync(file, JSON.stringify({ ...doc, script: [b, a, ...rest] }));
    await store.getState().replay('barrow watch');
    expect(store.getState().replayed?.result).toMatchObject({ status: 'diverged', stage: 'events' });
    expect(store.getState().records[0]?.outcome).toBe('diverged');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ ...doc, script: [b, a, ...rest], outcome: 'diverged' });
  });
});

type Store = Awaited<ReturnType<typeof setup>>['store'];

/** Drive the store with the test policy until `done` or combat-over (bounded). */
function drive(store: Store, done: () => boolean = () => false, limit = 2000) {
  let tried = 0;
  for (let calls = 0; !store.getState().over && !done() && calls < limit; calls += 1) {
    const entry = nextEntry(store.getState().fight as Combat, tried);
    if (entry.op === 'declare') {
      store.getState().declare(entry.actionId, entry.targetId);
      tried = store.getState().rejection ? tried + 1 : 0;
    } else if (entry.op === 'respond') store.getState().respond(entry.triggerId, entry.choice);
    else {
      store.getState().step();
      tried = 0;
    }
    expect(store.getState().error).toBeNull();
  }
}

/** A fresh `awaiting-declare` with no open offer, at least `calls` host calls in. */
function quietAfter(store: Store, calls: number) {
  return () => {
    const s = store.getState();
    return s.script.length >= calls && s.state?.phase === 'awaiting-declare' && s.pending.length === 0;
  };
}

const shifted = (store: Store): Record<string, Position> =>
  Object.fromEntries(Object.values(store.getState().state?.combatants ?? {}).map((c) => [c.id, { x: (c.position?.x ?? 0) + 2, y: c.position?.y ?? 0 }]));

describe('placement and moves (CAP-06, CA-12..14)', () => {
  it('defaultPositions is CX-D9 after every roster change and ignores setPosition; resetPositions restores it', async () => {
    const { store } = await setup();
    expect(store.getState().defaultPositions).toEqual({ brynn: { x: 0, y: 0 } });
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    expect(store.getState().defaultPositions).toEqual(CX_D9);
    expect(store.getState().positions).toEqual(CX_D9);
    store.getState().setPosition('brynn', { x: 4, y: 2 });
    expect(store.getState().positions?.brynn).toEqual({ x: 4, y: 2 });
    expect(store.getState().defaultPositions).toEqual(CX_D9);
    store.getState().resetPositions();
    expect(store.getState().positions).toEqual(CX_D9);
    store.getState().addEnemy('hill-spider');
    store.getState().removeEnemy('barrow-wight-1');
    const layout = { brynn: { x: 0, y: 0 }, 'barrow-wight-2': { x: 1, y: 0 }, 'hill-spider-1': { x: 1, y: 1 } };
    expect(store.getState().defaultPositions).toEqual(layout);
    expect(store.getState().positions).toEqual(layout);
  });

  it('begin passes the edited placement verbatim; start.positions records it', async () => {
    const { store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().setPosition('barrow-wight-1', { x: 0, y: 1 });
    expect(store.getState().begin()).toBe(true);
    const s = store.getState();
    expect(s.start?.positions).toEqual({ brynn: { x: 0, y: 0 }, 'barrow-wight-1': { x: 0, y: 1 } });
    expect(s.state?.combatants['barrow-wight-1']?.position).toEqual({ x: 0, y: 1 });
    expect(s.live?.fight).toBe(s.fight);
  });

  it('a move appends {op: move, positions} to script, adds no log rows, replaces the fight and keeps the placement', async () => {
    const { store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    store.getState().begin();
    drive(store, quietAfter(store, 5));
    const before = store.getState();
    const positions = shifted(store);
    store.getState().move(positions);
    const s = store.getState();
    expect(s.error).toBeNull();
    expect(s.script).toEqual([...before.script, { op: 'move', positions }]);
    expect(s.log).toEqual(before.log);
    expect(s.declarations).toEqual(before.declarations);
    expect(s.fight).not.toBe(before.fight);
    expect(s.live?.fight).toBe(s.fight);
    for (const [id, p] of Object.entries(positions)) expect(s.state?.combatants[id]?.position).toEqual(p);
    expect(s.positions).toEqual(CX_D9);
  });

  it('move refusals surface as error with script unchanged: after a declare, and on a theater-of-mind world', async () => {
    const { store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().begin();
    const entry = nextEntry(store.getState().fight as Combat, 0);
    if (entry.op !== 'declare') throw new Error('expected a declare');
    store.getState().declare(entry.actionId, entry.targetId);
    drive(store, () => store.getState().pending.length === 0);
    const script = store.getState().script;
    store.getState().move(shifted(store));
    expect(store.getState().error).toMatchObject({ kind: 'unexpected', operation: 'combat:move' });
    expect(store.getState().script).toEqual(script);

    const theater: { spatial?: unknown } = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42, knobs: KNOBS });
    delete theater.spatial;
    const worlds = createWorldsStore();
    expect(await worlds.getState().importFromText(JSON.stringify(theater))).toBe(true);
    const chars = createCharacterStore(worlds);
    expect(chars.getState().create(BRYNN)).toBe(true);
    const plain = createCombatStore(worlds, chars);
    plain.getState().addEnemy('barrow-wight');
    expect([plain.getState().positions, plain.getState().defaultPositions]).toEqual([null, null]);
    expect(plain.getState().begin()).toBe(true);
    expect(plain.getState().start).not.toHaveProperty('positions');
    plain.getState().move({ brynn: { x: 0, y: 0 }, 'barrow-wight-1': { x: 1, y: 0 } });
    expect(plain.getState().error).toMatchObject({ kind: 'unexpected', operation: 'combat:move' });
    expect(plain.getState().script).toEqual([]);
  });

  it('restart leg: a recorded fight with a move replays complete from a new store over the real main handlers', async () => {
    const { worlds, store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    expect(store.getState().begin()).toBe(true);
    const begun = structuredClone(store.getState().start?.positions);
    drive(store, quietAfter(store, 5));
    store.getState().move(shifted(store));
    expect(store.getState().error).toBeNull();
    drive(store);
    expect(store.getState().over).toBe(true);
    expect(await store.getState().record('grid watch')).toBe(true);

    const worldId = worlds.getState().active?.meta.id as string;
    const doc = JSON.parse(readFileSync(join(root, 'fights', worldId, 'grid watch.json'), 'utf8'));
    expect(doc.start.positions).toEqual(begun);
    expect(doc.start.positions).toEqual(CX_D9);
    expect(doc.script.filter((e: ScriptEntry) => e.op === 'move')).toHaveLength(1);

    setPersistence(createInProcessBridge(root));
    const worlds2 = createWorldsStore();
    expect(await worlds2.getState().open(worldId)).toBe(true);
    const store2 = createCombatStore(worlds2, createCharacterStore(worlds2));
    await store2.getState().replay('grid watch');
    expect(store2.getState().replayed?.result).toEqual({ status: 'complete' });
    expect(JSON.stringify(store2.getState().replayed?.events)).toBe(JSON.stringify(doc.events));
  });
});

describe('ally-side spawns (CAP-03, CA-04b, CA-05, CA-12)', () => {
  it('one allocator over both rosters: the smallest n unused on either side', async () => {
    const { store } = await setup();
    store.getState().addAllySpawn('hill-spider');
    store.getState().addEnemy('hill-spider');
    store.getState().addAllySpawn('hill-spider');
    expect(store.getState().allySpawns.map((a) => a.instanceId)).toEqual(['hill-spider-1', 'hill-spider-3']);
    expect(store.getState().enemies.map((e) => e.instanceId)).toEqual(['hill-spider-2']);
    store.getState().removeAllySpawn('hill-spider-1');
    store.getState().addEnemy('hill-spider');
    expect(store.getState().enemies.map((e) => e.instanceId)).toEqual(['hill-spider-2', 'hill-spider-1']);
    expect(store.getState().allySpawns).toEqual([{ statblockId: 'hill-spider', instanceId: 'hill-spider-3' }]);
  });

  it('the default layout puts ally spawns in the allies column after the character, in roster order', async () => {
    const { store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().addAllySpawn('hill-spider');
    store.getState().addAllySpawn('grave-shambles');
    const layout = {
      brynn: { x: 0, y: 0 },
      'hill-spider-1': { x: 0, y: 1 },
      'grave-shambles-1': { x: 0, y: 2 },
      'barrow-wight-1': { x: 1, y: 0 },
    };
    expect(store.getState().defaultPositions).toEqual(layout);
    expect(Object.keys(store.getState().defaultPositions ?? {})).toEqual(Object.keys(layout));
    store.getState().setPosition('hill-spider-1', { x: 5, y: 5 });
    store.getState().removeAllySpawn('hill-spider-1');
    expect(store.getState().positions).toEqual({ brynn: { x: 0, y: 0 }, 'grave-shambles-1': { x: 0, y: 1 }, 'barrow-wight-1': { x: 1, y: 0 } });
  });

  it('begin puts [character, ...allySpawns] on the allies side and records start.allySpawns; none → no key', async () => {
    const { store } = await setup();
    store.getState().addEnemy('barrow-wight');
    expect(store.getState().begin()).toBe(true);
    expect(store.getState().start).not.toHaveProperty('allySpawns');
    store.getState().addAllySpawn('hill-spider');
    expect(store.getState().begin()).toBe(true);
    const s = store.getState();
    expect(s.start?.allySpawns).toEqual([{ statblockId: 'hill-spider', instanceId: 'hill-spider-1' }]);
    expect(s.live?.sides.allies.map((a) => a.id)).toEqual(['brynn', 'hill-spider-1']);
    expect(s.state?.combatants['hill-spider-1']).toMatchObject({ side: 'allies', position: { x: 0, y: 1 } });
    expect(s.state?.order).toContain('hill-spider-1');
  });

  it('CA-05: colliding ids are refused before startCombat — error named, no fight, no log rows, no events', async () => {
    const { worlds, store } = await setup();
    const rt = worlds.getState().active?.runtime;
    if (!rt) throw new Error('setup');
    store.getState().addEnemy('barrow-wight');
    store.setState({ allySpawns: [{ statblockId: 'hill-spider', instanceId: 'barrow-wight-1' }] });
    const before = rt.events.sinceRound(0).length;
    expect(store.getState().begin()).toBe(false);
    const s = store.getState();
    expect(s.error).toEqual({
      kind: 'unexpected',
      operation: 'fight:begin',
      message: 'combatant id "barrow-wight-1" is used twice — ids must be unique across both sides',
    });
    expect([s.fight, s.live, s.start, s.log, s.script]).toEqual([null, null, null, [], []]);
    expect(rt.events.sinceRound(0).length).toBe(before);
  });

  it('restart leg: a recorded fight with an ally spawn replays complete from a new store over the real main handlers', async () => {
    const { worlds, store } = await setup();
    store.getState().addAllySpawn('hill-spider');
    store.getState().addEnemy('barrow-wight');
    expect(store.getState().begin()).toBe(true);
    drive(store);
    expect(store.getState().over).toBe(true);
    expect(await store.getState().record('spider watch')).toBe(true);

    const worldId = worlds.getState().active?.meta.id as string;
    const doc = JSON.parse(readFileSync(join(root, 'fights', worldId, 'spider watch.json'), 'utf8'));
    expect(doc.start.allySpawns).toEqual([{ statblockId: 'hill-spider', instanceId: 'hill-spider-1' }]);
    expect(doc.start.positions).toEqual({ brynn: { x: 0, y: 0 }, 'hill-spider-1': { x: 0, y: 1 }, 'barrow-wight-1': { x: 1, y: 0 } });
    expect(doc.events.some((e: RuntimeEvent) => e.actor === 'hill-spider-1')).toBe(true);

    setPersistence(createInProcessBridge(root));
    const worlds2 = createWorldsStore();
    expect(await worlds2.getState().open(worldId)).toBe(true);
    const store2 = createCombatStore(worlds2, createCharacterStore(worlds2));
    await store2.getState().replay('spider watch');
    expect(store2.getState().replayed?.result).toEqual({ status: 'complete' });
    expect(JSON.stringify(store2.getState().replayed?.events)).toBe(JSON.stringify(doc.events));
  });
});

describe('initiative provenance (CAP-01, CA-01)', () => {
  it('initiativeOf is the combat:start event: its order is state.order after begin and still after a move', async () => {
    const { store } = await setup();
    expect(initiativeOf([])).toBeUndefined();
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    expect(store.getState().begin()).toBe(true);
    const start = initiativeOf(store.getState().log);
    expect(start?.type).toBe('combat:start');
    expect(start?.why.rule).toBe('combat.startCombat');
    expect(start?.payload.order).toEqual(store.getState().state?.order);
    drive(store, quietAfter(store, 5));
    store.getState().move(shifted(store));
    expect(store.getState().error).toBeNull();
    expect(initiativeOf(store.getState().log)).toBe(start);
    expect(start?.payload.order).toEqual(store.getState().state?.order);
  });
});

describe('threat-budget assembly (CAP-04, CA-05, CA-07, CA-08)', () => {
  it('non-empty groups replace the enemy roster with the library ids; the default layout is refreshed, ally spawns kept', async () => {
    const { worlds, store } = await setup();
    const rt = worlds.getState().active?.runtime;
    if (!rt) throw new Error('setup');
    store.getState().addAllySpawn('hill-spider');
    store.getState().addEnemy('grave-shambles');
    store.getState().setPosition('brynn', { x: 6, y: 6 });
    expect(store.getState().assembleEnemies(3, 7)).toBe(true);
    const s = store.getState();
    const reference = assemble(rt, 3, 7);
    if (!reference.ok) throw new Error('reference');
    expect(s.encounter).toEqual(reference.value.encounter);
    expect(s.enemies).toEqual([{ statblockId: 'barrow-wight', instanceId: 'barrow-wight' }]);
    expect(s.error).toBeNull();
    const layout = { brynn: { x: 0, y: 0 }, 'hill-spider-1': { x: 0, y: 1 }, 'barrow-wight': { x: 1, y: 0 } };
    expect([s.defaultPositions, s.positions]).toEqual([layout, layout]);
    // The shared allocator still hands out fresh ids beside the library's.
    store.getState().addEnemy('barrow-wight');
    expect(store.getState().enemies.map((e) => e.instanceId)).toEqual(['barrow-wight', 'barrow-wight-1']);
    store.getState().removeEnemy('barrow-wight-1');

    expect(store.getState().begin()).toBe(true);
    expect(store.getState().start?.enemies).toEqual([{ statblockId: 'barrow-wight', instanceId: 'barrow-wight' }]);
    expect(store.getState().state?.combatants['barrow-wight']).toMatchObject({ side: 'enemies', position: { x: 1, y: 0 } });
  });

  it('CX-D5: empty groups show the summary and leave the roster and placement unchanged', async () => {
    const { store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().setPosition('barrow-wight-1', { x: 4, y: 4 });
    const before = store.getState();
    expect(store.getState().assembleEnemies(0.5, 7)).toBe(true);
    const s = store.getState();
    expect(s.encounter).toEqual({ groups: [], threat: 0, budget: 0.5, seedUsed: '7', heuristic: 'threat-weighted-uniform' });
    expect([s.enemies, s.positions, s.defaultPositions]).toEqual([before.enemies, before.positions, before.defaultPositions]);
  });

  it('CA-05: an assembled id already on the ally side is refused — roster and placement unchanged, error named', async () => {
    const { store } = await setup();
    store.getState().addAllySpawn('hill-spider');
    store.getState().addEnemy('barrow-wight');
    const before = store.getState();
    // dark-fantasy · 42 budget 40 seed 1 holds hill-spider ×2 → hill-spider-1, the ally spawn's id.
    expect(store.getState().assembleEnemies(40, 1)).toBe(false);
    const s = store.getState();
    expect(s.error).toEqual({
      kind: 'unexpected',
      operation: 'fight:assemble',
      message: 'combatant id "hill-spider-1" is already on the ally side — ids must be unique across both sides',
    });
    expect(s.encounter?.groups).toContainEqual({ id: 'hill-spider', count: 2 });
    expect([s.enemies, s.allySpawns, s.positions]).toEqual([before.enemies, before.allySpawns, before.positions]);
    // The next success clears the refusal.
    expect(store.getState().assembleEnemies(3, 7)).toBe(true);
    expect(store.getState().error).toBeNull();
  });

  it('a world change clears the encounter summary with the roster', async () => {
    const { worlds, store } = await setup();
    store.getState().assembleEnemies(3, 7);
    expect(store.getState().encounter).not.toBeNull();
    expect(await worlds.getState().forge({ themeId: 'dark-fantasy', seed: 43, knobs: KNOBS })).toBe(true);
    expect([store.getState().encounter, store.getState().enemies]).toEqual([null, []]);
  });

  it('restart leg: an assembled fight records start.enemies as assembled and replays complete from a new store', async () => {
    const { worlds, store } = await setup();
    expect(store.getState().assembleEnemies(3, 7)).toBe(true);
    expect(store.getState().begin()).toBe(true);
    drive(store);
    expect(store.getState().over).toBe(true);
    expect(await store.getState().record('threat watch')).toBe(true);

    const worldId = worlds.getState().active?.meta.id as string;
    const doc = JSON.parse(readFileSync(join(root, 'fights', worldId, 'threat watch.json'), 'utf8'));
    expect(doc.start.enemies).toEqual([{ statblockId: 'barrow-wight', instanceId: 'barrow-wight' }]);
    expect(doc.start.positions).toEqual({ brynn: { x: 0, y: 0 }, 'barrow-wight': { x: 1, y: 0 } });

    setPersistence(createInProcessBridge(root));
    const worlds2 = createWorldsStore();
    expect(await worlds2.getState().open(worldId)).toBe(true);
    const store2 = createCombatStore(worlds2, createCharacterStore(worlds2));
    await store2.getState().replay('threat watch');
    expect(store2.getState().replayed?.result).toEqual({ status: 'complete' });
    expect(JSON.stringify(store2.getState().replayed?.events)).toBe(JSON.stringify(doc.events));
  });
});

describe('resume (CAP-05, CA-09..11)', () => {
  /** A mid-fight record `mid-1`: CX-D9, a move after 5 calls, stopped with an offer open after it. */
  async function recordMid() {
    const { worlds, store } = await setup();
    store.getState().addEnemy('barrow-wight');
    store.getState().addEnemy('barrow-wight');
    expect(store.getState().begin()).toBe(true);
    drive(store, quietAfter(store, 5));
    const eventsBeforeMove = store.getState().log.length;
    store.getState().move(shifted(store));
    drive(store, () => store.getState().pending.length > 0);
    const mid = store.getState();
    expect([mid.over, mid.pending.length > 0]).toEqual([false, true]);
    expect(await store.getState().record('mid-1')).toBe(true);
    const worldId = worlds.getState().active?.meta.id as string;
    const file = join(root, 'fights', worldId, 'mid-1.json');
    return { mid, worldId, file, eventsBeforeMove };
  }

  /** Restart over the same dir: a new bridge, stores and character, with a fight of its own already open. */
  async function restarted(worldId: string) {
    setPersistence(createInProcessBridge(root));
    const worlds = createWorldsStore();
    expect(await worlds.getState().open(worldId)).toBe(true);
    const chars = createCharacterStore(worlds);
    expect(chars.getState().create(BRYNN)).toBe(true);
    const store = createCombatStore(worlds, chars);
    expect(store.getState().assembleEnemies(3, 7)).toBe(true);
    expect(store.getState().begin()).toBe(true);
    return { worlds, store };
  }

  it('adopts the record over the real main handlers after a restart; one call after it appends exactly its events; record → replay complete', async () => {
    const { mid, worldId, file } = await recordMid();
    const stored = readFileSync(file, 'utf8');
    const doc = JSON.parse(stored);
    expect(doc.outcome).toBe('abandoned');

    const { store } = await restarted(worldId);
    const old = store.getState().fight as Combat;
    const { enemies, encounter } = store.getState();
    expect(await store.getState().resume('mid-1')).toBe(true);
    const s = store.getState();
    expect([s.error, s.resumed]).toEqual([null, null]);
    // CA-09: the rebuilt fight is the recorded one.
    expect(JSON.parse(JSON.stringify(recordingOf(s.fight as Combat, doc.start, [], [], []).combat))).toEqual(doc.combat);
    expect(s.pending).toEqual(mid.pending);
    expect(s.state).toEqual(mid.state);
    expect(JSON.stringify(s.log)).toBe(JSON.stringify(doc.events));
    expect([s.start, s.script, s.declarations]).toEqual([doc.start, doc.script, doc.declarations]);
    expect(s.live?.fight).toBe(s.fight);
    expect(s.live?.sides.allies.map((a) => a.id)).toEqual(['brynn']);
    // CA-10: begin-time hp, never the record's.
    expect(s.hpAtStart).toEqual(mid.hpAtStart);
    // The assembly roster and encounter are not fight state; the record is not rewritten.
    expect([s.enemies, s.encounter]).toEqual([enemies, encounter]);
    expect(readFileSync(file, 'utf8')).toBe(stored);

    // CA-11: the old fight no longer reaches the log; one call appends exactly that call's events.
    old.step();
    expect(store.getState().log).toBe(s.log);
    const fight = s.fight as Combat;
    const own: RuntimeEvent[] = [];
    const off = subscribe(fight.runtime, (e) => own.push(e));
    store.getState().respond(s.pending[0]?.triggerId as string, 'decline');
    off();
    expect(own.length).toBeGreaterThan(0);
    expect(store.getState().log).toEqual([...s.log, ...own]);
    expect(store.getState().script).toEqual([...doc.script, { op: 'respond', triggerId: s.pending[0]?.triggerId, choice: 'decline' }]);

    // A move keeps the same runtime, so the sink stays attached.
    drive(store, quietAfter(store, doc.script.length + 1));
    const beforeMove = store.getState().fight as Combat;
    store.getState().move(shifted(store));
    expect(store.getState().error).toBeNull();
    expect(store.getState().fight).not.toBe(beforeMove);
    expect(store.getState().fight?.runtime).toBe(fight.runtime);
    const logged = store.getState().log.length;
    const after: RuntimeEvent[] = [];
    const off2 = subscribe(fight.runtime, (e) => after.push(e));
    store.getState().step();
    off2();
    expect(after.length).toBeGreaterThan(0);
    expect(store.getState().log.slice(logged)).toEqual(after);

    drive(store);
    expect(store.getState().over).toBe(true);
    expect(await store.getState().record('mid-2')).toBe(true);
    expect(store.getState().records.find((r) => r.name === 'mid-2')?.outcome).toBe('complete');
    await store.getState().replay('mid-2');
    expect(store.getState().replayed?.result).toEqual({ status: 'complete' });
    expect(store.getState().records.find((r) => r.name === 'mid-1')?.outcome).toBe('abandoned');
  });

  it('a tampered move → refused with the first divergent index; store and record unchanged', async () => {
    const { worldId, file, eventsBeforeMove } = await recordMid();
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    const far = (p: Record<string, Position>) => Object.fromEntries(Object.keys(p).map((id, i) => [id, { x: i * 10, y: 0 }]));
    const tampered = JSON.stringify({ ...doc, script: doc.script.map((e: ScriptEntry) => (e.op === 'move' ? { op: 'move', positions: far(e.positions) } : e)) });
    writeFileSync(file, tampered);

    const { store } = await restarted(worldId);
    const before = store.getState();
    expect(await store.getState().resume('mid-1')).toBe(false);
    const s = store.getState();
    expect(s.resumed).toMatchObject({ name: 'mid-1', result: { status: 'diverged', index: eventsBeforeMove, expected: doc.events[eventsBeforeMove] } });
    const kept = ['fight', 'live', 'state', 'log', 'script', 'declarations', 'start', 'hpAtStart', 'pending', 'error'] as const;
    for (const k of kept) expect(s[k]).toBe(before[k]);
    expect(readFileSync(file, 'utf8')).toBe(tampered);
  });

  it('a legacy record (no script) → unavailable with the replay reason; nothing adopted', async () => {
    const { worldId, file } = await recordMid();
    const { script: _s, ...legacy } = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify(legacy));
    const { store } = await restarted(worldId);
    const fight = store.getState().fight;
    expect(await store.getState().resume('mid-1')).toBe(false);
    expect(store.getState().resumed).toEqual({ name: 'mid-1', result: { status: 'unavailable', reason: 'record has no replay script (recorded before B-2)' } });
    expect(store.getState().fight).toBe(fight);
  });
});
