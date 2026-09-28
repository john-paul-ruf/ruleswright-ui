/**
 * The file store (`specs/database.md`, FR-3/5/10/14). Main is the only writer of
 * userData; this module has no Electron dependency so node tests run it on real fs.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import {
  FIGHT_OUTCOMES,
  FORMAT_VERSION,
  type FightDoc,
  type FightOutcome,
  type FightRecordBody,
  type FightRecordMeta,
  type Knobs,
  type NewWorld,
  type PackIdentity,
  type Settings,
  type SkippedDoc,
  type SnapshotDoc,
  type SnapshotMeta,
  type WindowBounds,
  type WorldDoc,
} from '../shared/model';
import {
  MAX_DOC_BYTES,
  MAX_RECORD_NAME,
  MAX_WORLD_NAME,
  RECORD_NAME_PATTERN,
  type IpcErrorCode,
} from '../shared/ipc-contract';

/** A rejected store operation; the IPC layer maps `code` onto `IpcError`. */
export class StorageError extends Error {
  constructor(
    readonly code: IpcErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

type Json = Record<string, unknown>;
type Kind = 'snapshots' | 'fights';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/;

const DEFAULT_SETTINGS: Settings = { formatVersion: FORMAT_VERSION, lastWorldId: null, windowBounds: null };

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nowIso = (): string => new Date().toISOString();
const isEnoent = (e: unknown): boolean => isObject(e) && e.code === 'ENOENT';

function fail(code: IpcErrorCode, message: string): never {
  throw new StorageError(code, message);
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function checkWorldId(id: unknown): string {
  if (typeof id !== 'string' || !UUID_V4.test(id)) fail('invalid-input', `world id must be a UUID v4`);
  return id;
}

function checkWorldName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 1 || trimmed.length > MAX_WORLD_NAME) {
    fail('invalid-input', `world name must be 1–${MAX_WORLD_NAME} characters`);
  }
  return trimmed;
}

function checkRecordName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 1 || trimmed.length > MAX_RECORD_NAME || !RECORD_NAME_PATTERN.test(trimmed)) {
    fail('invalid-input', `name must match [\\w- ]+ and be 1–${MAX_RECORD_NAME} characters`);
  }
  return trimmed;
}

function isKnobs(v: unknown): v is Knobs {
  return isObject(v) && Object.values(v).every((x) => typeof x === 'string' || isFiniteNumber(x));
}

/** Required-field check (database.md); returns the first violation or null. */
function worldViolation(doc: unknown, dirId: string): string | null {
  if (!isObject(doc)) return 'not a JSON object';
  if (!isInt(doc.formatVersion) || doc.formatVersion < 1) return 'formatVersion missing or invalid';
  if (doc.formatVersion > FORMAT_VERSION) return `formatVersion ${doc.formatVersion} is newer than supported`;
  if (doc.id !== dirId) return 'id missing or does not match its directory';
  if (typeof doc.name !== 'string' || doc.name.trim().length === 0) return 'name missing';
  if (doc.theme !== null && typeof doc.theme !== 'string') return 'theme must be a string or null';
  if (doc.seed !== null && !isInt(doc.seed)) return 'seed must be an integer or null';
  if (doc.knobs !== null && !isKnobs(doc.knobs)) return 'knobs must be an object or null';
  if (!isInt(doc.schemaVersion)) return 'schemaVersion missing';
  if (typeof doc.packSha256 !== 'string' || !SHA256_HEX.test(doc.packSha256)) return 'packSha256 missing';
  if (typeof doc.createdAt !== 'string' || typeof doc.updatedAt !== 'string') return 'timestamps missing';
  return null;
}

function isPackIdentity(v: unknown): v is PackIdentity {
  return isObject(v) && typeof v.id === 'string' && isInt(v.schemaVersion) && typeof v.contentHash === 'string';
}

