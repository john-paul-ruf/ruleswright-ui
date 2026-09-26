import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { describe, expect, it } from 'vitest';
import { allyProfile } from '../../src/renderer/src/engine/combat-profile';
import {
  begin,
  declare,
  listSpawnable,
  perform,
  spatialLabel,
  step,
  subscribe,
  type Combat,
  type EnemySpec,
  type RuntimeEvent,
  type ScriptEntry,
} from '../../src/renderer/src/engine/combat';
import { create, type Character, type Outcome } from '../../src/renderer/src/engine/runtime';
import { openPack, type Pack, type Runtime } from '../../src/renderer/src/engine/schema';

function world(theme: string, seed = 42): { rt: Runtime; pack: Pack } {
  const gate = openPack(JSON.stringify(generateCampaign({ theme: loadTheme(theme), seed })));
  if (!gate.ok) throw new Error('gate rejected a forged pack');
  return { rt: gate.runtime, pack: gate.pack };
}

function value<T>(r: Outcome<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

function brynn(rt: Runtime): Character {
  return value(create(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }));
}

const WIGHTS: EnemySpec[] = [
  { statblockId: 'barrow-wight', instanceId: 'barrow-wight-1' },
  { statblockId: 'barrow-wight', instanceId: 'barrow-wight-2' },
];

function fightOf(rt: Runtime, enemies = WIGHTS): Combat {
  return value(begin(rt, value(allyProfile(rt, brynn(rt), 'brynn')), enemies));
}

/** Test policy: answer offers first; else declare the active combatant's k-th action at its first standing foe; else step. */
function nextEntry(fight: Combat, tried: number, choice: 'take' | 'decline'): ScriptEntry {
  const { combatants, order, active, phase } = fight.state;
  const side = (id: string) => combatants[id]?.side;
  const firstFoe = (id: string) => order.find((o) => side(o) !== side(id) && (combatants[o]?.hp.current ?? 0) > 0);
  const offer = fight.pendingTriggers[0];
  if (offer) return { op: 'respond', triggerId: offer.triggerId, choice, targetId: choice === 'take' ? firstFoe(offer.actorId) : undefined };
  const actionId = combatants[active]?.actions[tried];
  if (phase === 'awaiting-declare' && actionId !== undefined) return { op: 'declare', actionId, targetId: firstFoe(active) };
  return { op: 'step' };
}

function firstDeclare(fight: Combat): Extract<ScriptEntry, { op: 'declare' }> {
  const entry = nextEntry(fight, 0, 'decline');
  if (entry.op !== 'declare') throw new Error(`expected a declare, got ${entry.op}`);
  return entry;
}

/** Drive a fight to `combat-over` (bounded); returns the script issued and every event observed. */
function playOut(fight: Combat, choice: 'take' | 'decline' = 'decline', limit = 500) {
  const script: ScriptEntry[] = [];
  const events: RuntimeEvent[] = [];
  const off = subscribe(fight.runtime, (e) => events.push(e));
  let steps = 0;
  let tried = 0;
  while (fight.state.phase !== 'combat-over' && steps < limit) {
    const entry = nextEntry(fight, tried, choice);
    const r = value(perform(fight, entry));
    script.push(entry);
    if (entry.op === 'step') {
      steps += 1;
      tried = 0;
    } else if (entry.op === 'declare' && (r as { rejection: unknown }).rejection !== null) tried += 1;
  }
  off();
  return { script, events, steps };
}

describe('allyProfile (CA-08, B-1 = A)', () => {
  it('every class of both bundled packs yields a level-1 profile with at least one action', () => {
    for (const theme of ['dark-fantasy', 'zombie-urban']) {
      const { rt, pack } = world(theme);
      for (const classId of Object.keys(pack.content.classes ?? {})) {
        const made = Object.keys(pack.content.races ?? {})
          .map((race) => create(rt, { name: 'X', race, classes: [{ id: classId, level: 1 }] }))
          .find((r) => r.ok);
        if (!made?.ok) throw new Error(`${theme}: no race accepts ${classId}`);
        const ally = value(allyProfile(rt, made.value, 'x'));
        expect(ally.profile.id).toBe('x');
        expect(ally.profile.actions.length, `${theme} ${classId}`).toBeGreaterThan(0);
      }
    }
  });

  it('passes the library profile and balances through untouched (warden: 5 actions, hp 27, ac 12)', () => {
    const { rt } = world('dark-fantasy');
    const ally = value(allyProfile(rt, brynn(rt), 'brynn'));
    expect(ally.profile.actions).toEqual(['strike', 'cut-down', 'withdraw', 'brace', 'parry']);
    expect([ally.profile.hp, ally.profile.ac]).toEqual([27, 12]);
    expect(ally.balances.pools).toEqual({ ember: 18 });
  });

  it('shapes a thrown failure as an AppError instead of throwing', () => {
    const { rt } = world('dark-fantasy');
    const r = allyProfile(rt, {} as Character);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.operation).toBe('fight:ally-profile');
  });
});

