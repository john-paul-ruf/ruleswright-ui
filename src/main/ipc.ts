/**
 * IPC handlers (CA-04): every payload is shape-checked before any disk access,
 * and every outcome is an `IpcResult` — nothing throws across the bridge.
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import type { IpcMain } from 'electron';
import {
  MAX_DOC_BYTES,
  type Channel,
  type IpcError,
  type IpcRequest,
  type IpcResponse,
  type IpcResult,
} from '../shared/ipc-contract';
import type { Dialogs } from './dialogs';
import { StorageError, type Storage } from './storage';

type Json = Record<string, unknown>;
export type Handler = (payload: unknown) => Promise<IpcResult<unknown>>;
export type IpcHandlers = { [C in Channel]: Handler };

/** Upper bound for id/name strings before they reach storage's precise checks. */
const MAX_FIELD = 256;

class InvalidInput extends Error {}

function invalid(message: string): never {
  throw new InvalidInput(message);
}

function object(payload: unknown): Json {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) invalid('payload must be an object');
  return payload as Json;
}

function none(payload: unknown): void {
  if (payload !== undefined && payload !== null) invalid('this channel takes no payload');
}

function str(p: Json, key: string, max = MAX_FIELD): string {
  const v = p[key];
  if (typeof v !== 'string') invalid(`${key} must be a string`);
  if (v.length > max) invalid(`${key} is too long`);
  return v;
}

function bigText(p: Json, key: string): string {
  const v = p[key];
  if (typeof v !== 'string') invalid(`${key} must be a string`);
  if (Buffer.byteLength(v, 'utf8') > MAX_DOC_BYTES) throw new StorageError('too-large', `${key} exceeds 16 MiB`);
  return v;
}

function worldAndName(payload: unknown): { worldId: string; name: string } {
  const p = object(payload);
  return { worldId: str(p, 'worldId'), name: str(p, 'name') };
}

function toIpcError(operation: string, e: unknown): IpcError {
  if (e instanceof InvalidInput) return { code: 'invalid-input', message: e.message, operation };
  if (e instanceof StorageError) return { code: e.code, message: e.message, operation };
  return { code: 'io', message: e instanceof Error ? e.message : String(e), operation };
}

function exportName(name: string): string {
  return `${name.replace(/[^\w\- ·]+/g, '_')}.json`;
}

/** Builds the handler table over a store and the native dialogs (pure: node-testable). */
export function createIpcHandlers({ storage, dialogs }: { storage: Storage; dialogs: Dialogs }): IpcHandlers {
  const table: { [C in Channel]: (payload: unknown) => Promise<IpcResponse<C>> } = {
    'world:list': async (payload) => {
      none(payload);
      return storage.listWorlds();
    },
    'world:open': async (payload) => storage.openWorld(str(object(payload), 'worldId')),
    'world:save': async (payload) => {
      const p = object(payload);
      const w = object(p.world);
      const world: IpcRequest<'world:save'>['world'] = {
        name: str(w, 'name'),
        theme: w.theme === null ? null : str(w, 'theme'),
        seed: w.seed === null ? null : typeof w.seed === 'number' ? w.seed : invalid('seed must be a number or null'),
        knobs: w.knobs === null ? null : (object(w.knobs) as IpcRequest<'world:save'>['world']['knobs']),
        schemaVersion: typeof w.schemaVersion === 'number' ? w.schemaVersion : invalid('schemaVersion must be a number'),
      };
      return storage.saveWorld(world, bigText(p, 'packJson'));
    },
    'world:rename': async (payload) => {
      const p = object(payload);
      return storage.renameWorld(str(p, 'worldId'), str(p, 'name'));
    },
    'world:delete': async (payload) => storage.deleteWorld(str(object(payload), 'worldId')),
    'settings:get': async (payload) => {
      none(payload);
      return storage.getSettings();
    },
    'settings:set': async (payload) => {
      const p = object(payload);
      const keys = Object.keys(p);
      if (keys.some((k) => k !== 'lastWorldId')) invalid('only lastWorldId may be set');
      if (!('lastWorldId' in p)) return storage.getSettings();
      return storage.setSettings({ lastWorldId: p.lastWorldId === null ? null : str(p, 'lastWorldId') });
    },
    'snapshot:list': async (payload) => storage.listSnapshots(str(object(payload), 'worldId')),
    'snapshot:save': async (payload) => {
      const { worldId, name } = worldAndName(payload);
      const p = payload as Json;
      const identity = object(p.packIdentity);
      const packIdentity = {
        id: str(identity, 'id'),
        schemaVersion:
          typeof identity.schemaVersion === 'number' ? identity.schemaVersion : invalid('packIdentity.schemaVersion must be a number'),
        contentHash: str(identity, 'contentHash'),
      };
      return storage.saveSnapshot(worldId, name, packIdentity, object(p.snapshot));
    },
    'snapshot:load': async (payload) => {
      const { worldId, name } = worldAndName(payload);
      return storage.loadSnapshot(worldId, name);
    },
    'snapshot:delete': async (payload) => {
      const { worldId, name } = worldAndName(payload);
      return storage.deleteSnapshot(worldId, name);
    },
    'fight:list': async (payload) => storage.listFights(str(object(payload), 'worldId')),
    'fight:save': async (payload) => {
      const { worldId, name } = worldAndName(payload);
      const record = object((payload as Json).record);
      return storage.saveFight(worldId, name, record as unknown as IpcRequest<'fight:save'>['record']);
    },
    'fight:load': async (payload) => {
      const { worldId, name } = worldAndName(payload);
      return storage.loadFight(worldId, name);
    },
    'fight:delete': async (payload) => {
      const { worldId, name } = worldAndName(payload);
      return storage.deleteFight(worldId, name);
    },
    'fight:set-outcome': async (payload) => {
      const { worldId, name } = worldAndName(payload);
      const outcome = str(payload as Json, 'outcome') as IpcRequest<'fight:set-outcome'>['outcome'];
      return storage.setFightOutcome(worldId, name, outcome);
    },
    'pack:export': async (payload) => {
      const { meta, bytes } = await storage.readPackBytes(str(object(payload), 'worldId'));
      const target = await dialogs.saveJson(exportName(meta.name));
      if (target === null) return { cancelled: true };
      await writeFile(target, bytes);
      return { cancelled: false };
    },
    'pack:import': async (payload) => {
      none(payload);
      const source = await dialogs.openJson();
      if (source === null) return { cancelled: true };
      if ((await stat(source)).size > MAX_DOC_BYTES) throw new StorageError('too-large', 'file exceeds 16 MiB');
      return { cancelled: false, packText: await readFile(source, 'utf8') };
    },
  };

  const handlers = {} as IpcHandlers;
  for (const channel of Object.keys(table) as Channel[]) {
    handlers[channel] = async (payload) => {
      try {
        return { ok: true, value: await table[channel](payload) };
      } catch (e) {
        return { ok: false, error: toIpcError(channel, e) };
      }
    };
  }
  return handlers;
}

/** Registers every handler on Electron's `ipcMain`. */
export function registerIpc(ipcMain: Pick<IpcMain, 'handle'>, handlers: IpcHandlers): void {
  for (const channel of Object.keys(handlers) as Channel[]) {
    ipcMain.handle(channel, (_event, payload: unknown) => handlers[channel](payload));
  }
}
