import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serialize } from '../../src/renderer/src/engine/runtime';
import { setPersistence } from '../../src/renderer/src/persistence/client';
import { createCharacterStore } from '../../src/renderer/src/store/character';
import { createWorldsStore } from '../../src/renderer/src/store/worlds';
import { createInProcessBridge } from '../support/in-process-bridge';
import { makeTmpDir } from '../support/tmp';

const KNOBS = { threat: 'medium', 'spell-density': 3, grittiness: 'heroic', 'demihuman-caps': 'on' };
const BRYNN = { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] };

let root: string;
let cleanup: () => void;

beforeEach(() => {
  ({ dir: root, cleanup } = makeTmpDir('character-store-'));
  setPersistence(createInProcessBridge(root));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

async function worldWith(seed: number) {
  const worlds = createWorldsStore();
  expect(await worlds.getState().forge({ themeId: 'dark-fantasy', seed, knobs: KNOBS })).toBe(true);
  const active = worlds.getState().active;
  if (!active) throw new Error('no active world');
  return { worlds, active };
}

async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('character store over the real library and handlers', () => {
  it('publishes a fresh view after every in-place library mutation; rejections leave the view untouched', async () => {
    const { worlds } = await worldWith(42);
    const chars = createCharacterStore(worlds);
    expect(chars.getState().create(BRYNN)).toBe(true);
    const first = chars.getState().view;
    expect(first?.derived).toMatchObject({ hp: 27, ac: 12 });
    expect(chars.getState().poolsAtRest).toEqual({ ember: 18 });

    chars.getState().spend('ember', 3);
    const drained = chars.getState().view;
    expect(drained).not.toBe(first);
    expect(drained?.state.pools.ember).toBe(15);
    expect(first?.state.pools.ember).toBe(18);
    expect(chars.getState().lastEvents.map((e) => e.type)).toEqual(['pool:drained']);

    chars.getState().cast('ward-sigil');
    expect(chars.getState().view).toBe(drained);
    const err = chars.getState().errors.spells;
    expect(err?.kind === 'library' && err.cards.map((c) => c.rule)).toEqual(['not-prepared']);

    chars.getState().prepare('ward-sigil');
    expect(chars.getState().errors.spells).toBeUndefined();
    expect(chars.getState().view?.state.slots['1']).toEqual(['ward-sigil', null]);

    chars.getState().rest();
    expect(chars.getState().view?.state.pools.ember).toBe(18);

    chars.getState().apply('sapped');
    expect(chars.getState().view?.restrictedActions).toContain('strike');
    chars.getState().tick();
    expect(chars.getState().view?.state.conditions).toEqual([{ conditionId: 'sapped', duration: 2 }]);
    chars.getState().remove('sapped');
    expect(chars.getState().view?.state.conditions).toEqual([]);

    chars.getState().awardXp(2500);
    expect(chars.getState().view?.derived.hp).toBe(28);
    chars.getState().setLevels([{ id: 'warden', level: 99 }]);
    const progress = chars.getState().errors.progress;
    expect(progress?.kind === 'library' && progress.name).toBe('CharacterBuildError');
    expect(chars.getState().view?.state.level).toBe(2);
  });

  it('a create rejection keeps the current character', async () => {
    const { worlds } = await worldWith(42);
    const chars = createCharacterStore(worlds);
    chars.getState().create(BRYNN);
    const view = chars.getState().view;
    expect(chars.getState().create({ ...BRYNN, race: 'nope' })).toBe(false);
    expect(chars.getState().errors.create?.kind).toBe('library');
    expect(chars.getState().view).toBe(view);
  });

  it('saves a snapshot that survives a fresh bridge and restores identical serialized state (CA-06)', async () => {
    const { worlds, active } = await worldWith(42);
    const chars = createCharacterStore(worlds);
    chars.getState().create(BRYNN);
    chars.getState().awardXp(2500);
    const character = chars.getState().character;
    if (!character) throw new Error('no character');
    const expected = serialize(active.runtime, character);

    expect(await chars.getState().saveSnapshot('pre-combat')).toBe(true);
    const onDisk = JSON.parse(readFileSync(join(root, 'snapshots', active.meta.id, 'pre-combat.json'), 'utf8'));
    expect(onDisk.snapshot).toEqual(expected);
    expect(onDisk.packIdentity).toEqual(expected.pack);

    expect(await chars.getState().saveSnapshot('pre-combat')).toBe(false);
    expect(chars.getState().errors.snapshots).toMatchObject({ kind: 'host', code: 'name-collision' });

    // "Restart": a fresh bridge, worlds store and character store on the same root.
    setPersistence(createInProcessBridge(root));
    const worlds2 = createWorldsStore();
    const chars2 = createCharacterStore(worlds2);
    expect(await worlds2.getState().open(active.meta.id)).toBe(true);
    await settle();
    expect(chars2.getState().character).toBeNull();
    expect(chars2.getState().snapshots.map((s) => [s.name, s.packIdentity])).toEqual([['pre-combat', expected.pack]]);
    expect(await chars2.getState().loadSnapshot('pre-combat')).toBe(true);
    const restored = chars2.getState().character;
    if (!restored) throw new Error('not restored');
    expect(JSON.stringify(serialize(worlds2.getState().active!.runtime, restored))).toBe(JSON.stringify(expected));
    expect(chars2.getState().view?.derived.hp).toBe(28);

    expect(await chars2.getState().deleteSnapshot('pre-combat')).toBe(true);
    expect(chars2.getState().snapshots).toEqual([]);
  });

  it("another world's snapshot file is refused with E-SNAP-01 and no character is created", async () => {
    const { worlds, active } = await worldWith(42);
    const chars = createCharacterStore(worlds);
    chars.getState().create(BRYNN);
    expect(await chars.getState().saveSnapshot('pre-combat')).toBe(true);

    expect(await worlds.getState().forge({ themeId: 'dark-fantasy', seed: 43, knobs: KNOBS })).toBe(true);
    const other = worlds.getState().active!.meta.id;
    await settle();
    expect(chars.getState().worldId).toBe(other);
    expect(chars.getState().character).toBeNull();

    // The hand-off copies the file; storage requires the envelope's worldId to match its directory.
    const dir = join(root, 'snapshots', other);
    mkdirSync(dir, { recursive: true });
    const target = join(dir, 'pre-combat.json');
    copyFileSync(join(root, 'snapshots', active.meta.id, 'pre-combat.json'), target);
    const doc = JSON.parse(readFileSync(target, 'utf8'));
    writeFileSync(target, JSON.stringify({ ...doc, worldId: other }));

    await chars.getState().refreshSnapshots();
    expect(chars.getState().snapshots.map((s) => s.name)).toEqual(['pre-combat']);
    expect(await chars.getState().loadSnapshot('pre-combat')).toBe(false);
    const err = chars.getState().errors.snapshots;
    expect(err).toMatchObject({ kind: 'library', name: 'RuntimeRuleError', operation: 'snapshot:restore' });
    expect(err?.kind === 'library' && err.cards.map((c) => c.rule)).toEqual(['E-SNAP-01']);
    expect(chars.getState().character).toBeNull();
    expect(chars.getState().view).toBeNull();
  });

  it('closing the world resets the character', async () => {
    const { worlds } = await worldWith(42);
    const chars = createCharacterStore(worlds);
    chars.getState().create(BRYNN);
    worlds.setState({ active: null });
    expect(chars.getState()).toMatchObject({ worldId: null, character: null, view: null, snapshots: [] });
  });
});
