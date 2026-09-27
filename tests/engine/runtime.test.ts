import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { describe, expect, it } from 'vitest';
import type { AppError } from '../../src/renderer/src/engine/errors';
import {
  apply,
  awardXp,
  cast,
  checkBuild,
  create,
  drop,
  grant,
  loot,
  lootTableIds,
  prepare,
  restNow,
  restore,
  serialize,
  setLevels,
  spend,
  tick,
  viewOf,
  type Character,
  type Outcome,
} from '../../src/renderer/src/engine/runtime';
import { openPack, type Runtime } from '../../src/renderer/src/engine/schema';

function runtimeFor(theme: string, seed: number): Runtime {
  const gate = openPack(JSON.stringify(generateCampaign({ theme: loadTheme(theme), seed })));
  if (!gate.ok) throw new Error('gate rejected a forged pack');
  return gate.runtime;
}

function value<T>(r: Outcome<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

function rules(r: Outcome<unknown>): string[] {
  if (r.ok) throw new Error('expected a rejection');
  return library(r.error).cards.map((c) => c.rule);
}

function library(e: AppError): Extract<AppError, { kind: 'library' }> {
  if (e.kind !== 'library') throw new Error(`expected a library error, got ${e.kind}`);
  return e;
}

function brynn(rt: Runtime): Character {
  return value(create(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }));
}

describe('character wrappers over the real library (dark-fantasy · 42)', () => {
  it('creates a warden whose derived hp/ac come from the pack formulas', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const view = viewOf(rt, brynn(rt));
    expect(view.derived.hp).toBe(27);
    expect(view.derived.ac).toBe(12);
    expect(view.pools).toEqual(['ember']);
    expect(view.state.slots).toEqual({ '1': [null, null] });
    expect(view.known).toHaveLength(15);
  });

  it('prepare → cast emits spell:cast; casting an empty slot is not-prepared with slots unchanged', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    expect(value(prepare(rt, c, 'ward-sigil')).type).toBe('spell:prepared');
    expect(value(cast(rt, c, 'ward-sigil')).type).toBe('spell:cast');
    const slots = structuredClone(c.state.slots);
    const again = cast(rt, c, 'ward-sigil');
    expect(rules(again)).toEqual(['not-prepared']);
    if (!again.ok) expect(again.error).toMatchObject({ operation: 'character:cast', name: 'RuntimeRuleError' });
    expect(c.state.slots).toEqual(slots);
  });

  it('overspending a pool is insufficient-points with pools unchanged; rest restores the pool', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    const pools = { ...c.state.pools };
    expect(rules(spend(rt, c, 'ember', 9999))).toEqual(['insufficient-points']);
    expect(c.state.pools).toEqual(pools);
    expect(value(spend(rt, c, 'ember', 5)).type).toBe('pool:drained');
    expect(value(restNow(rt, c)).type).toBe('rest:completed');
    expect(c.state.pools.ember).toBe(18);
  });

  it('sapped restricts strike; ticking expires it with condition:removed', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    expect(value(apply(rt, c, 'sapped')).type).toBe('condition:applied');
    expect(viewOf(rt, c).restrictedActions).toContain('strike');
    const emitted: string[] = [];
    for (let i = 0; i < 20 && c.state.conditions.length > 0; i++) emitted.push(...value(tick(rt, c)).map((e) => e.type));
    expect(c.state.conditions).toEqual([]);
    expect(emitted).toEqual(['condition:removed']);
    expect(viewOf(rt, c).restrictedActions).not.toContain('strike');
  });

  it('awardXp(2500) reaches level 2 and hp 28; an illegal level-set is rejected with both named rules', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    expect(value(awardXp(rt, c, 2500)).map((e) => e.type)).toEqual(['xp:awarded', 'level:reached']);
    expect(c.state.level).toBe(2);
    expect(viewOf(rt, c).derived.hp).toBe(28);
    const before = structuredClone(c.state);
    const r = setLevels(rt, c, [{ id: 'warden', level: 99 }]);
    expect(rules(r)).toEqual(['missing-progression', 'race-cap-exceeded']);
    if (!r.ok) expect(library(r.error).name).toBe('CharacterBuildError');
    expect(c.state).toEqual(before);
    expect(checkBuild(rt, 'hillfolk', [{ id: 'warden', level: 99 }]).map((card) => card.rule)).toEqual([
      'missing-progression',
      'race-cap-exceeded',
    ]);
    expect(checkBuild(rt, 'hillfolk', [{ id: 'warden', level: 1 }])).toEqual([]);
  });

  it('viewOf returns a detached clone', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    const view = viewOf(rt, c);
    view.state.pools.ember = 0;
    view.state.classes.push({ id: 'hexer', level: 3 });
    expect(c.state.pools.ember).toBe(18);
    expect(c.state.classes).toEqual([{ id: 'warden', level: 1 }]);
  });

  it('serialize → restore round-trips on the same runtime; another seed refuses with E-SNAP-01', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    value(awardXp(rt, c, 2500));
    const snap = serialize(rt, c);
    expect(snap).toMatchObject({ kind: 'character', snapshotVersion: 1 });
    expect(snap.pack.contentHash).toMatch(/^[0-9a-f]{8}$/);
    const back = value(restore(rt, snap));
    expect(JSON.stringify(serialize(rt, back))).toBe(JSON.stringify(snap));

    const r = restore(runtimeFor('dark-fantasy', 43), snap);
    expect(rules(r)).toEqual(['E-SNAP-01']);
    if (!r.ok) expect(r.error).toMatchObject({ operation: 'snapshot:restore', name: 'RuntimeRuleError' });
  });

  it('create rejects an unknown race with the library card', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const r = create(rt, { name: 'X', race: 'no-such-race', classes: [{ id: 'warden', level: 1 }] });
    expect(rules(r)).toContain('unknown-race');
  });
});

