/**
 * Combat wrappers (M06, FR-11–13): assembly, the declare/step/respond loop and the event stream.
 * Every advancement is one library call; the UI implements no combat rules (FR-12). Each call's
 * own events are captured with a sink, because `Combat.declare` returns the whole round's events.
 */
import {
  bestiaryIds,
  deserializeCombat,
  serializeCombat,
  spatialFromPack,
  spawnMonster,
  startCombat,
  type Combat,
  type CombatantProfile,
  type EconomyBalances,
  type Position,
  type Runtime,
  type RuntimeEvent,
  type StepOutcome,
} from 'ruleswright/runtime';
import type { Pack, SpatialDef } from 'ruleswright/schema';
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
  Position,
  CombatRestoreRequest,
} from 'ruleswright/runtime';
export type { SpatialDef } from 'ruleswright/schema';

/** One bestiary spawn on the enemy side, in `startCombat` order (B-2). */
export interface EnemySpec {
  statblockId: string;
  instanceId: string;
}

/** What a fight was started from (FightDoc `start`, B-2). */
export interface FightStart {
  ally: { id: string; snapshot: CharacterSnapshot };
  enemies: EnemySpec[];
  /** FightDoc `start.positions` (CA-14): the positions passed to `startCombat`, only on spatial packs. */
  positions?: Record<string, Position>;
}

/** One host call, in order (FightDoc `script`, B-2): rejected declares included. */
export type ScriptEntry =
  | { op: 'declare'; actionId: string; targetId?: string }
  | { op: 'respond'; triggerId: string; choice: 'take' | 'decline'; targetId?: string }
  | { op: 'step' }
  | { op: 'move'; positions: Record<string, Position> };

/** The ally as `startCombat` takes it; its combatant id is `profile.id`. */
export interface AllyCombatant {
  profile: CombatantProfile;
  balances?: EconomyBalances;
}

/** The sides exactly as `startCombat` took them (the restore seam re-states them). */
export interface Sides {
  allies: { id: string; profile: CombatantProfile }[];
  enemies: { id: string; profile: CombatantProfile }[];
}

/** A running fight plus what re-positioning needs; `fight` is replaced by a move. */
export interface LiveFight {
  fight: Combat;
  sides: Sides;
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

/**
 * FR-11: spawn each enemy (`spawnMonster`) and start the fight; initiative rolls land in `combat:start`.
 * `positions` (CA-12) go to `startCombat` verbatim — the library judges them.
 */
export function begin(
  rt: Runtime,
  ally: AllyCombatant,
  enemies: readonly EnemySpec[],
  positions?: Readonly<Record<string, Position>>,
): Outcome<LiveFight> {
  return attempt('fight:begin', () => {
    const sides: Sides = {
      allies: [{ id: ally.profile.id, profile: ally.profile }],
      enemies: enemies.map((e) => ({ id: e.instanceId, profile: spawnMonster(rt, e.statblockId, e.instanceId) })),
    };
    const fight = startCombat(rt, {
      allies: [{ id: ally.profile.id, ...ally }],
      enemies: sides.enemies,
      ...(positions === undefined ? {} : { positions }),
    });
    return { fight, sides };
  });
}

/**
 * FR-11, CA-13: host repositioning through the engine's serialize → restore seam. Only at
 * `awaiting-declare` with no open offer on a spatial pack (CX-D10); every combatant's live pools
 * and bound slots are re-stated (CX-D11). Emits no events.
 */
export function reposition(live: LiveFight, positions: Readonly<Record<string, Position>>): Outcome<Combat> {
  const { fight, sides } = live;
  const refuse = (message: string): Outcome<Combat> => ({
    ok: false,
    error: { kind: 'unexpected', operation: 'combat:move', message },
  });
  if (spatialOf(fight.runtime.pack) === null) return refuse('this pack declares no spatial model (theater-of-mind)');
  if (fight.pendingTriggers.length > 0) return refuse('repositioning needs every trigger offer answered first');
  if (fight.state.phase !== 'awaiting-declare') return refuse(`repositioning needs phase awaiting-declare (now ${fight.state.phase})`);
  const r = attempt('combat:move', () => {
    const restated = (side: Sides['allies']) =>
      side.map(({ id, profile }) => {
        const c = fight.state.combatants[id];
        return { id, profile, balances: { pools: structuredClone(c?.pools ?? {}), boundSlots: structuredClone(c?.boundSlots ?? {}) } };
      });
    const snap = serializeCombat(fight, { pairsWith: sides.allies[0]?.id ?? '' });
    return deserializeCombat(fight.runtime, snap, { allies: restated(sides.allies), enemies: restated(sides.enemies), positions });
  });
  if (r.ok) live.fight = r.value;
  return r;
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

/** Re-issue one recorded host call (store and replay share this path); `move` replaces `live.fight`. */
export function perform(live: LiveFight, entry: ScriptEntry): Outcome<unknown> {
  if (entry.op === 'declare') return declare(live.fight, entry.actionId, entry.targetId);
  if (entry.op === 'respond') return respond(live.fight, entry.triggerId, entry.choice, entry.targetId);
  if (entry.op === 'move') return reposition(live, entry.positions);
  return step(live.fight);
}

/** FR-13: every event on `rt` reaches `sink` until the returned function is called. */
export function subscribe(rt: Runtime, sink: (e: RuntimeEvent) => void): () => void {
  rt.events.on(sink);
  return () => rt.events.off(sink);
}

/** FR-11: the pack's spatial model as the library reads it. */
export function spatialLabel(pack: Pack): 'theater-of-mind' | 'grid' {
  return spatialFromPack(pack).enabled ? 'grid' : 'theater-of-mind';
}

/** FR-11: the pack's spatial section verbatim, or null (theater-of-mind). */
export function spatialOf(pack: Pack): SpatialDef | null {
  return pack.spatial ?? null;
}

/** FR-11: the library's grid distance (`rt.spatial.distance`), never computed UI-side. */
export function distance(rt: Runtime, a: Position, b: Position): number {
  return rt.spatial.distance(a, b);
}
