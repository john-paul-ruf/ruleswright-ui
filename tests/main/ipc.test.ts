import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIpcHandlers, registerIpc, type IpcHandlers } from '../../src/main/ipc';
import { createStorage } from '../../src/main/storage';
import { IPC, MAX_DOC_BYTES, type Channel } from '../../src/shared/ipc-contract';
import { createFakeDialogs, type FakeDialogs } from '../support/in-process-bridge';
import { makeTmpDir } from '../support/tmp';

const WORLD = { name: 'w', theme: 'dark-fantasy', seed: 42, knobs: { threat: 'standard' }, schemaVersion: 1 };
const PACK = '{"manifest":{"id":"x"},"z":1,"a":"é"}';

let root: string;
let files: ReturnType<typeof makeTmpDir>;
let cleanup: () => void;
let dialogs: FakeDialogs;
let handlers: IpcHandlers;

beforeEach(() => {
  ({ dir: root, cleanup } = makeTmpDir('ipc-'));
  files = makeTmpDir('ipc-files-');
  dialogs = createFakeDialogs();
  handlers = createIpcHandlers({ storage: createStorage(root), dialogs });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  files.cleanup();
});

function snapshotTree(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .map((e) => `${e.parentPath ?? ''}/${e.name}:${e.isFile() ? readFileSync(join(e.parentPath ?? '', e.name), 'utf8') : ''}`)
    .sort();
}

async function saveWorld(): Promise<string> {
  const r = await handlers['world:save']({ world: WORLD, packJson: PACK });
  if (!r.ok) throw new Error(r.error.message);
  return (r.value as { id: string }).id;
}

describe('channel table', () => {
  it('has a handler for every channel and registers each on ipcMain', () => {
    expect(Object.keys(handlers).sort()).toEqual([...Object.values(IPC)].sort());
    const registered: string[] = [];
    registerIpc({ handle: (channel: string) => void registered.push(channel) } as never, handlers);
    expect(registered.sort()).toEqual([...Object.values(IPC)].sort());
  });
});