describe('zombie-urban · 42 — no spell casting', () => {
  it('has pools adrenaline/stamina, no slots and no known spells', () => {
    const rt = runtimeFor('zombie-urban', 42);
    const view = viewOf(rt, value(create(rt, { name: 'Z', race: 'mile-born', classes: [{ id: 'scavenger', level: 1 }] })));
    expect(view.pools).toEqual(['adrenaline', 'stamina']);
    expect(view.known).toEqual([]);
    expect(view.state.slots).toEqual({});
  });
});

describe('inventory & loot wrappers over the real library (FR-18, CA-13/14/05)', () => {
  it('loot(barrow-loot, 42) grants grave-ward ×1 with loot:rolled then item:granted; the same seed stacks', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    const events = value(loot(rt, c, 'barrow-loot', 42));
    expect(events.map((e) => [e.type, e.why.rule])).toEqual([
      ['loot:rolled', 'tables.barrow-loot'],
      ['item:granted', 'content.items.grave-ward'],
    ]);
    expect(c.state.inventory).toEqual([{ id: 'grave-ward', qty: 1 }]);
    value(loot(rt, c, 'barrow-loot', 42));
    expect(viewOf(rt, c).state.inventory).toEqual([{ id: 'grave-ward', qty: 2 }]);
  });

  it('drop overdraw is insufficient-qty with the inventory unchanged; drop 1 emits item:dropped', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    value(loot(rt, c, 'barrow-loot', 42));
    const r = drop(rt, c, 'grave-ward', 5);
    expect(rules(r)).toEqual(['insufficient-qty']);
    if (!r.ok) expect(r.error).toMatchObject({ operation: 'character:drop-item', name: 'RuntimeRuleError' });
    expect(c.state.inventory).toEqual([{ id: 'grave-ward', qty: 1 }]);
    expect(value(drop(rt, c, 'grave-ward', 1))).toMatchObject({ type: 'item:dropped', why: { rule: 'content.items.grave-ward' } });
    expect(c.state.inventory).toEqual([]);
  });

  it('grant stacks a pack item; an unknown item is unknown-item with nothing changed', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    expect(value(grant(rt, c, 'hearth-bread', 2))).toMatchObject({ type: 'item:granted', why: { rule: 'content.items.hearth-bread' } });
    expect(c.state.inventory).toEqual([{ id: 'hearth-bread', qty: 2 }]);
    expect(rules(grant(rt, c, 'nope', 1))).toEqual(['unknown-item']);
    expect(c.state.inventory).toEqual([{ id: 'hearth-bread', qty: 2 }]);
  });

  it('a flavor table is loot-grants-nothing, an unknown table unknown-table, an unresolved nested roll unresolvable-ref — inventory unchanged', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const c = brynn(rt);
    value(grant(rt, c, 'hearth-bread', 1));
    const held = structuredClone(c.state.inventory);
    const flavor = loot(rt, c, 'barrow-mood', 42);
    expect(rules(flavor)).toEqual(['loot-grants-nothing']);
    if (!flavor.ok) expect(flavor.error).toMatchObject({ operation: 'character:loot', name: 'RuntimeRuleError' });
    expect(rules(loot(rt, c, 'no-such-table', 42))).toEqual(['unknown-table']);
    // SESSION-02 c0 probe: barrow-loot seed 4 rolls an entry whose nested table reference does not resolve.
    expect(rules(loot(rt, c, 'barrow-loot', 4))).toEqual(['unresolvable-ref']);
    expect(c.state.inventory).toEqual(held);
  });

  it('lootTableIds are the -loot tables; zombie-urban has none', () => {
    expect(lootTableIds(runtimeFor('dark-fantasy', 42))).toEqual(['barrow-loot']);
    expect(lootTableIds(runtimeFor('zombie-urban', 42))).toEqual([]);
  });

  it('viewOf items carry the pack name/kind verbatim, in pack order', () => {
    const rt = runtimeFor('dark-fantasy', 42);
    const view = viewOf(rt, brynn(rt));
    expect(view.items).toEqual(
      Object.entries(rt.pack.content.items ?? {}).map(([id, def]) => ({ id, name: def.name, kind: def.kind ?? null })),
    );
    expect(view.items.find((i) => i.id === 'grave-ward')).toEqual({ id: 'grave-ward', name: 'Grave Ward', kind: 'charm' });
    expect(view.lootTables).toEqual(['barrow-loot']);
    expect(view.state.inventory).toEqual([]);
  });
});
