import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { begin, perform, subscribe, type Combat, type RuntimeEvent, type ScriptEntry } from '../../src/renderer/src/engine/combat';
import { allyProfile } from '../../src/renderer/src/engine/combat-profile';
import { restore, serialize } from '../../src/renderer/src/engine/runtime';
import { openPack } from '../../src/renderer/src/engine/schema';
import { setPersistence } from '../../src/renderer/src/persistence/client';
import { createCharacterStore } from '../../src/renderer/src/store/character';
import { createCombatStore, offerEvents, roundsOf, typesOf, visibleLog } from '../../src/renderer/src/store/combat';
import { createWorldsStore } from '../../src/renderer/src/store/worlds';
import { createInProcessBridge } from '../support/in-process-bridge';
import { makeTmpDir } from '../support/tmp';

const KNOBS = { threat: 'medium', 'spell-density': 3, grittiness: 'heroic', 'demihuman-caps': 'on' };
const BRYNN = { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] };

let cleanup: () => void;

beforeEach(() => {
  const tmp = makeTmpDir('combat-store-');
  cleanup = tmp.cleanup;
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
    expect(s0.start).toEqual({ ally: { id: 'brynn', snapshot: snapshotBefore }, enemies: s0.enemies });
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
    const fresh = begin(rt, ally.value, done.start.enemies);
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
    store.getState().begin();
    const old = store.getState().fight;
    expect(await worlds.getState().forge({ themeId: 'dark-fantasy', seed: 43, knobs: KNOBS })).toBe(true);
    const s = store.getState();
    expect([s.fight, s.state, s.start, s.enemies, s.log, s.script]).toEqual([null, null, null, [], [], []]);
    old?.step();
    expect(store.getState().log).toEqual([]);
  });
});