function envelopeViolation(doc: unknown, worldId: string, name: string): string | null {
  if (!isObject(doc)) return 'not a JSON object';
  if (!isInt(doc.formatVersion) || doc.formatVersion < 1 || doc.formatVersion > FORMAT_VERSION) {
    return 'formatVersion missing or unsupported';
  }
  if (typeof doc.id !== 'string') return 'id missing';
  if (doc.worldId !== worldId) return 'worldId missing or does not match its directory';
  if (doc.name !== name) return 'name missing or does not match its file name';
  if (typeof doc.createdAt !== 'string') return 'createdAt missing';
  return null;
}

function snapshotViolation(doc: unknown, worldId: string, name: string): string | null {
  const base = envelopeViolation(doc, worldId, name);
  if (base !== null || !isObject(doc)) return base;
  if (!isPackIdentity(doc.packIdentity)) return 'packIdentity missing';
  if (!isObject(doc.snapshot)) return 'snapshot missing';
  return null;
}

/** CX `start.positions` / `move` positions: `{[combatantId]: {x: integer, y: integer}}` (database.md). */
function isPositions(v: unknown): boolean {
  return isObject(v) && Object.values(v).every((p) => isObject(p) && isInt(p.x) && isInt(p.y));
}

/** `start.enemies` / `start.allySpawns` (CX): `[{statblockId: string, instanceId: string}]` (database.md). */
function isSpawns(v: unknown): boolean {
  return Array.isArray(v) && v.every((e) => isObject(e) && typeof e.statblockId === 'string' && typeof e.instanceId === 'string');
}

function isOutcome(v: unknown): v is FightOutcome {
  return (FIGHT_OUTCOMES as readonly unknown[]).includes(v);
}

/** FightDoc body rules, including the optional B-2 fields when present (database.md integrity rules). */
function fightBodyViolation(doc: Json): string | null {
  if (!Array.isArray(doc.declarations)) return 'declarations must be an array';
  if (!('combat' in doc) || doc.combat === undefined) return 'combat missing';
  if (!isOutcome(doc.outcome)) return `outcome must be one of ${FIGHT_OUTCOMES.join(', ')}`;
  if ('events' in doc && !Array.isArray(doc.events)) return 'events must be an array';
  if ('script' in doc) {
    if (!Array.isArray(doc.script)) return 'script must be an array';
    const optStr = (v: unknown): boolean => v === undefined || typeof v === 'string';
    for (const [i, op] of doc.script.entries()) {
      const ok =
        isObject(op) &&
        ((op.op === 'step') ||
          (op.op === 'declare' && typeof op.actionId === 'string' && optStr(op.targetId)) ||
          (op.op === 'respond' &&
            typeof op.triggerId === 'string' &&
            (op.choice === 'take' || op.choice === 'decline') &&
            optStr(op.targetId)) ||
          (op.op === 'move' && isPositions(op.positions)));
      if (!ok) return `script[${i}] is not a valid declare/respond/step/move entry`;
    }
  }
  if ('start' in doc) {
    const s = doc.start;
    if (!isObject(s) || !isObject(s.ally) || typeof s.ally.id !== 'string') return 'start.ally missing';
    if (!isObject(s.ally.snapshot) || s.ally.snapshot.kind !== 'character') {
      return "start.ally.snapshot.kind must be 'character'";
    }
    if (!isSpawns(s.enemies)) return 'start.enemies must be [{statblockId, instanceId}]';
    if ('allySpawns' in s && !isSpawns(s.allySpawns)) return 'start.allySpawns must be [{statblockId, instanceId}]';
    if ('positions' in s && !isPositions(s.positions)) return 'start.positions must be {[id]: {x: integer, y: integer}}';
  }
  return null;
}

function fightViolation(doc: unknown, worldId: string, name: string): string | null {
  return envelopeViolation(doc, worldId, name) ?? (isObject(doc) ? fightBodyViolation(doc) : null);
}

function settingsFrom(raw: Json): Settings | null {
  const lastWorldId = raw.lastWorldId ?? null;
  const windowBounds = raw.windowBounds ?? null;
  if (lastWorldId !== null && typeof lastWorldId !== 'string') return null;
  if (windowBounds !== null && !isWindowBounds(windowBounds)) return null;
  return { formatVersion: FORMAT_VERSION, lastWorldId, windowBounds };
}

