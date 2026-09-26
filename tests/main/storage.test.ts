import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStorage, type Storage } from '../../src/main/storage';
import type { NewWorld } from '../../src/shared/model';
import { makeTmpDir } from '../support/tmp';

const WORLD: NewWorld = {
  name: 'dark-fantasy · 42',
  theme: 'dark-fantasy',
  seed: 42,
  knobs: { threat: 'standard', 'spell-density': 3 },
  schemaVersion: 1,
};
// Deliberately non-canonical (spacing, escape, key order): any parse/re-serialize in main changes these bytes.
const PACK = '{"b": 1, "a":2,"title":"Ælfwine’s crypt — ☠ \u00e9"}';
const IDENTITY = { id: 'dark-fantasy-42', schemaVersion: 1, contentHash: 'a5b8b1b2' };
const FIGHT = { declarations: [], combat: { rng: { a: 1, b: 2, c: 3, d: 4 } }, outcome: 'complete' as const };

let root: string;
let cleanup: () => void;
let storage: Storage;

beforeEach(() => {
  ({ dir: root, cleanup } = makeTmpDir('storage-'));
  storage = createStorage(root);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

const notV4 = (): string => {
  const id = randomUUID();
  return `${id.slice(0, 14)}1${id.slice(15)}`;
};
const readJson = (...p: string[]) => JSON.parse(readFileSync(join(root, ...p), 'utf8')) as Record<string, unknown>;

function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? allFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe('worlds (CA-01, CA-03)', () => {
  it('writes pack.json verbatim and digests its exact bytes', async () => {
    const meta = await storage.saveWorld(WORLD, PACK);
    expect(existsSync(join(root, 'worlds', meta.id, 'world.json'))).toBe(true);
    const bytes = readFileSync(join(root, 'worlds', meta.id, 'pack.json'));
    expect(bytes.equals(Buffer.from(PACK, 'utf8'))).toBe(true);
    expect(meta.packSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(readJson('worlds', meta.id, 'world.json')).toEqual(meta);
    expect(Object.keys(meta).sort()).toEqual(
      ['createdAt', 'formatVersion', 'id', 'knobs', 'name', 'packSha256', 'schemaVersion', 'seed', 'theme', 'updatedAt'],
    );
  });

  it('lists and opens the world from a fresh store over the same root, bytes intact', async () => {
    const meta = await storage.saveWorld(WORLD, PACK);
    const reopened = createStorage(root);
    const { worlds, skipped } = await reopened.listWorlds();
    expect(worlds).toEqual([meta]);
    expect(skipped).toEqual([]);
    const opened = await reopened.openWorld(meta.id);
    expect(opened.packJson).toBe(PACK);
    expect(opened.meta).toEqual(meta);
  });

  it('accepts all-null generation params and rejects a partial set', async () => {
    const imported = await storage.saveWorld({ ...WORLD, theme: null, seed: null, knobs: null }, PACK);
    expect([imported.theme, imported.seed, imported.knobs]).toEqual([null, null, null]);
    await expect(storage.saveWorld({ ...WORLD, seed: null }, PACK)).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(storage.saveWorld({ ...WORLD, seed: 4.5 }, PACK)).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(storage.saveWorld({ ...WORLD, name: '   ' }, PACK)).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(storage.saveWorld({ ...WORLD, name: 'x'.repeat(81) }, PACK)).rejects.toMatchObject({
      code: 'invalid-input',
    });
  });

  it('renames with a new updatedAt and preserves unknown fields', async () => {
    const meta = await storage.saveWorld(WORLD, PACK);
    const file = join(root, 'worlds', meta.id, 'world.json');
    writeFileSync(file, JSON.stringify({ ...readJson('worlds', meta.id, 'world.json'), futureField: { keep: true } }));
    await new Promise((r) => setTimeout(r, 5));
    const renamed = await storage.renameWorld(meta.id, '  The Barrow  ');
    expect(renamed.name).toBe('The Barrow');
    expect(renamed.updatedAt > meta.updatedAt).toBe(true);
    const onDisk = readJson('worlds', meta.id, 'world.json');
    expect(onDisk.futureField).toEqual({ keep: true });
    expect((await createStorage(root).listWorlds()).worlds[0]?.name).toBe('The Barrow');
  });

  it('skips a corrupt world.json with a reason and leaves it on disk', async () => {
    const good = await storage.saveWorld(WORLD, PACK);
    const bad = await storage.saveWorld(WORLD, PACK);
    const file = join(root, 'worlds', bad.id, 'world.json');
    const { id: _dropped, ...withoutId } = readJson('worlds', bad.id, 'world.json');
    writeFileSync(file, JSON.stringify(withoutId));
    const { worlds, skipped } = await storage.listWorlds();
    expect(worlds.map((w) => w.id)).toEqual([good.id]);
    expect(skipped).toEqual([{ location: `worlds/${bad.id}/world.json`, reason: expect.stringContaining('id') }]);
    expect(existsSync(file)).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it('cascades delete to snapshots and fights and clears lastWorldId', async () => {
    const meta = await storage.saveWorld(WORLD, PACK);
    const other = await storage.saveWorld(WORLD, PACK);
    await storage.saveSnapshot(meta.id, 'hero', IDENTITY, { kind: 'character' });
    await storage.saveFight(meta.id, 'first blood', FIGHT);
    await storage.saveSnapshot(other.id, 'hero', IDENTITY, { kind: 'character' });
    await storage.setSettings({ lastWorldId: meta.id });
    expect(await storage.deleteWorld(meta.id)).toEqual({ deleted: true });
    expect(existsSync(join(root, 'worlds', meta.id))).toBe(false);
    expect(existsSync(join(root, 'snapshots', meta.id))).toBe(false);
    expect(existsSync(join(root, 'fights', meta.id))).toBe(false);
    expect(existsSync(join(root, 'snapshots', other.id, 'hero.json'))).toBe(true);
    expect((await storage.getSettings()).lastWorldId).toBeNull();
    await expect(storage.deleteWorld(meta.id)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects bad and traversal ids with invalid-input', async () => {
    for (const id of ['nope', '..', '../../etc', notV4(), `${randomUUID()}/..`]) {
      await expect(storage.openWorld(id)).rejects.toMatchObject({ code: 'invalid-input' });
      await expect(storage.deleteWorld(id)).rejects.toMatchObject({ code: 'invalid-input' });
    }
    await expect(storage.openWorld(randomUUID())).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('settings', () => {
  it('defaults when missing and when malformed', async () => {
    expect(await storage.getSettings()).toEqual({ formatVersion: 1, lastWorldId: null, windowBounds: null });
    writeFileSync(join(root, 'settings.json'), '{not json');
    expect(await storage.getSettings()).toEqual({ formatVersion: 1, lastWorldId: null, windowBounds: null });
    expect(console.warn).toHaveBeenCalled();
  });

  it('persists patches and preserves unknown fields', async () => {
    writeFileSync(join(root, 'settings.json'), JSON.stringify({ formatVersion: 1, lastWorldId: null, extra: 7 }));
    const id = randomUUID();
    await storage.setSettings({ lastWorldId: id });
    await storage.setSettings({ windowBounds: { width: 1400, height: 900, maximized: false } });
    expect(await createStorage(root).getSettings()).toEqual({
      formatVersion: 1,
      lastWorldId: id,
      windowBounds: { width: 1400, height: 900, maximized: false },
    });
    expect(readJson('settings.json').extra).toBe(7);
    await expect(storage.setSettings({ lastWorldId: '../x' })).rejects.toMatchObject({ code: 'invalid-input' });
  });
});

describe('snapshots (CA-06)', () => {
  it('stores the body verbatim, lists meta, loads, and rejects collisions', async () => {
    const { id } = await storage.saveWorld(WORLD, PACK);
    const body = { kind: 'character', snapshotVersion: 1, pack: IDENTITY, state: { hp: 7, nested: [1, 'two'] } };
    const meta = await storage.saveSnapshot(id, '  Hero one ', IDENTITY, body);
    expect(meta).toMatchObject({ worldId: id, name: 'Hero one', packIdentity: IDENTITY });
    expect(meta).not.toHaveProperty('snapshot');
    expect(await storage.listSnapshots(id)).toEqual([meta]);
    expect((await storage.loadSnapshot(id, 'Hero one')).snapshot).toEqual(body);
    await expect(storage.saveSnapshot(id, 'Hero one', IDENTITY, body)).rejects.toMatchObject({
      code: 'name-collision',
    });
    await expect(storage.saveSnapshot(id, 'bad/name', IDENTITY, body)).rejects.toMatchObject({
      code: 'invalid-input',
    });
    await expect(storage.saveSnapshot(id, '..', IDENTITY, body)).rejects.toMatchObject({ code: 'invalid-input' });
    await expect(storage.saveSnapshot(randomUUID(), 'x', IDENTITY, body)).rejects.toMatchObject({ code: 'not-found' });
    expect(await storage.deleteSnapshot(id, 'Hero one')).toEqual({ deleted: true });
    expect(await storage.listSnapshots(id)).toEqual([]);
    await expect(storage.loadSnapshot(id, 'Hero one')).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('fights (D-21)', () => {
  it('saves under a main-minted envelope and lists meta', async () => {
    const { id } = await storage.saveWorld(WORLD, PACK);
    const meta = await storage.saveFight(id, 'first blood', FIGHT);
    expect(meta).toMatchObject({ worldId: id, name: 'first blood', outcome: 'complete' });
    expect(await storage.listFights(id)).toEqual([meta]);
    expect(await storage.loadFight(id, 'first blood')).toMatchObject(FIGHT);
    await expect(storage.saveFight(id, 'first blood', FIGHT)).rejects.toMatchObject({ code: 'name-collision' });
    await expect(
      storage.saveFight(id, 'bad', { ...FIGHT, outcome: 'won' as unknown as 'complete' }),
    ).rejects.toMatchObject({ code: 'invalid-input' });
  });

  it('set-outcome rewrites only outcome, keeps unknown fields, validates the enum', async () => {
    const { id } = await storage.saveWorld(WORLD, PACK);
    await storage.saveFight(id, 'replayed', FIGHT);
    const file = join(root, 'fights', id, 'replayed.json');
    const before = { ...readJson('fights', id, 'replayed.json'), futureField: [1, 2] };
    writeFileSync(file, JSON.stringify(before));
    const meta = await storage.setFightOutcome(id, 'replayed', 'diverged');
    expect(meta.outcome).toBe('diverged');
    expect(readJson('fights', id, 'replayed.json')).toEqual({ ...before, outcome: 'diverged' });
    await expect(
      storage.setFightOutcome(id, 'replayed', 'lost' as unknown as 'diverged'),
    ).rejects.toMatchObject({ code: 'invalid-input' });
    expect(readJson('fights', id, 'replayed.json').outcome).toBe('diverged');
    await expect(storage.setFightOutcome(id, 'missing', 'diverged')).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('fights — B-2 replay fields (CA-09)', () => {
  const B2 = {
    ...FIGHT,
    combat: { kind: 'combat', round: 4, rng: { a: 1, b: 2, c: 3, d: 4 } },
    start: {
      ally: { id: 'brynn', snapshot: { kind: 'character', state: { name: 'Brynn' } } },
      enemies: [{ statblockId: 'barrow-wight', instanceId: 'barrow-wight-1' }],
    },
    script: [
      { op: 'declare', actionId: 'strike', targetId: 'barrow-wight-1' },
      { op: 'declare', actionId: 'strike' },
      { op: 'respond', triggerId: 'brynn.parry', choice: 'decline' },
      { op: 'respond', triggerId: 'brynn.parry', choice: 'take', targetId: 'barrow-wight-1' },
      { op: 'step' },
    ],
    events: [{ type: 'combat:start' }, { type: 'turn:began' }],
    futureField: { kept: true },
  } as const;

  it('stores start/script/events verbatim (unknown fields kept); the list projects rng, round and event count only', async () => {
    const { id } = await storage.saveWorld(WORLD, PACK);
    await storage.saveFight(id, 'barrow watch', B2 as never);
    const doc = await storage.loadFight(id, 'barrow watch');
    expect(doc).toMatchObject(B2);
    const [meta] = await storage.listFights(id);
    expect(Object.keys(meta ?? {}).sort()).toEqual(
      ['createdAt', 'eventCount', 'formatVersion', 'id', 'name', 'outcome', 'rng', 'round', 'worldId'].sort(),
    );
    expect(meta).toMatchObject({ rng: { a: 1, b: 2, c: 3, d: 4 }, round: 4, eventCount: 2 });
  });

  it('a legacy record without the B-2 fields still lists and loads', async () => {
    const { id } = await storage.saveWorld(WORLD, PACK);
    await storage.saveFight(id, 'legacy', FIGHT);
    expect(await storage.listFights(id)).toMatchObject([{ name: 'legacy', rng: { a: 1, b: 2, c: 3, d: 4 }, round: null, eventCount: null }]);
    const doc = await storage.loadFight(id, 'legacy');
    expect([doc.script, doc.start, doc.events]).toEqual([undefined, undefined, undefined]);
  });

  it('rejects a bad op, a bad choice, bad enemies, a non-character ally, non-array events and an oversize record', async () => {
    const { id } = await storage.saveWorld(WORLD, PACK);
    const bad = [
      { ...B2, script: [{ op: 'jump' }] },
      { ...B2, script: [{ op: 'declare' }] },
      { ...B2, script: [{ op: 'respond', triggerId: 't', choice: 'maybe' }] },
      { ...B2, script: [{ op: 'declare', actionId: 'strike', targetId: 7 }] },
      { ...B2, start: { ...B2.start, enemies: [{ statblockId: 'barrow-wight' }] } },
      { ...B2, start: { ...B2.start, ally: { id: 'brynn', snapshot: { kind: 'party' } } } },
      { ...B2, events: {} },
    ];
    for (const [i, record] of bad.entries()) {
      await expect(storage.saveFight(id, `bad ${i}`, record as never), JSON.stringify(record)).rejects.toMatchObject({ code: 'invalid-input' });
    }
    const huge = { ...B2, events: ['x'.repeat(16 * 1024 * 1024)] };
    await expect(storage.saveFight(id, 'huge', huge as never)).rejects.toMatchObject({ code: 'too-large' });
    expect(await storage.listFights(id)).toEqual([]);
  });
});

describe('atomic writes', () => {
  it('leaves no .tmp- files behind', async () => {
    const { id } = await storage.saveWorld(WORLD, PACK);
    await storage.renameWorld(id, 'renamed');
    await storage.setSettings({ lastWorldId: id });
    await storage.saveSnapshot(id, 'hero', IDENTITY, { kind: 'character' });
    await storage.saveFight(id, 'fight', FIGHT);
    await storage.setFightOutcome(id, 'fight', 'abandoned');
    expect(allFiles(root).filter((f) => f.includes('.tmp-'))).toEqual([]);
  });
});
