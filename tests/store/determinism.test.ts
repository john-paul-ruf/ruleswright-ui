import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPersistence } from '../../src/renderer/src/persistence/client';
import { createDeterminismStore } from '../../src/renderer/src/store/determinism';
import { createWorldsStore } from '../../src/renderer/src/store/worlds';
import { createInProcessBridge } from '../support/in-process-bridge';
import { makeTmpDir } from '../support/tmp';

const DEFAULT_KNOBS = { threat: 'medium', 'spell-density': 3, grittiness: 'heroic', 'demihuman-caps': 'on' };

let cleanup: () => void;

beforeEach(() => {
  const tmp = makeTmpDir('determinism-store-');
  cleanup = tmp.cleanup;
  setPersistence(createInProcessBridge(tmp.dir));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

async function forge(worlds: ReturnType<typeof createWorldsStore>, seed: number): Promise<string> {
  expect(await worlds.getState().forge({ themeId: 'dark-fantasy', seed, knobs: DEFAULT_KNOBS })).toBe(true);
  const id = worlds.getState().active?.meta.id;
  if (!id) throw new Error('no active world');
  return id;
}

describe('determinism store over the real handlers', () => {
  it('stores the rerun result under the active world id, running first', async () => {
    const worlds = createWorldsStore();
    const store = createDeterminismStore(worlds);
    const id = await forge(worlds, 42);
    const pending = store.getState().rerun();
    expect(store.getState().byWorld[id]).toBe('running');
    await pending;
    expect(store.getState().byWorld[id]).toMatchObject({
      status: 'pass',
      bytes: worlds.getState().active?.packJson.length,
    });
  });

  it("switching the active world does not show the previous world's result", async () => {
    const worlds = createWorldsStore();
    const store = createDeterminismStore(worlds);
    const first = await forge(worlds, 42);
    await store.getState().rerun();
    const second = await forge(worlds, 43);
    expect(second).not.toBe(first);
    expect(store.getState().byWorld[second]).toBeUndefined();
    expect(store.getState().byWorld[first]).toMatchObject({ status: 'pass' });

    expect(await worlds.getState().open(first)).toBe(true);
    expect(store.getState().byWorld[first]).toMatchObject({ status: 'pass' });
  });

  it('compares against the stored bytes the worlds store read from disk (CA-01)', async () => {
    const worlds = createWorldsStore();
    const store = createDeterminismStore(worlds);
    const id = await forge(worlds, 42);
    const fresh = createWorldsStore();
    expect(await fresh.getState().open(id)).toBe(true);
    const onFresh = createDeterminismStore(fresh);
    await onFresh.getState().rerun();
    expect(onFresh.getState().byWorld[id]).toMatchObject({ status: 'pass' });
    expect(store.getState().byWorld[id]).toBeUndefined();
  });

  it('does nothing without an active world', async () => {
    const store = createDeterminismStore(createWorldsStore());
    await store.getState().rerun();
    expect(store.getState().byWorld).toEqual({});
  });
});