function isWindowBounds(v: unknown): v is WindowBounds {
  return (
    isObject(v) &&
    isFiniteNumber(v.width) &&
    v.width >= 400 &&
    isFiniteNumber(v.height) &&
    v.height >= 400 &&
    typeof v.maximized === 'boolean' &&
    (v.x === undefined || isFiniteNumber(v.x)) &&
    (v.y === undefined || isFiniteNumber(v.y))
  );
}

function worldMeta(doc: Json): WorldDoc {
  const { id, name, theme, seed, knobs, schemaVersion, packSha256, createdAt, updatedAt } = doc;
  return {
    formatVersion: FORMAT_VERSION,
    id: id as string,
    name: name as string,
    theme: theme as string | null,
    seed: seed as number | null,
    knobs: knobs as Knobs | null,
    schemaVersion: schemaVersion as number,
    packSha256: packSha256 as string,
    createdAt: createdAt as string,
    updatedAt: updatedAt as string,
  };
}

function snapshotMeta(doc: Json): SnapshotMeta {
  return {
    formatVersion: FORMAT_VERSION,
    id: doc.id as string,
    worldId: doc.worldId as string,
    name: doc.name as string,
    createdAt: doc.createdAt as string,
    packIdentity: doc.packIdentity as PackIdentity,
  };
}

function fightMeta(doc: Json): FightRecordMeta {
  return {
    formatVersion: FORMAT_VERSION,
    id: doc.id as string,
    worldId: doc.worldId as string,
    name: doc.name as string,
    createdAt: doc.createdAt as string,
    outcome: doc.outcome as FightOutcome,
    rng: isObject(doc.combat) ? (doc.combat.rng ?? null) : null,
    round: isObject(doc.combat) && typeof doc.combat.round === 'number' ? doc.combat.round : null,
    eventCount: Array.isArray(doc.events) ? doc.events.length : null,
  };
}

const byNewest = (field: 'createdAt' | 'updatedAt') => (a: Json, b: Json) =>
  String(b[field]).localeCompare(String(a[field]));

export type Storage = ReturnType<typeof createStorage>;

