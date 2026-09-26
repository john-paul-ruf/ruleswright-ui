/**
 * Combat wrappers (M06, FR-11–13): assembly, the declare/step/respond loop and the event stream.
 * Every advancement is one library call; the UI implements no combat rules (FR-12). Each call's
 * own events are captured with a sink, because `Combat.declare` returns the whole round's events.
 */
import {
  bestiaryIds,
  spatialFromPack,
  spawnMonster,
  startCombat,
  type Combat,
  type CombatantProfile,
  type EconomyBalances,
  type Runtime,
  type RuntimeEvent,
  type StepOutcome,
} from 'ruleswright/runtime';
import type { Pack } from 'ruleswright/schema';
import { toAppError } from './errors';
import type { CharacterSnapshot, Outcome } from './runtime';

export type {
  Combat,
  CombatState,
  CombatPhase,
  CombatantProfile,
  CombatantState,
  RuntimeEvent,
  StepOutcome,
  PendingTrigger,
  CombatSnapshot,
  CharacterSnapshot,
  DeclareOptions,
} from 'ruleswright/runtime';

/** One bestiary spawn on the enemy side, in `startCombat` order (B-2). */
export interface EnemySpec {
  statblockId: string;
  instanceId: string;
}

/** What a fight was started from (FightDoc `start`, B-2). */
export interface FightStart {
  ally: { id: string; snapshot: CharacterSnapshot };
  enemies: EnemySpec[];
}

/** One host call, in order (FightDoc `script`, B-2): rejected declares included. */
export type ScriptEntry =
  | { op: 'declare'; actionId: string; targetId?: string }
  | { op: 'respond'; triggerId: string; choice: 'take' | 'decline'; targetId?: string }
  | { op: 'step' };

/** The ally as `startCombat` takes it; its combatant id is `profile.id`. */
export interface AllyCombatant {
  profile: CombatantProfile;
  balances?: EconomyBalances;
}

export interface DeclareResult {
  /** Only this call's events. */
  events: readonly RuntimeEvent[];
  /** This call's `declare:rejected` event (FR-12 DeclareRejection), else null. */
  rejection: RuntimeEvent | null;
}

function attempt<T>(operation: string, run: () => T): Outcome<T> {
  try {
    return { ok: true, value: run() };
  } catch (e) {
    return { ok: false, error: toAppError(operation, e) };
  }
}

/** The events `run` emits on `rt`, captured by a sink attached only for the call. */
function capture(rt: Runtime, run: () => unknown): RuntimeEvent[] {
  const events: RuntimeEvent[] = [];
  const sink = (e: RuntimeEvent) => void events.push(e);
  rt.events.on(sink);
  try {
    run();
  } finally {
    rt.events.off(sink);
  }
  return events;
}

/** FR-11: the pack's bestiary ids — the only spawnable enemies. */
export function listSpawnable(rt: Runtime): readonly string[] {
  return bestiaryIds(rt);
}

/** FR-11: a bestiary spawn's library profile (hp, actions) for the assembly roster. */
export function spawnProfile(rt: Runtime, statblockId: string, instanceId: string): Outcome<CombatantProfile> {
  return attempt('fight:spawn', () => spawnMonster(rt, statblockId, instanceId));
}

/** FR-11: spawn each enemy (`spawnMonster`) and start the fight; initiative rolls land in `combat:start`. */
export function begin(rt: Runtime, ally: AllyCombatant, enemies: readonly EnemySpec[]): Outcome<Combat> {
  return attempt('fight:begin', () =>
    startCombat(rt, {
      allies: [{ id: ally.profile.id, ...ally }],
      enemies: enemies.map((e) => ({ id: e.instanceId, profile: spawnMonster(rt, e.statblockId, e.instanceId) })),
    }),
  );
}

/** FR-12: declare the active combatant's action. A rejection is an event, never a throw. */
export function declare(fight: Combat, actionId: string, targetId?: string): Outcome<DeclareResult> {
  return attempt('combat:declare', () => {
    const events = capture(fight.runtime, () => fight.declare(actionId, targetId === undefined ? {} : { targetId }));
    return { events, rejection: events.find((e) => e.type === 'declare:rejected') ?? null };
  });
}

/** FR-12: advance one step. */
export function step(fight: Combat): Outcome<StepOutcome> {
  return attempt('combat:step', () => fight.step());
}

/** FR-12: answer an open trigger offer; returns this call's events. */
export function respond(
  fight: Combat,
  triggerId: string,
  choice: 'take' | 'decline',
  targetId?: string,
): Outcome<readonly RuntimeEvent[]> {
  return attempt('combat:respond', () => capture(fight.runtime, () => fight.respond(triggerId, choice, targetId)));
}

/** Re-issue one recorded host call (store and replay share this path). */
export function perform(fight: Combat, entry: ScriptEntry): Outcome<unknown> {
  if (entry.op === 'declare') return declare(fight, entry.actionId, entry.targetId);
  if (entry.op === 'respond') return respond(fight, entry.triggerId, entry.choice, entry.targetId);
  return step(fight);
}

/** FR-13: every event on `rt` reaches `sink` until the returned function is called. */
export function subscribe(rt: Runtime, sink: (e: RuntimeEvent) => void): () => void {
  rt.events.on(sink);
  return () => rt.events.off(sink);
}

/** FR-11: the pack's spatial model — bundled packs declare none, so theater-of-mind. */
export function spatialLabel(pack: Pack): 'theater-of-mind' | 'grid' {
  // `Pack` does not type the optional `spatial` section; the library reads it when present.
  return spatialFromPack(pack as unknown as Parameters<typeof spatialFromPack>[0]).enabled ? 'grid' : 'theater-of-mind';
}
