/**
 * Realization of `specs/database.md` (DB-owned, Custom Rule 8): any change to
 * these document shapes is a DB re-entry, not a session scope adjustment.
 */

export const FORMAT_VERSION = 1 as const;

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

/** `settings.json` (FR-3, NFR-Platform). */
export interface Settings {
  formatVersion: 1;
  lastWorldId: string | null;
  windowBounds: WindowBounds | null;
}

export type Knobs = Record<string, string | number>;

/** `worlds/<id>/world.json` — identity + generation parameters (FR-2/3/5/14). */
export interface WorldDoc {
  formatVersion: 1;
  id: string;
  name: string;
  theme: string | null;
  seed: number | null;
  knobs: Knobs | null;
  schemaVersion: number;
  packSha256: string;
  createdAt: string;
  updatedAt: string;
}

export type WorldMeta = WorldDoc;

/** What the renderer supplies when persisting a forged/imported world; main mints the rest. */
export interface NewWorld {
  name: string;
  theme: string | null;
  seed: number | null;
  knobs: Knobs | null;
  schemaVersion: number;
}

export interface PackIdentity {
  id: string;
  schemaVersion: number;
  contentHash: string;
}

/** `snapshots/<worldId>/<name>.json` (FR-10); `snapshot` is verbatim `serializeCharacter` output. */
export interface SnapshotDoc {
  formatVersion: 1;
  id: string;
  worldId: string;
  name: string;
  createdAt: string;
  packIdentity: PackIdentity;
  snapshot: unknown;
}

export type SnapshotMeta = Omit<SnapshotDoc, 'snapshot'>;

export type FightOutcome = 'complete' | 'diverged' | 'abandoned';

export const FIGHT_OUTCOMES: readonly FightOutcome[] = ['complete', 'diverged', 'abandoned'];

/** One host call of a recorded fight, in order (B-2 `script`): rejected declares included. */
export type FightScriptEntry =
  | { op: 'declare'; actionId: string; targetId?: string }
  | { op: 'respond'; triggerId: string; choice: 'take' | 'decline'; targetId?: string }
  | { op: 'step' };

/** What a recorded fight was started from (B-2 `start`); the snapshot is verbatim `serializeCharacter` output. */
export interface FightStartDoc {
  ally: { id: string; snapshot: unknown };
  enemies: { statblockId: string; instanceId: string }[];
}

/**
 * `fights/<worldId>/<name>.json` (FR-14). `start`/`script`/`events` are the additive B-2 fields
 * (`formatVersion` stays 1); legacy records lack them and replay reports unavailable.
 */
export interface FightDoc {
  formatVersion: 1;
  id: string;
  worldId: string;
  name: string;
  createdAt: string;
  declarations: unknown[];
  combat: unknown;
  outcome: FightOutcome;
  start?: FightStartDoc;
  script?: FightScriptEntry[];
  /** Verbatim `RuntimeEvent[]` observed from begin to record. */
  events?: unknown[];
}

/** The renderer-supplied part of a FightDoc; main mints the envelope (D-21). */
export type FightRecordBody = Omit<FightDoc, 'formatVersion' | 'id' | 'worldId' | 'name' | 'createdAt'>;

/**
 * A fight record as listed: the envelope + outcome, plus what a record row shows read from the stored
 * document — `combat.rng` verbatim (B-3), `combat.round`, and the `events` count (null when absent).
 */
export type FightRecordMeta = Omit<FightDoc, 'declarations' | 'combat' | 'start' | 'script' | 'events'> & {
  rng: unknown;
  round: number | null;
  eventCount: number | null;
};

/** A document the store refused to load; `location` is relative to userData, never absolute. */
export interface SkippedDoc {
  location: string;
  reason: string;
}