/** Creates the store over `root` (= `app.getPath('userData')` in the app, a temp dir in tests). */
export function createStorage(root: string) {
  const rootDir = resolve(root);

  /** Resolves a path under root; anything that escapes it is rejected (path clamping). */
  function under(...segments: string[]): string {
    const p = resolve(rootDir, ...segments);
    if (!p.startsWith(rootDir + sep)) fail('invalid-input', 'path escapes the store');
    return p;
  }

  async function atomicWrite(file: string, text: string): Promise<void> {
    if (Buffer.byteLength(text, 'utf8') > MAX_DOC_BYTES) fail('too-large', 'document exceeds 16 MiB');
    const tmp = `${file}.tmp-${randomUUID()}`;
    try {
      await writeFile(tmp, text, 'utf8');
      await rename(tmp, file);
    } catch (e) {
      await rm(tmp, { force: true });
      throw e;
    }
  }

  const writeJson = (file: string, doc: unknown) => atomicWrite(file, JSON.stringify(doc, null, 2));

  async function readJson(file: string): Promise<unknown> {
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (e) {
      if (isEnoent(e)) fail('not-found', `${relative(file)} does not exist`);
      throw e;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  }

  const relative = (file: string): string => file.slice(rootDir.length + 1).split(sep).join('/');

  async function exists(p: string): Promise<boolean> {
    try {
      await stat(p);
      return true;
    } catch (e) {
      if (isEnoent(e)) return false;
      throw e;
    }
  }

  async function readWorldRaw(worldId: string): Promise<Json> {
    const id = checkWorldId(worldId);
    const file = under('worlds', id, 'world.json');
    const doc = await readJson(file);
    const violation = worldViolation(doc, id);
    if (violation !== null) {
      console.warn(`[storage] skipped ${relative(file)}: ${violation}`);
      fail('io', `${relative(file)} is unreadable: ${violation}`);
    }
    return doc as Json;
  }

  async function requireWorld(worldId: string): Promise<string> {
    const id = checkWorldId(worldId);
    if (!(await exists(under('worlds', id, 'world.json')))) fail('not-found', `world ${id} does not exist`);
    return id;
  }

  async function readSettingsRaw(): Promise<Json> {
    const file = under('settings.json');
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (e) {
      if (isEnoent(e)) return {};
      throw e;
    }
    try {
      const raw = JSON.parse(text) as unknown;
      if (isObject(raw) && settingsFrom(raw) !== null) return raw;
    } catch {
      // fall through: malformed settings are disposable (database.md)
    }
    console.warn('[storage] settings.json is malformed; using defaults');
    return {};
  }

  async function writeSettings(patch: Partial<Settings>): Promise<Settings> {
    const raw = { ...(await readSettingsRaw()), ...patch, formatVersion: FORMAT_VERSION };
    const settings = settingsFrom(raw);
    if (settings === null) fail('invalid-input', 'settings patch is invalid');
    await mkdir(rootDir, { recursive: true });
    await writeJson(under('settings.json'), { ...raw, ...settings });
    return settings;
  }

  function recordFile(kind: Kind, worldId: string, name: string): string {
    return under(kind, checkWorldId(worldId), `${checkRecordName(name)}.json`);
  }

  async function listRecords<T>(
    kind: Kind,
    worldId: string,
    violation: (doc: unknown, worldId: string, name: string) => string | null,
    meta: (doc: Json) => T,
  ): Promise<T[]> {
    const id = checkWorldId(worldId);
    const dir = under(kind, id);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (e) {
      if (isEnoent(e)) return [];
      throw e;
    }
    const docs: Json[] = [];
    for (const entry of entries.filter((e) => e.endsWith('.json'))) {
      const file = join(dir, entry);
      const doc = await readJson(file);
      const why = violation(doc, id, entry.slice(0, -'.json'.length));
      if (why !== null) {
        console.warn(`[storage] skipped ${relative(file)}: ${why}`);
        continue;
      }
      docs.push(doc as Json);
    }
    return docs.sort(byNewest('createdAt')).map(meta);
  }

  async function loadRecord(
    kind: Kind,
    worldId: string,
    name: string,
    violation: (doc: unknown, worldId: string, name: string) => string | null,
  ): Promise<Json> {
    const file = recordFile(kind, worldId, name);
    const doc = await readJson(file);
    const why = violation(doc, worldId, name.trim());
    if (why !== null) {
      console.warn(`[storage] skipped ${relative(file)}: ${why}`);
      fail('io', `${relative(file)} is unreadable: ${why}`);
    }
    return doc as Json;
  }

  async function createRecord(kind: Kind, worldId: string, name: string, doc: Json): Promise<void> {
    const file = recordFile(kind, worldId, name);
    await requireWorld(worldId);
    if (await exists(file)) fail('name-collision', `"${name.trim()}" already exists in this world`);
    await mkdir(under(kind, worldId), { recursive: true });
    await writeJson(file, doc);
  }

  async function deleteRecord(kind: Kind, worldId: string, name: string): Promise<{ deleted: true }> {
    const file = recordFile(kind, worldId, name);
    if (!(await exists(file))) fail('not-found', `"${name.trim()}" does not exist`);
    await rm(file);
    return { deleted: true };
  }

  /** FR-3 export: the exact bytes of `pack.json`. */
  async function readPackBytes(worldId: string): Promise<{ meta: WorldDoc; bytes: Buffer }> {
    const doc = await readWorldRaw(worldId);
    const packFile = under('worlds', worldId, 'pack.json');
    try {
      return { meta: worldMeta(doc), bytes: await readFile(packFile) };
    } catch (e) {
      if (isEnoent(e)) fail('not-found', `${relative(packFile)} does not exist`);
      throw e;
    }
  }

  return {
    readPackBytes,

    /** FR-3: every world, newest first, plus the documents that could not be read. */
    async listWorlds(): Promise<{ worlds: WorldDoc[]; skipped: SkippedDoc[] }> {
      const skipped: SkippedDoc[] = [];
      const docs: Json[] = [];
      let entries: Dirent[];
      try {
        entries = await readdir(under('worlds'), { withFileTypes: true });
      } catch (e) {
        if (isEnoent(e)) return { worlds: [], skipped };
        throw e;
      }
      for (const entry of entries.filter((e) => e.isDirectory())) {
        const location = `worlds/${entry.name}/world.json`;
        if (!UUID_V4.test(entry.name)) {
          skipped.push({ location: `worlds/${entry.name}`, reason: 'directory name is not a world id' });
          continue;
        }
        let doc: unknown;
        try {
          doc = await readJson(under('worlds', entry.name, 'world.json'));
        } catch (e) {
          if (!(e instanceof StorageError)) throw e;
          skipped.push({ location, reason: e.message });
          continue;
        }
        const reason = doc === undefined ? 'not valid JSON' : worldViolation(doc, entry.name);
        if (reason !== null) {
          skipped.push({ location, reason });
          continue;
        }
        docs.push(doc as Json);
      }
      for (const s of skipped) console.warn(`[storage] skipped ${s.location}: ${s.reason}`);
      return { worlds: docs.sort(byNewest('updatedAt')).map(worldMeta), skipped };
    },

    /** FR-1/3: the world document and its pack bytes, verbatim (CA-01). */
    async openWorld(worldId: string): Promise<{ meta: WorldDoc; packJson: string }> {
      const { meta, bytes } = await readPackBytes(worldId);
      return { meta, packJson: bytes.toString('utf8') };
    },

    /** FR-2/5: persist a forged or imported world. `pack.json` is written verbatim, before `world.json`. */
    async saveWorld(world: NewWorld, packJson: string): Promise<WorldDoc> {
      const name = checkWorldName(world.name);
      const params = [world.theme, world.seed, world.knobs];
      const allNull = params.every((p) => p === null);
      const allSet = typeof world.theme === 'string' && isInt(world.seed) && isKnobs(world.knobs);
      if (!allNull && !allSet) fail('invalid-input', 'theme, seed and knobs must be all set or all null');
      if (!isInt(world.schemaVersion)) fail('invalid-input', 'schemaVersion must be an integer');
      if (typeof packJson !== 'string' || packJson.length === 0) fail('invalid-input', 'packJson must be a string');
      if (Buffer.byteLength(packJson, 'utf8') > MAX_DOC_BYTES) fail('too-large', 'packJson exceeds 16 MiB');

      const id = randomUUID();
      const dir = under('worlds', id);
      const now = nowIso();
      const doc: WorldDoc = {
        formatVersion: FORMAT_VERSION,
        id,
        name,
        theme: world.theme,
        seed: world.seed,
        knobs: world.knobs,
        schemaVersion: world.schemaVersion,
        packSha256: sha256Hex(packJson),
        createdAt: now,
        updatedAt: now,
      };
      await mkdir(dir, { recursive: true });
      await atomicWrite(join(dir, 'pack.json'), packJson);
      await writeJson(join(dir, 'world.json'), doc);
      return doc;
    },

    /** FR-3 rename: read-merge-write, unknown fields preserved. */
    async renameWorld(worldId: string, name: string): Promise<WorldDoc> {
      const trimmed = checkWorldName(name);
      const doc = { ...(await readWorldRaw(worldId)), name: trimmed, updatedAt: nowIso() };
      await writeJson(under('worlds', worldId, 'world.json'), doc);
      return worldMeta(doc);
    },

    /** FR-3 delete: cascade worlds → snapshots → fights, then clear `lastWorldId`. */
    async deleteWorld(worldId: string): Promise<{ deleted: true }> {
      const id = checkWorldId(worldId);
      if (!(await exists(under('worlds', id)))) fail('not-found', `world ${id} does not exist`);
      await rm(under('worlds', id), { recursive: true, force: true });
      await rm(under('snapshots', id), { recursive: true, force: true });
      await rm(under('fights', id), { recursive: true, force: true });
      const settings = settingsFrom(await readSettingsRaw());
      if (settings?.lastWorldId === id) await writeSettings({ lastWorldId: null });
      return { deleted: true };
    },

    async getSettings(): Promise<Settings> {
      return settingsFrom(await readSettingsRaw()) ?? { ...DEFAULT_SETTINGS };
    },

    async setSettings(patch: Partial<Pick<Settings, 'lastWorldId' | 'windowBounds'>>): Promise<Settings> {
      if (patch.lastWorldId !== undefined && patch.lastWorldId !== null) checkWorldId(patch.lastWorldId);
      if (patch.windowBounds !== undefined && patch.windowBounds !== null && !isWindowBounds(patch.windowBounds)) {
        fail('invalid-input', 'windowBounds is invalid');
      }
      return writeSettings(patch);
    },

    listSnapshots: (worldId: string) => listRecords('snapshots', worldId, snapshotViolation, snapshotMeta),

    /** FR-10: `snapshot` is stored verbatim. */
    async saveSnapshot(worldId: string, name: string, packIdentity: PackIdentity, snapshot: unknown): Promise<SnapshotMeta> {
      if (!isPackIdentity(packIdentity)) fail('invalid-input', 'packIdentity must be {id, schemaVersion, contentHash}');
      if (!isObject(snapshot)) fail('invalid-input', 'snapshot must be an object');
      const doc: SnapshotDoc = {
        formatVersion: FORMAT_VERSION,
        id: randomUUID(),
        worldId,
        name: checkRecordName(name),
        createdAt: nowIso(),
        packIdentity,
        snapshot,
      };
      await createRecord('snapshots', worldId, name, doc as unknown as Json);
      return snapshotMeta(doc as unknown as Json);
    },

    async loadSnapshot(worldId: string, name: string): Promise<SnapshotDoc> {
      return (await loadRecord('snapshots', worldId, name, snapshotViolation)) as unknown as SnapshotDoc;
    },

    deleteSnapshot: (worldId: string, name: string) => deleteRecord('snapshots', worldId, name),

    listFights: (worldId: string) => listRecords('fights', worldId, fightViolation, fightMeta),

    /** FR-14: the body is stored verbatim under a main-minted envelope. */
    async saveFight(worldId: string, name: string, record: FightRecordBody): Promise<FightRecordMeta> {
      if (!isObject(record)) fail('invalid-input', 'record must be an object');
      const { formatVersion: _f, id: _i, worldId: _w, name: _n, createdAt: _c, ...body } = record as Json;
      const why = fightBodyViolation(body);
      if (why !== null) fail('invalid-input', why);
      const doc: Json = {
        formatVersion: FORMAT_VERSION,
        id: randomUUID(),
        worldId,
        name: checkRecordName(name),
        createdAt: nowIso(),
        ...body,
      };
      await createRecord('fights', worldId, name, doc);
      return fightMeta(doc);
    },

    async loadFight(worldId: string, name: string): Promise<FightDoc> {
      return (await loadRecord('fights', worldId, name, fightViolation)) as unknown as FightDoc;
    },

    /** FR-14: the only in-place FightDoc rewrite — `outcome` changes, everything else is preserved. */
    async setFightOutcome(worldId: string, name: string, outcome: FightOutcome): Promise<FightRecordMeta> {
      if (!isOutcome(outcome)) fail('invalid-input', `outcome must be one of ${FIGHT_OUTCOMES.join(', ')}`);
      const doc = { ...(await loadRecord('fights', worldId, name, fightViolation)), outcome };
      await writeJson(recordFile('fights', worldId, name), doc);
      return fightMeta(doc);
    },

    deleteFight: (worldId: string, name: string) => deleteRecord('fights', worldId, name),
  };
}
