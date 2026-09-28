import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { assembleEncounter, resolveSlotGrants, spawnEncounter, spawnMonster } from 'ruleswright/runtime';
import { describe, expect, it } from 'vitest';
import { allyProfile } from '../../src/renderer/src/engine/combat-profile';
import {
  actionInfo,
  assemble,
  begin,
  declare,
  distance,
  listSpawnable,
  perform,
  reposition,
  slotGrants,
  spatialLabel,
  spawnProfile,
  spatialOf,
  step,
  subscribe,
  type AllyCombatant,
  type EnemySpec,
  type LiveFight,
  type Position,
  type RuntimeEvent,
  type ScriptEntry,
  type SpawnSpec,
} from '../../src/renderer/src/engine/combat';
import { create, type Character, type Outcome } from '../../src/renderer/src/engine/runtime';
import { openPack, type Pack, type Runtime } from '../../src/renderer/src/engine/schema';

/** A generated pack; `theater` deletes its `spatial` key — the shape of a pre-grid world or an imported pack (CX-D13). */
function world(theme: string, seed = 42, theater = false): { rt: Runtime; pack: Pack } {
  const generated: { spatial?: unknown } = generateCampaign({ theme: loadTheme(theme), seed });
  if (theater) delete generated.spatial;
  const gate = openPack(JSON.stringify(generated));
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

/** CX-D9 default layout: allies x=0, enemies x=1, y = index in its own side, roster order — one step apart. */
function layout(ally: AllyCombatant, enemies: readonly EnemySpec[], allySpawns: readonly SpawnSpec[] = []): Record<string, Position> {
  return Object.fromEntries([
    ...[ally.profile.id, ...allySpawns.map((s) => s.instanceId)].map((id, y) => [id, { x: 0, y }] as const),
    ...enemies.map((e, y) => [e.instanceId, { x: 1, y }] as const),
  ]);
}

/** A fight on `rt`: grid packs get the default layout, theater packs no positions. */
function fightOf(rt: Runtime, enemies = WIGHTS, allySpawns: readonly SpawnSpec[] = []): LiveFight {
  const ally = value(allyProfile(rt, brynn(rt), 'brynn'));
  return value(begin(rt, ally, enemies, spatialOf(rt.pack) === null ? undefined : layout(ally, enemies, allySpawns), allySpawns));
}

const SPIDER: SpawnSpec[] = [{ statblockId: 'hill-spider', instanceId: 'hill-spider-1' }];

/** Test policy: answer offers first; else declare the active combatant's k-th action at its first standing foe; else step. */
function nextEntry({ fight }: LiveFight, tried: number, choice: 'take' | 'decline'): ScriptEntry {
  const { combatants, order, active, phase } = fight.state;
  const side = (id: string) => combatants[id]?.side;
  const firstFoe = (id: string) => order.find((o) => side(o) !== side(id) && (combatants[o]?.hp.current ?? 0) > 0);
  const offer = fight.pendingTriggers[0];
  if (offer) return { op: 'respond', triggerId: offer.triggerId, choice, targetId: choice === 'take' ? firstFoe(offer.actorId) : undefined };
  const actionId = combatants[active]?.actions[tried];
  if (phase === 'awaiting-declare' && actionId !== undefined) return { op: 'declare', actionId, targetId: firstFoe(active) };
  return { op: 'step' };
}

function firstDeclare(live: LiveFight): Extract<ScriptEntry, { op: 'declare' }> {
  const entry = nextEntry(live, 0, 'decline');
  if (entry.op !== 'declare') throw new Error(`expected a declare, got ${entry.op}`);
  return entry;
}

/** Drive a fight to `combat-over` (bounded); returns the script issued and every event observed. */
function playOut(live: LiveFight, choice: 'take' | 'decline' = 'decline', limit = 500) {
  const script: ScriptEntry[] = [];
  const events: RuntimeEvent[] = [];
  const off = subscribe(live.fight.runtime, (e) => events.push(e));
  let steps = 0;
  let tried = 0;
  while (live.fight.state.phase !== 'combat-over' && steps < limit) {
    const entry = nextEntry(live, tried, choice);
    const r = value(perform(live, entry));
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

describe('combat wrappers over the real library (dark-fantasy · 42, grid, default layout)', () => {
  it('lists the bestiary and types the spatial section: generated packs are grids, a stripped pack is theater-of-mind', () => {
    const { rt, pack } = world('dark-fantasy');
    expect(listSpawnable(rt)).toContain('barrow-wight');
    expect(spatialLabel({ ...pack, spatial: { model: 'grid', reach: { default: 1 } } })).toBe('grid');
    expect(spatialLabel(pack)).toBe('grid');
    expect(spatialOf(pack)).toEqual(pack.spatial);
    const theater = world('dark-fantasy', 42, true).pack;
    expect(spatialLabel(theater)).toBe('theater-of-mind');
    expect(spatialOf(theater)).toBeNull();
    expect(distance(rt, { x: 0, y: 0 }, { x: 3, y: 2 })).toBe(rt.spatial.distance({ x: 0, y: 0 }, { x: 3, y: 2 }));
  });

  it('begin: ally + 2 spawns → awaiting-declare, order of 3, combat:start carries the initiative rolls; positions land verbatim', () => {
    const { rt } = world('dark-fantasy');
    const ally = value(allyProfile(rt, brynn(rt), 'brynn'));
    const positions = layout(ally, WIGHTS);
    const events: RuntimeEvent[] = [];
    const off = subscribe(rt, (e) => events.push(e));
    const { fight, sides } = value(begin(rt, ally, WIGHTS, positions));
    off();
    expect(fight.state.phase).toBe('awaiting-declare');
    expect(fight.state.order).toHaveLength(3);
    expect(events[0]?.type).toBe('combat:start');
    expect(events[0]?.why.rolls).toHaveLength(3);
    for (const [id, p] of Object.entries(positions)) expect(fight.state.combatants[id]?.position).toEqual(p);
    expect(sides.allies).toEqual([{ id: 'brynn', profile: ally.profile }]);
    expect(sides.enemies.map((e) => e.id)).toEqual(['barrow-wight-1', 'barrow-wight-2']);
  });

  it('ally spawns (CA-04b): [character, ...allySpawns] join the allies side in that order, placed verbatim', () => {
    const { rt } = world('dark-fantasy');
    const ally = value(allyProfile(rt, brynn(rt), 'brynn'));
    const enemies = WIGHTS.slice(0, 1);
    const positions = layout(ally, enemies, SPIDER);
    const { fight, sides } = value(begin(rt, ally, enemies, positions, SPIDER));
    expect(sides.allies.map((a) => a.id)).toEqual(['brynn', 'hill-spider-1']);
    expect(sides.allies[1]?.profile).toEqual(value(spawnProfile(rt, 'hill-spider', 'hill-spider-1')));
    expect(fight.state.combatants['hill-spider-1']).toMatchObject({ side: 'allies', position: { x: 0, y: 1 } });
    expect(fight.state.combatants['barrow-wight-1']?.side).toBe('enemies');
    expect([...fight.state.order].sort()).toEqual(['barrow-wight-1', 'brynn', 'hill-spider-1']);
  });

  it('CA-05: an id used twice across both sides is refused before startCombat — no events, named id', () => {
    const { rt } = world('dark-fantasy');
    const ally = value(allyProfile(rt, brynn(rt), 'brynn'));
    const cases: [readonly SpawnSpec[], readonly SpawnSpec[], string][] = [
      [[{ statblockId: 'barrow-wight', instanceId: 'barrow-wight-1' }], WIGHTS, 'barrow-wight-1'],
      [[...SPIDER, ...SPIDER], WIGHTS, 'hill-spider-1'],
      [[{ statblockId: 'hill-spider', instanceId: 'brynn' }], WIGHTS, 'brynn'],
      [[], [...WIGHTS, WIGHTS[0] as SpawnSpec], 'barrow-wight-1'],
    ];
    for (const [allySpawns, enemies, id] of cases) {
      const events: RuntimeEvent[] = [];
      const off = subscribe(rt, (e) => events.push(e));
      const r = begin(rt, ally, enemies, undefined, allySpawns);
      off();
      expect(r).toEqual({
        ok: false,
        error: { kind: 'unexpected', operation: 'fight:begin', message: `combatant id "${id}" is used twice — ids must be unique across both sides` },
      });
      expect(events).toEqual([]);
    }
  });

  it('fail-closed: a grid pack begun without positions is the library refusal, one E-SPAT-01 card per combatant', () => {
    const { rt } = world('dark-fantasy');
    const r = begin(rt, value(allyProfile(rt, brynn(rt), 'brynn')), WIGHTS);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe('library');
    if (r.error.kind !== 'library') return;
    expect(r.error.cards.map((c) => [c.rule, c.jsonPath]).sort()).toEqual(
      [
        ['E-SPAT-01', 'positions.barrow-wight-1'],
        ['E-SPAT-01', 'positions.barrow-wight-2'],
        ['E-SPAT-01', 'positions.brynn'],
      ].sort(),
    );
  });

  it('far apart: a `valid` melee action is rejected kind valid, a plain melee action kind spatial (E-SPAT-01); state unchanged', () => {
    const far = (theme: string, statblockId: string) => {
      const { rt } = world(theme);
      const made = theme === 'dark-fantasy' ? brynn(rt) : value(create(rt, { name: 'Z', race: 'mile-born', classes: [{ id: 'scavenger', level: 1 }] }));
      const ally = value(allyProfile(rt, made, 'brynn'));
      const enemies = [{ statblockId, instanceId: `${statblockId}-1` }];
      const live = value(begin(rt, ally, enemies, { brynn: { x: 0, y: 0 }, [`${statblockId}-1`]: { x: 5, y: 0 } }));
      expect(live.fight.state.active).toBe(`${statblockId}-1`);
      return live;
    };
    const wight = far('dark-fantasy', 'barrow-wight');
    const before = structuredClone(wight.fight.state);
    const valid = value(declare(wight.fight, 'cut-down', 'brynn')).rejection;
    expect(valid?.payload.kind).toBe('valid');
    expect(wight.fight.state).toEqual(before);

    const shambler = far('zombie-urban', 'grave-shambler');
    const unchanged = structuredClone(shambler.fight.state);
    const spatial = value(declare(shambler.fight, 'shambler-claw', 'brynn')).rejection;
    expect(spatial?.payload.kind).toBe('spatial');
    expect(spatial?.why.rule).toBe('E-SPAT-01');
    expect(shambler.fight.state).toEqual(unchanged);
  });

  it('a bogus action is a declare:rejected event with the state unchanged', () => {
    const { rt } = world('dark-fantasy');
    const { fight } = fightOf(rt);
    const before = structuredClone(fight.state);
    const r = value(declare(fight, 'no-such-action'));
    expect(r.rejection?.type).toBe('declare:rejected');
    expect(r.events).toEqual([r.rejection]);
    expect(fight.state).toEqual(before);
  });

  it('declare returns only its own events, never the round so far', () => {
    const { rt } = world('dark-fantasy');
    const live = fightOf(rt);
    const first = firstDeclare(live);
    value(declare(live.fight, 'no-such-action'));
    const ok = value(declare(live.fight, first.actionId, first.targetId));
    expect(ok.rejection).toBeNull();
    expect(ok.events.some((e) => e.type === 'declare:rejected')).toBe(false);
    // negative control: the raw library call reports the round, rejection included
    const raw = fightOf(world('dark-fantasy').rt).fight;
    raw.declare('no-such-action');
    expect(raw.declare(first.actionId, { targetId: first.targetId }).some((e) => e.type === 'declare:rejected')).toBe(true);
  });

  it('a second main action in one turn is slot-exhausted (E-ECON-01), state unchanged', () => {
    const { rt } = world('dark-fantasy');
    const live = fightOf(rt);
    const { actionId, targetId } = firstDeclare(live);
    expect(value(declare(live.fight, actionId, targetId)).rejection).toBeNull();
    const before = structuredClone(live.fight.state);
    const again = value(declare(live.fight, actionId, targetId));
    expect(again.rejection?.payload.kind).toBe('slot-exhausted');
    expect(again.rejection?.why.rule).toBe('E-ECON-01');
    expect(live.fight.state).toEqual(before);
  });

  it('declining every offer, a full fight reaches combat-over within 500 steps with one combat:ended', () => {
    const { rt } = world('dark-fantasy');
    const live = fightOf(rt);
    const run = playOut(live);
    expect(live.fight.state.phase).toBe('combat-over');
    expect(run.steps).toBeLessThan(500);
    expect(run.script.some((e) => e.op === 'respond')).toBe(true);
    const ended = run.events.filter((e) => e.type === 'combat:ended');
    expect(ended).toHaveLength(1);
    expect(ended[0]?.why.rule).toBe('combat.sideDefeated');
    expect(value(step(live.fight))).toEqual({ kind: 'combat-over' });
    expect(declare(live.fight, 'strike')).toMatchObject({ ok: false, error: { operation: 'combat:declare' } });
  });

  it('taking every offer also ends, and zombie-urban fights end too', () => {
    const { rt } = world('dark-fantasy');
    const live = fightOf(rt);
    playOut(live, 'take');
    expect(live.fight.state.phase).toBe('combat-over');

    const urban = world('zombie-urban');
    const z = value(create(urban.rt, { name: 'Z', race: 'mile-born', classes: [{ id: 'scavenger', level: 1 }] }));
    const spawn = listSpawnable(urban.rt)[0];
    if (spawn === undefined) throw new Error('empty bestiary');
    const ally = value(allyProfile(urban.rt, z, 'z'));
    const enemies = [
      { statblockId: spawn, instanceId: `${spawn}-1` },
      { statblockId: spawn, instanceId: `${spawn}-2` },
    ];
    const zf = value(begin(urban.rt, ally, enemies, layout(ally, enemies)));
    playOut(zf);
    expect(zf.fight.state.phase).toBe('combat-over');
  });

  it('the same script on a fresh fight yields an identical event array (determinism); a changed script does not', () => {
    const first = playOut(fightOf(world('dark-fantasy').rt));
    const again = fightOf(world('dark-fantasy').rt);
    const events: RuntimeEvent[] = [];
    const off = subscribe(again.fight.runtime, (e) => events.push(e));
    for (const entry of first.script) value(perform(again, entry));
    off();
    expect(JSON.stringify(events)).toBe(JSON.stringify(first.events));

    const other = fightOf(world('dark-fantasy').rt);
    const otherEvents: RuntimeEvent[] = [];
    const off2 = subscribe(other.fight.runtime, (e) => otherEvents.push(e));
    for (const entry of first.script.slice(1)) perform(other, entry);
    off2();
    expect(JSON.stringify(otherEvents)).not.toBe(JSON.stringify(first.events));
  });

  it('theater path: a spatial-stripped pack begins with no positions and plays to combat-over', () => {
    const { rt } = world('dark-fantasy', 42, true);
    const live = fightOf(rt);
    expect(Object.values(live.fight.state.combatants).every((c) => c.position === undefined)).toBe(true);
    playOut(live);
    expect(live.fight.state.phase).toBe('combat-over');
  });
});

describe('reposition (CA-13, CX-D10, CX-D11)', () => {
  /** Play `calls` host calls, then answer offers / step until a fresh `awaiting-declare` with no open offer. */
  function midFight(calls: number, allySpawns: readonly SpawnSpec[] = []): LiveFight {
    const live = fightOf(world('dark-fantasy').rt, WIGHTS, allySpawns);
    let tried = 0;
    for (let i = 0; i < calls && live.fight.state.phase !== 'combat-over'; i += 1) {
      const entry = nextEntry(live, tried, 'decline');
      const r = value(perform(live, entry));
      tried = entry.op === 'declare' && (r as { rejection: unknown }).rejection !== null ? tried + 1 : 0;
    }
    for (let i = 0; i < 50 && (live.fight.state.phase !== 'awaiting-declare' || live.fight.pendingTriggers.length > 0); i += 1) {
      const offer = live.fight.pendingTriggers[0];
      if (offer) value(perform(live, { op: 'respond', triggerId: offer.triggerId, choice: 'decline' }));
      else value(step(live.fight));
    }
    expect(live.fight.state.phase).toBe('awaiting-declare');
    expect(live.fight.pendingTriggers).toEqual([]);
    return live;
  }

  const kept = (live: LiveFight) => {
    const { rng, order, turn, active, round, combatants } = structuredClone(live.fight.state);
    const each = Object.values(combatants).map((c) => ({
      id: c.id,
      hp: c.hp,
      slots: c.slots.remaining,
      conditions: c.conditions,
      pools: c.pools,
      boundSlots: c.boundSlots,
    }));
    return { rng, order, turn, active, round, each };
  };

  it('mid-fight: everything but positions is kept, positions are the new map, and the move emits zero events', () => {
    const live = midFight(12);
    const old = live.fight;
    const before = kept(live);
    expect(before.round).toBeGreaterThan(1);
    const positions = Object.fromEntries(Object.keys(old.state.combatants).map((id, i) => [id, { x: 7 + i, y: 3 }]));
    const events: RuntimeEvent[] = [];
    const off = subscribe(old.runtime, (e) => events.push(e));
    const moved = value(reposition(live, positions));
    off();
    expect(events).toEqual([]);
    expect(live.fight).toBe(moved);
    expect(moved).not.toBe(old);
    expect(kept(live)).toEqual(before);
    for (const [id, p] of Object.entries(positions)) expect(moved.state.combatants[id]?.position).toEqual(p);
    expect(moved.state.phase).toBe('awaiting-declare');
  });

  it('an ally spawn is re-stated like every combatant: same equality list, its new position, zero events', () => {
    const live = midFight(12, SPIDER);
    expect(live.sides.allies.map((a) => a.id)).toEqual(['brynn', 'hill-spider-1']);
    const before = kept(live);
    expect(before.each.map((c) => c.id)).toContain('hill-spider-1');
    const positions = Object.fromEntries(Object.keys(live.fight.state.combatants).map((id, i) => [id, { x: 3 + i, y: 2 }]));
    const events: RuntimeEvent[] = [];
    const off = subscribe(live.fight.runtime, (e) => events.push(e));
    value(reposition(live, positions));
    off();
    expect(events).toEqual([]);
    expect(kept(live)).toEqual(before);
    expect(live.fight.state.combatants['hill-spider-1']).toMatchObject({ side: 'allies', position: positions['hill-spider-1'] });
  });

  it('live balances are re-stated: a pool spent by ember-surge stays spent after the move (probe-grid2)', () => {
    const { rt, pack } = world('dark-fantasy');
    const vey = Object.keys(pack.content.races ?? {})
      .map((race) => create(rt, { name: 'Vey', race, classes: [{ id: 'hexer', level: 1 }] }))
      .find((r) => r.ok);
    if (!vey?.ok) throw new Error('no race accepts hexer');
    const ally = value(allyProfile(rt, vey.value, 'vey'));
    const enemies = [{ statblockId: 'barrow-wight', instanceId: 'w1' }];
    const live = value(begin(rt, ally, enemies, layout(ally, enemies)));
    const settle = () => {
      for (let i = 0; i < 20 && (live.fight.state.phase !== 'awaiting-declare' || live.fight.pendingTriggers.length > 0); i += 1) {
        const offer = live.fight.pendingTriggers[0];
        value(offer ? perform(live, { op: 'respond', triggerId: offer.triggerId, choice: 'decline' }) : step(live.fight));
      }
    };
    for (let i = 0; i < 20 && live.fight.state.active !== 'vey'; i += 1) {
      value(perform(live, nextEntry(live, 0, 'decline')));
      settle();
    }
    expect(live.fight.state.active).toBe('vey');
    expect(value(declare(live.fight, 'ember-surge', 'w1')).rejection).toBeNull();
    const spent = structuredClone(live.fight.state.combatants.vey?.pools);
    expect(spent).not.toEqual(ally.balances.pools);
    settle();
    const positions = Object.fromEntries(Object.keys(live.fight.state.combatants).map((id, y) => [id, { x: 4, y }]));
    value(reposition(live, positions));
    expect(live.fight.state.combatants.vey?.pools).toEqual(spent);
  });

  it('refuses after a declare, with an offer open, and on a theater pack — naming the condition, fight untouched', () => {
    const somewhere = (live: LiveFight) =>
      Object.fromEntries(Object.keys(live.fight.state.combatants).map((id, y) => [id, { x: 0, y }]));

    const declared = fightOf(world('dark-fantasy').rt);
    const { actionId, targetId } = firstDeclare(declared);
    value(declare(declared.fight, actionId, targetId));
    for (let offer = declared.fight.pendingTriggers[0]; offer; offer = declared.fight.pendingTriggers[0]) {
      value(perform(declared, { op: 'respond', triggerId: offer.triggerId, choice: 'decline' }));
    }
    expect(declared.fight.state.phase).not.toBe('awaiting-declare');
    const fight = declared.fight;
    const afterDeclare = reposition(declared, somewhere(declared));
    expect(afterDeclare).toMatchObject({ ok: false, error: { kind: 'unexpected', operation: 'combat:move' } });
    if (!afterDeclare.ok) expect(afterDeclare.error.message).toMatch(/awaiting-declare/);
    expect(declared.fight).toBe(fight);

    const offered = fightOf(world('dark-fantasy').rt);
    for (let i = 0; i < 200 && offered.fight.pendingTriggers.length === 0; i += 1) value(perform(offered, nextEntry(offered, 0, 'decline')));
    expect(offered.fight.pendingTriggers.length).toBeGreaterThan(0);
    const withOffer = reposition(offered, somewhere(offered));
    expect(withOffer).toMatchObject({ ok: false, error: { kind: 'unexpected', operation: 'combat:move' } });
    if (!withOffer.ok) expect(withOffer.error.message).toMatch(/offer/);

    const theater = fightOf(world('dark-fantasy', 42, true).rt);
    const onTheater = reposition(theater, somewhere(theater));
    expect(onTheater).toMatchObject({ ok: false, error: { kind: 'unexpected', operation: 'combat:move' } });
    if (!onTheater.ok) expect(onTheater.error.message).toMatch(/spatial/);
  });

  it('an incomplete map is the library refusal (E-SPAT-01), fight untouched', () => {
    const live = fightOf(world('dark-fantasy').rt);
    const fight = live.fight;
    const r = reposition(live, { brynn: { x: 0, y: 0 } });
    expect(r).toMatchObject({ ok: false, error: { kind: 'library', operation: 'combat:move' } });
    if (!r.ok && r.error.kind === 'library') expect(r.error.cards.every((c) => c.rule === 'E-SPAT-01')).toBe(true);
    expect(live.fight).toBe(fight);
  });

  it('perform replays a recorded move entry through the same seam', () => {
    const live = fightOf(world('dark-fantasy').rt);
    const positions = Object.fromEntries(Object.keys(live.fight.state.combatants).map((id, y) => [id, { x: 2, y }]));
    value(perform(live, { op: 'move', positions }));
    for (const [id, p] of Object.entries(positions)) expect(live.fight.state.combatants[id]?.position).toEqual(p);
  });
});

describe('slot grants and action detail (CA-02, CA-03)', () => {
  it('slotGrants is the library resolution: dark-fantasy declares {main, move, reaction}; zombie-urban (no economy) gets the default', () => {
    const { rt, pack } = world('dark-fantasy');
    expect(slotGrants(rt)).toEqual({ main: 1, move: 1, reaction: 1 });
    expect(slotGrants(rt)).toEqual(resolveSlotGrants(pack).slots);
    const urban = world('zombie-urban');
    expect(urban.pack.economy).toBeUndefined();
    expect(resolveSlotGrants(urban.pack).fromPackEconomy).toBe(false);
    expect(slotGrants(urban.rt)).toEqual(resolveSlotGrants(urban.pack).slots);
  });

  it('the turn-start ledger the library replenishes equals the grants (turn:began payload.slots)', () => {
    const live = fightOf(world('dark-fantasy').rt);
    const events: RuntimeEvent[] = [];
    const off = subscribe(live.fight.runtime, (e) => events.push(e));
    for (let i = 0; i < 12 && !events.some((e) => e.type === 'turn:began'); i += 1) value(step(live.fight));
    off();
    const began = events.find((e) => e.type === 'turn:began');
    expect(began?.payload.slots).toEqual(slotGrants(live.fight.runtime));
  });

  it('actionInfo carries cost, tags, trigger.on and valid verbatim; unknown ids are null', () => {
    const { pack } = world('dark-fantasy');
    expect(actionInfo(pack, 'parry')).toEqual({
      actionId: 'parry',
      cost: pack.actions.parry?.cost,
      tags: pack.actions.parry?.tags,
      triggerOn: 'attack:rolled[target=self]',
      valid: null,
    });
    expect(actionInfo(pack, 'cut-down')?.valid).toBe('hasTarget(adjacent)');
    expect(actionInfo(pack, 'cut-down')?.triggerOn).toBeNull();
    expect(actionInfo(pack, 'ember-surge')?.cost.points).toEqual({ pool: 'ember', amount: 2 });
    expect(actionInfo(pack, 'ember-surge')).not.toHaveProperty('effect');
    expect(actionInfo(pack, 'no-such-action')).toBeNull();
    expect(actionInfo(pack, 'constructor')).toBeNull();
  });
});

describe('threat-budget assembly (CAP-04, CA-07, CA-08)', () => {
  it('probes: dark-fantasy · 42 budget 3 seed 7 → barrow-wight ×1; zombie-urban · 42 → grave-shambler ×2 — the library result verbatim', () => {
    const dark = world('dark-fantasy');
    const r = value(assemble(dark.rt, 3, 7));
    expect(r.encounter).toEqual(assembleEncounter(world('dark-fantasy').rt, { budget: 3, seed: 7 }));
    expect(r.encounter).toEqual({
      groups: [{ id: 'barrow-wight', count: 1 }],
      threat: 3,
      budget: 3,
      seedUsed: '7',
      heuristic: 'threat-weighted-uniform',
    });
    expect(r.spawns).toEqual([{ statblockId: 'barrow-wight', instanceId: 'barrow-wight' }]);

    const urban = value(assemble(world('zombie-urban').rt, 3, 7));
    expect(urban.encounter.groups).toEqual([{ id: 'grave-shambler', count: 2 }]);
    expect(urban.spawns).toEqual([
      { statblockId: 'grave-shambler', instanceId: 'grave-shambler-1' },
      { statblockId: 'grave-shambler', instanceId: 'grave-shambler-2' },
    ]);
  });

  it('CA-07: instance ids are the returned profile ids, statblocks the groups expanded in order; spawnMonster deep-equals each profile', () => {
    const { rt } = world('dark-fantasy');
    const { encounter, spawns } = value(assemble(rt, 40, 1));
    expect(encounter.groups.length).toBeGreaterThan(1);
    const profiles = spawnEncounter(world('dark-fantasy').rt, encounter);
    expect(spawns.map((s) => s.instanceId)).toEqual(profiles.map((p) => p.id));
    expect(spawns.map((s) => s.statblockId)).toEqual(encounter.groups.flatMap((g) => Array<string>(g.count).fill(g.id)));
    spawns.forEach((s, i) => expect(spawnMonster(rt, s.statblockId, s.instanceId)).toEqual(profiles[i]));

    // The spawns begin a fight whose enemy profiles are exactly the library's.
    const ally = value(allyProfile(rt, brynn(rt), 'brynn'));
    const { sides } = value(begin(rt, ally, spawns, layout(ally, spawns)));
    expect(sides.enemies.map((e) => e.profile)).toEqual(profiles);
  });

  it('is deterministic per seed; another seed can differ (zombie-urban · 42 budget 3 seed 8 → slab-brute)', () => {
    expect(value(assemble(world('zombie-urban').rt, 3, 7))).toEqual(value(assemble(world('zombie-urban').rt, 3, 7)));
    const other = value(assemble(world('zombie-urban').rt, 3, 8));
    expect(other.encounter.groups).toEqual([{ id: 'slab-brute', count: 1 }]);
    expect(other.encounter.seedUsed).toBe('8');
  });

  it('a decimal budget is passed through; a budget nothing fits is empty groups, not an error (CX-D5 belongs to the store)', () => {
    const half = value(assemble(world('dark-fantasy').rt, 2.5, 7));
    expect(half.encounter).toEqual(assembleEncounter(world('dark-fantasy').rt, { budget: 2.5, seed: 7 }));
    expect(half.encounter.budget).toBe(2.5);
    const none = value(assemble(world('dark-fantasy').rt, 0.5, 7));
    expect(none).toEqual({ encounter: { groups: [], threat: 0, budget: 0.5, seedUsed: '7', heuristic: 'threat-weighted-uniform' }, spawns: [] });
  });

  it('an empty bestiary is the library throw, shaped by toAppError(fight:assemble)', () => {
    const generated = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 });
    const gate = openPack(JSON.stringify({ ...generated, bestiary: {} }));
    if (!gate.ok) throw new Error('gate rejected a pack with an empty bestiary');
    expect(assemble(gate.runtime, 3, 7)).toEqual({
      ok: false,
      error: { kind: 'unexpected', operation: 'fight:assemble', message: 'encounter assembly needs at least one bestiary statblock (FR-16).' },
    });
  });
});
