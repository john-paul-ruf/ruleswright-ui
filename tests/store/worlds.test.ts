import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listThemes } from '../../src/renderer/src/engine/compiler';
import { setPersistence } from '../../src/renderer/src/persistence/client';
import { createWorldsStore } from '../../src/renderer/src/store/worlds';
import { createFakeDialogs, createInProcessBridge, type FakeDialogs } from '../support/in-process-bridge';
import { makeTmpDir } from '../support/tmp';

const DEFAULT_KNOBS = { threat: 'medium', 'spell-density': 3, grittiness: 'heroic', 'demihuman-caps': 'on' };

let root: string;
let cleanup: () => void;
let dialogs: FakeDialogs;
let files: ReturnType<typeof makeTmpDir>;

beforeEach(() => {
  ({ dir: root, cleanup } = makeTmpDir('worlds-store-'));
  files = makeTmpDir('worlds-store-files-');
  dialogs = createFakeDialogs();
  setPersistence(createInProcessBridge(root, dialogs));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  files.cleanup();
});

async function forgeOne() {
  const store = createWorldsStore();
  expect(await store.getState().forge({ themeId: 'dark-fantasy', seed: 42, knobs: DEFAULT_KNOBS })).toBe(true);
  const active = store.getState().active;
  if (!active) throw new Error('no active world');
  return { store, active };
}

describe('worlds store over the real handlers (CAP-01 unit path)', () => {
  it('forges, persists, and a fresh store over a fresh bridge reopens the same bytes', async () => {
    const { store, active } = await forgeOne();
    expect(active.meta).toMatchObject({ name: 'dark-fantasy · 42', theme: 'dark-fantasy', seed: 42, knobs: DEFAULT_KNOBS });
    expect(store.getState().worlds.map((w) => w.id)).toEqual([active.meta.id]);
    expect(store.getState().forgeError).toBeNull();
    const onDisk = readFileSync(join(root, 'worlds', active.meta.id, 'pack.json'), 'utf8');
    expect(onDisk).toBe(active.packJson);

    setPersistence(createInProcessBridge(root, dialogs));
    const fresh = createWorldsStore();
    await fresh.getState().refresh();
    expect(fresh.getState().worlds.map((w) => w.id)).toEqual([active.meta.id]);
    expect(await fresh.getState().open(active.meta.id)).toBe(true);
    expect(fresh.getState().active?.packJson).toBe(active.packJson);
  });

  it('startup loads themes and reopens settings.lastWorldId', async () => {
    const { active } = await forgeOne();
    setPersistence(createInProcessBridge(root, dialogs));
    const fresh = createWorldsStore();
    await fresh.getState().startup();
    const ids = fresh.getState().themes.map((t) => t.id);
    expect(ids).toEqual(listThemes().map((t) => t.id));
    expect(ids).toEqual(expect.arrayContaining(['dark-fantasy', 'wyldwood', 'zombie-urban']));
    expect(fresh.getState().active?.meta.id).toBe(active.meta.id);
  });

  it('keeps a forge rejection as library cards without persisting anything', async () => {
    const store = createWorldsStore();
    expect(await store.getState().forge({ themeId: 'dark-fantasy', seed: 42, knobs: { 'spell-density': 99 } })).toBe(false);
    expect(store.getState().forgeError).toMatchObject({ kind: 'library', name: 'GenerationError' });
    expect(store.getState().active).toBeNull();
    expect(existsSync(join(root, 'worlds'))).toBe(false);
  });

  it('exportPack writes the stored pack.json bytes; cancel writes nothing', async () => {
    const { store, active } = await forgeOne();
    dialogs.savePath = null;
    expect(await store.getState().exportPack(active.meta.id)).toEqual({ status: 'cancelled' });
    expect(readdirSync(files.dir)).toEqual([]);

    dialogs.savePath = join(files.dir, 'export.json');
    expect(await store.getState().exportPack(active.meta.id)).toEqual({ status: 'saved' });
    const stored = readFileSync(join(root, 'worlds', active.meta.id, 'pack.json'));
    expect(readFileSync(dialogs.savePath).equals(stored)).toBe(true);
  });

  it('marks a tampered pack corrupt (session-scoped) and keeps the world listed', async () => {
    const { active } = await forgeOne();
    writeFileSync(join(root, 'worlds', active.meta.id, 'pack.json'), '{"schemaVersion":1}');
    const fresh = createWorldsStore();
    await fresh.getState().refresh();
    expect(await fresh.getState().open(active.meta.id)).toBe(false);
    expect(fresh.getState().corrupt[active.meta.id]?.kind).toBe('library');
    expect(fresh.getState().active).toBeNull();
    expect(fresh.getState().worlds.map((w) => w.id)).toEqual([active.meta.id]);
  });
});