describe('combat wrappers over the real library (dark-fantasy · 42)', () => {
  it('lists the bestiary and labels the bundled pack theater-of-mind; a spatial pack is a grid', () => {
    const { rt, pack } = world('dark-fantasy');
    expect(listSpawnable(rt)).toContain('barrow-wight');
    expect(spatialLabel(pack)).toBe('theater-of-mind');
    expect(spatialLabel({ ...pack, spatial: { defaultReach: 1 } } as Pack)).toBe('grid');
  });

  it('begin: ally + 2 spawns → awaiting-declare, order of 3, combat:start carries the initiative rolls', () => {
    const { rt } = world('dark-fantasy');
    const ally = value(allyProfile(rt, brynn(rt), 'brynn'));
    const events: RuntimeEvent[] = [];
    const off = subscribe(rt, (e) => events.push(e));
    const fight = value(begin(rt, ally, WIGHTS));
    off();
    expect(fight.state.phase).toBe('awaiting-declare');
    expect(fight.state.order).toHaveLength(3);
    expect(events[0]?.type).toBe('combat:start');
    expect(events[0]?.why.rolls).toHaveLength(3);
  });

  it('a bogus action is a declare:rejected event with the state unchanged', () => {
    const { rt } = world('dark-fantasy');
    const fight = fightOf(rt);
    const before = structuredClone(fight.state);
    const r = value(declare(fight, 'no-such-action'));
    expect(r.rejection?.type).toBe('declare:rejected');
    expect(r.events).toEqual([r.rejection]);
    expect(fight.state).toEqual(before);
  });

  it('declare returns only its own events, never the round so far', () => {
    const { rt } = world('dark-fantasy');
    const fight = fightOf(rt);
    const first = firstDeclare(fight);
    value(declare(fight, 'no-such-action'));
    const ok = value(declare(fight, first.actionId, first.targetId));
    expect(ok.rejection).toBeNull();
    expect(ok.events.some((e) => e.type === 'declare:rejected')).toBe(false);
    // negative control: the raw library call reports the round, rejection included
    const raw = fightOf(world('dark-fantasy').rt);
    raw.declare('no-such-action');
    expect(raw.declare(first.actionId, { targetId: first.targetId }).some((e) => e.type === 'declare:rejected')).toBe(true);
  });

  it('a second main action in one turn is slot-exhausted (E-ECON-01), state unchanged', () => {
    const { rt } = world('dark-fantasy');
    const fight = fightOf(rt);
    const { actionId, targetId } = firstDeclare(fight);
    expect(value(declare(fight, actionId, targetId)).rejection).toBeNull();
    const before = structuredClone(fight.state);
    const again = value(declare(fight, actionId, targetId));
    expect(again.rejection?.payload.kind).toBe('slot-exhausted');
    expect(again.rejection?.why.rule).toBe('E-ECON-01');
    expect(fight.state).toEqual(before);
  });

  it('declining every offer, a full fight reaches combat-over within 500 steps with one combat:ended', () => {
    const { rt } = world('dark-fantasy');
    const fight = fightOf(rt);
    const run = playOut(fight);
    expect(fight.state.phase).toBe('combat-over');
    expect(run.steps).toBeLessThan(500);
    expect(run.script.some((e) => e.op === 'respond')).toBe(true);
    const ended = run.events.filter((e) => e.type === 'combat:ended');
    expect(ended).toHaveLength(1);
    expect(ended[0]?.why.rule).toBe('combat.sideDefeated');
    expect(value(step(fight))).toEqual({ kind: 'combat-over' });
    expect(declare(fight, 'strike')).toMatchObject({ ok: false, error: { operation: 'combat:declare' } });
  });

  it('taking every offer also ends, and zombie-urban fights end too', () => {
    const { rt } = world('dark-fantasy');
    const fight = fightOf(rt);
    playOut(fight, 'take');
    expect(fight.state.phase).toBe('combat-over');

    const urban = world('zombie-urban');
    const z = value(create(urban.rt, { name: 'Z', race: 'mile-born', classes: [{ id: 'scavenger', level: 1 }] }));
    const spawn = listSpawnable(urban.rt)[0];
    if (spawn === undefined) throw new Error('empty bestiary');
    const zf = value(
      begin(urban.rt, value(allyProfile(urban.rt, z, 'z')), [
        { statblockId: spawn, instanceId: `${spawn}-1` },
        { statblockId: spawn, instanceId: `${spawn}-2` },
      ]),
    );
    playOut(zf);
    expect(zf.state.phase).toBe('combat-over');
  });

  it('the same script on a fresh fight yields an identical event array (determinism); a changed script does not', () => {
    const first = playOut(fightOf(world('dark-fantasy').rt));
    const again = fightOf(world('dark-fantasy').rt);
    const events: RuntimeEvent[] = [];
    const off = subscribe(again.runtime, (e) => events.push(e));
    for (const entry of first.script) value(perform(again, entry));
    off();
    expect(JSON.stringify(events)).toBe(JSON.stringify(first.events));

    const other = fightOf(world('dark-fantasy').rt);
    const otherEvents: RuntimeEvent[] = [];
    const off2 = subscribe(other.runtime, (e) => otherEvents.push(e));
    for (const entry of first.script.slice(1)) perform(other, entry);
    off2();
    expect(JSON.stringify(otherEvents)).not.toBe(JSON.stringify(first.events));
  });
});
