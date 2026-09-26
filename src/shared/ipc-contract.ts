/**
 * The whole IPC surface (architecture "IPC API", CA-04). Request/response only;
 * ids and names cross the bridge, never filesystem paths (Custom Rule 7).
 */
import type {
  FightOutcome,
  FightRecordBody,
  FightRecordMeta,
  FightDoc,
  NewWorld,
  PackIdentity,
  Settings,
  SkippedDoc,
  SnapshotDoc,
  SnapshotMeta,
  WorldMeta,
} from './model';

/** Payload cap for `packJson` / `packText` and every stored document (16 MiB). */
export const MAX_DOC_BYTES = 16 * 1024 * 1024;
/** World names: 1–80 characters after trim. */
export const MAX_WORLD_NAME = 80;
/** Snapshot / fight names: `[\w- ]+`, trimmed, ≤ 64 characters. */
export const MAX_RECORD_NAME = 64;
export const RECORD_NAME_PATTERN = /^[\w\- ]+$/;

export type IpcErrorCode = 'invalid-input' | 'not-found' | 'name-collision' | 'io' | 'too-large';

export interface IpcError {
  code: IpcErrorCode;
  message: string;
  operation: string;
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: IpcError };

export interface Deleted {
  deleted: true;
}

/** Channel → request/response types. `void` requests take no payload. */
export interface IpcContract {
  'world:list': { req: void; res: { worlds: WorldMeta[]; skipped: SkippedDoc[] } };
  'world:open': { req: { worldId: string }; res: { meta: WorldMeta; packJson: string } };
  'world:save': { req: { world: NewWorld; packJson: string }; res: WorldMeta };
  'world:rename': { req: { worldId: string; name: string }; res: WorldMeta };
  'world:delete': { req: { worldId: string }; res: Deleted };
  'settings:get': { req: void; res: Settings };
  'settings:set': { req: Partial<Pick<Settings, 'lastWorldId'>>; res: Settings };
  'snapshot:list': { req: { worldId: string }; res: SnapshotMeta[] };
  'snapshot:save': {
    req: { worldId: string; name: string; packIdentity: PackIdentity; snapshot: unknown };
    res: SnapshotMeta;
  };
  'snapshot:load': { req: { worldId: string; name: string }; res: SnapshotDoc };
  'snapshot:delete': { req: { worldId: string; name: string }; res: Deleted };
  'fight:list': { req: { worldId: string }; res: FightRecordMeta[] };
  'fight:save': { req: { worldId: string; name: string; record: FightRecordBody }; res: FightRecordMeta };
  'fight:load': { req: { worldId: string; name: string }; res: FightDoc };
  'fight:delete': { req: { worldId: string; name: string }; res: Deleted };
  'fight:set-outcome': { req: { worldId: string; name: string; outcome: FightOutcome }; res: FightRecordMeta };
  'pack:export': { req: { worldId: string }; res: { cancelled: boolean } };
  'pack:import': { req: void; res: { cancelled: true } | { cancelled: false; packText: string } };
}

export type Channel = keyof IpcContract;
export type IpcRequest<C extends Channel> = IpcContract[C]['req'];
export type IpcResponse<C extends Channel> = IpcContract[C]['res'];

/** API method name → channel. The preload builds `window.ruleswright` from this table. */
export const IPC = {
  worldList: 'world:list',
  worldOpen: 'world:open',
  worldSave: 'world:save',
  worldRename: 'world:rename',
  worldDelete: 'world:delete',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  snapshotList: 'snapshot:list',
  snapshotSave: 'snapshot:save',
  snapshotLoad: 'snapshot:load',
  snapshotDelete: 'snapshot:delete',
  fightList: 'fight:list',
  fightSave: 'fight:save',
  fightLoad: 'fight:load',
  fightDelete: 'fight:delete',
  fightSetOutcome: 'fight:set-outcome',
  packExport: 'pack:export',
  packImport: 'pack:import',
} as const satisfies Record<string, Channel>;

export type ApiMethod<C extends Channel> = IpcRequest<C> extends void
  ? () => Promise<IpcResult<IpcResponse<C>>>
  : (req: IpcRequest<C>) => Promise<IpcResult<IpcResponse<C>>>;

/** The exact shape of `window.ruleswright`. */
export type RuleswrightApi = { [M in keyof typeof IPC]: ApiMethod<(typeof IPC)[M]> };

/** Compile-time proof that `IPC` names every channel of `IpcContract`. */
export type IpcCoversEveryChannel = Exclude<Channel, (typeof IPC)[keyof typeof IPC]> extends never ? true : never;
export const IPC_COVERS_EVERY_CHANNEL: IpcCoversEveryChannel = true;