describe('payload validation (CA-04)', () => {
  const wid = randomUUID();
  const bad: Record<Channel, unknown[]> = {
    'world:list': ['x', { a: 1 }],
    'world:open': [undefined, 'id', { worldId: 1 }, [wid]],
    'world:save': [undefined, { world: WORLD }, { world: WORLD, packJson: 5 }, { world: 'x', packJson: PACK },
      { world: { ...WORLD, seed: '42' }, packJson: PACK }, { world: { ...WORLD, knobs: [] }, packJson: PACK }],
    'world:rename': [undefined, { worldId: wid }, { worldId: wid, name: 3 }],
    'world:delete': [undefined, { worldId: null }],
    'settings:get': ['x'],
    'settings:set': [undefined, { lastWorldId: 5 }, { windowBounds: { width: 1, height: 1, maximized: false } }],
    'snapshot:list': [undefined, { worldId: 7 }],
    'snapshot:save': [undefined, { worldId: wid, name: 'n' }, { worldId: wid, name: 'n', packIdentity: {}, snapshot: {} },
      { worldId: wid, name: 'n', packIdentity: { id: 'p', schemaVersion: 1, contentHash: 'h' }, snapshot: 'x' }],
    'snapshot:load': [undefined, { worldId: wid }, { name: 'n' }],
    'snapshot:delete': [undefined, { worldId: wid, name: 1 }],
    'fight:list': [undefined, {}],
    'fight:save': [undefined, { worldId: wid, name: 'n' }, { worldId: wid, name: 'n', record: [] }],
    'fight:load': [undefined, { worldId: wid, name: null }],
    'fight:delete': [undefined, { worldId: 1, name: 'n' }],
    'fight:set-outcome': [undefined, { worldId: wid, name: 'n' }, { worldId: wid, name: 'n', outcome: 2 }],
    'pack:export': [undefined, { worldId: 3 }],
    'pack:import': ['x', { a: 1 }],
  };

  for (const channel of Object.keys(bad) as Channel[]) {
    it(`${channel} rejects wrong payload types with invalid-input and no disk change`, async () => {
      await saveWorld();
      const before = snapshotTree(root);
      for (const payload of bad[channel]) {
        const r = await handlers[channel](payload);
        expect(r, `${channel} ${JSON.stringify(payload)}`).toEqual({
          ok: false,
          error: { code: 'invalid-input', message: expect.any(String), operation: channel },
        });
      }
      expect(snapshotTree(root)).toEqual(before);
    });
  }

  it('rejects oversize packJson with too-large and writes nothing', async () => {
    const before = snapshotTree(root);
    const r = await handlers['world:save']({ world: WORLD, packJson: 'x'.repeat(MAX_DOC_BYTES + 1) });
    expect(r).toMatchObject({ ok: false, error: { code: 'too-large', operation: 'world:save' } });
    expect(snapshotTree(root)).toEqual(before);
  });

  it('never throws: storage failures come back as IpcResult errors', async () => {
    const r = await handlers['world:open']({ worldId: randomUUID() });
    expect(r).toMatchObject({ ok: false, error: { code: 'not-found', operation: 'world:open' } });
  });

  it('fight:save refuses a script entry with an unknown op (B-2) and writes nothing', async () => {
    const worldId = await saveWorld();
    const before = snapshotTree(root);
    const record = { declarations: [], combat: {}, outcome: 'complete', script: [{ op: 'step' }, { op: 'undo' }], events: [] };
    const r = await handlers['fight:save']({ worldId, name: 'n', record });
    expect(r).toEqual({
      ok: false,
      error: { code: 'invalid-input', message: 'script[1] is not a valid declare/respond/step/move entry', operation: 'fight:save' },
    });
    expect(snapshotTree(root)).toEqual(before);
    const good = await handlers['fight:save']({ worldId, name: 'n', record: { ...record, script: [{ op: 'step' }] } });
    expect(good).toMatchObject({ ok: true, value: { name: 'n', eventCount: 0 } });
  });

  it('settings:set accepts only lastWorldId', async () => {
    const worldId = await saveWorld();
    expect(await handlers['settings:set']({ lastWorldId: worldId })).toMatchObject({
      ok: true,
      value: { lastWorldId: worldId },
    });
  });
});

describe('pack:import / pack:export (CA-01)', () => {
  it('pack:import returns the chosen file text unparsed', async () => {
    const text = '{\n  "pretty": true,\n  "b": 1, "a": 2\n}\n';
    dialogs.openPath = join(files.dir, 'in.json');
    writeFileSync(dialogs.openPath, text);
    expect(await handlers['pack:import'](undefined)).toEqual({ ok: true, value: { cancelled: false, packText: text } });
    dialogs.openPath = null;
    expect(await handlers['pack:import'](undefined)).toEqual({ ok: true, value: { cancelled: true } });
  });

  it('pack:import rejects an oversize file with too-large', async () => {
    dialogs.openPath = join(files.dir, 'big.json');
    writeFileSync(dialogs.openPath, Buffer.alloc(MAX_DOC_BYTES + 1, 0x20));
    expect(await handlers['pack:import'](undefined)).toMatchObject({ ok: false, error: { code: 'too-large' } });
  });

  it('pack:export writes the stored pack.json bytes verbatim', async () => {
    const worldId = await saveWorld();
    dialogs.savePath = join(files.dir, 'out.json');
    expect(await handlers['pack:export']({ worldId })).toEqual({ ok: true, value: { cancelled: false } });
    expect(readFileSync(dialogs.savePath).equals(readFileSync(join(root, 'worlds', worldId, 'pack.json')))).toBe(true);
    expect(dialogs.saveRequests).toEqual(['w.json']);
  });

  it('pack:export reports cancel without writing', async () => {
    const worldId = await saveWorld();
    dialogs.savePath = null;
    expect(await handlers['pack:export']({ worldId })).toEqual({ ok: true, value: { cancelled: true } });
    expect(readdirSync(files.dir)).toEqual([]);
  });
});
