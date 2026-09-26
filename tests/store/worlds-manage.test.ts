import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { createCharacter, Runtime, serializeCharacter } from 'ruleswright/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPersistence, setPersistence } from '../../src/renderer/src/persistence/client';
import { createWorldsStore } from '../../src/renderer/src/store/worlds';
import { createFakeDialogs, createInProcessBridge, type FakeDialogs } from '../support/in-process-bridge';
import { makeTmpDir } from '../support/tmp';

let root: string;
let cleanup: () => void;
let dialogs: FakeDialogs;
let files: ReturnType<typeof makeTmpDir>;

beforeEach(() => {
  ({ dir: root, cleanup } = makeTmpDir('worlds-manage-'));
  files = makeTmpDir('worlds-manage-files-');
  dialogs = createFakeDialogs();
  setPersistence(createInProcessBridge(root, dialogs));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  files.cleanup();
});

async function forgeOne(seed = 42) {
  const store = createWorldsStore();
  expect(await store.getState().forge({ themeId: 'dark-fantasy', seed, knobs: {} })).toBe(true);
  const active = store.getState().active;
  if (!active) throw new Error('no active world');
  return { store, active };
}

function readWorldDoc(worldId: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, 'worlds', worldId, 'world.json'), 'utf8')) as Record<string, unknown>;
}

describe('world management over the real handlers (CAP-02 store path)', () => {
  it('rename persists across a fresh bridge and updates the open world', async () => {
    const { store, active } = await forgeOne();
    expect(await store.getState().rename(active.meta.id, '  Barrow Test ')).toBeNull();
    expect(store.getState().active?.meta.name).toBe('Barrow Test');
    expect(store.getState().worlds[0]?.name).toBe('Barrow Test');

    setPersistence(createInProcessBridge(root, dialogs));
    const fresh = createWorldsStore();
    await fresh.getState().refresh();
    expect(fresh.getState().worlds.map((w) => w.name)).toEqual(['Barrow Test']);
    expect(readWorldDoc(active.meta.id).name).toBe('Barrow Test');
  });

  it('rejects an empty or 81-character name as host invalid-input and keeps the old name', async () => {
    const { store, active } = await forgeOne();
    for (const name of ['   ', 'x'.repeat(81)]) {
      expect(await store.getState().rename(active.meta.id, name)).toMatchObject({ kind: 'host', code: 'invalid-input' });
    }
    expect(readWorldDoc(active.meta.id).name).toBe('dark-fantasy · 42');
    expect(await store.getState().rename(active.meta.id, 'x'.repeat(80))).toBeNull();
  });

  it('deleteCounts names the snapshots and fights a delete would cascade over', async () => {
    const { store, active } = await forgeOne();
    expect(await store.getState().deleteCounts(active.meta.id)).toEqual({ snapshots: 0, fights: 0 });

    const runtime = new Runtime(JSON.parse(active.packJson));
    const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] });
    const snap = serializeCharacter(runtime, character.state);
    const saved = await getPersistence().snapshotSave({
      worldId: active.meta.id,
      name: 'pre',
      packIdentity: snap.pack,
      snapshot: snap,
    });
    expect(saved.ok).toBe(true);
    expect(await store.getState().deleteCounts(active.meta.id)).toEqual({ snapshots: 1, fights: 0 });
  });

  it('remove cascades, closes the open world and clears lastWorldId', async () => {
    const { store, active } = await forgeOne();
    const { active: other } = await forgeOne(43);
    await store.getState().refresh();
    expect(store.getState().worlds).toHaveLength(2);
    await store.getState().open(active.meta.id);

    expect(await store.getState().remove(active.meta.id)).toBeNull();
    expect(store.getState().active).toBeNull();
    expect(store.getState().worlds.map((w) => w.id)).toEqual([other.meta.id]);
    expect(existsSync(join(root, 'worlds', active.meta.id))).toBe(false);
    const settings = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as { lastWorldId: string | null };
    expect(settings.lastWorldId).toBeNull();

    expect(await store.getState().remove(active.meta.id)).toMatchObject({ kind: 'host' });
  });
});

describe('import over the real handlers (CAP-03 store path)', () => {
  const zombie = () => generateCampaign({ theme: loadTheme('zombie-urban'), seed: 5 });

  it('stores a pretty-printed pack canonically with its provenance params, and opens it', async () => {
    const store = createWorldsStore();
    const pack = zombie();
    expect(await store.getState().importFromText(JSON.stringify(pack, null, 2))).toBe(true);
    const active = store.getState().active;
    expect(active?.meta).toMatchObject({ name: 'zombie-urban · 5', theme: 'zombie-urban', seed: 5 });
    expect(active?.meta.knobs).toEqual(pack.manifest.provenance?.knobs ?? {});
    expect(readFileSync(join(root, 'worlds', active?.meta.id ?? '-', 'pack.json'), 'utf8')).toBe(JSON.stringify(pack));
    expect(store.getState().worlds).toHaveLength(1);
    expect(store.getState().importError).toBeNull();
  });

  it('without provenance all three params are null and the name is the manifest title', async () => {
    const store = createWorldsStore();
    const pack = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 3 });
    const { provenance: _dropped, ...manifest } = pack.manifest;
    expect(await store.getState().importFromText(JSON.stringify({ ...pack, manifest }))).toBe(true);
    const meta = store.getState().active?.meta;
    expect(meta).toMatchObject({ theme: null, seed: null, knobs: null, name: manifest.title });
    expect(readWorldDoc(meta?.id ?? '-')).toMatchObject({ theme: null, seed: null, knobs: null });
  });

  it('a rejected pack is a library error and writes nothing', async () => {
    const { store } = await forgeOne();
    expect(await store.getState().importFromText('{"schemaVersion":1}')).toBe(false);
    expect(store.getState().importError).toMatchObject({ kind: 'library', name: 'PackLoadError' });
    expect(readdirSync(join(root, 'worlds'))).toHaveLength(1);
    expect(store.getState().worlds).toHaveLength(1);
  });

  it('importFromFile reads the dialog pick; cancel changes nothing', async () => {
    const store = createWorldsStore();
    dialogs.openPath = null;
    expect(await store.getState().importFromFile()).toBe('cancelled');
    expect(existsSync(join(root, 'worlds'))).toBe(false);

    const file = join(files.dir, 'pack.json');
    writeFileSync(file, JSON.stringify(zombie(), null, 2));
    dialogs.openPath = file;
    expect(await store.getState().importFromFile()).toBe(true);
    expect(store.getState().active?.meta).toMatchObject({ theme: 'zombie-urban', seed: 5 });
  });
});
