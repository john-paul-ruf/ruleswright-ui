/**
 * Combat store (M09, FR-11–13): the enemy roster, the live fight and its provenanced log. Every
 * host call goes through `engine/combat` and is appended to `script` (B-2); every event on the
 * world's runtime reaches `log` while a fight is open — never dropped, never deduped (CA-07).
 * Never throws to views.
 */
import { create as createStore, type StoreApi } from 'zustand';
import * as combat from '../engine/combat';
import type { Combat, CombatState, EnemySpec, FightStart, PendingTrigger, RuntimeEvent, ScriptEntry } from '../engine/combat';
import { allyProfile } from '../engine/combat-profile';
import type { AppError } from '../engine/errors';
import { serialize } from '../engine/runtime';
import { useCharacterStore, type CharacterStore } from './character';
import { useWorldsStore, type WorldsState } from './worlds';

export interface LogFilters {
  round: number | 'all';
  type: string | 'all';
}

export interface CombatStore {
  enemies: EnemySpec[];
  addEnemy(statblockId: string): void;
  removeEnemy(instanceId: string): void;
  fight: Combat | null;
  /** `structuredClone(fight.state)`, republished after every call. */
  state: CombatState | null;
  /** Open trigger offers (a copy of `fight.pendingTriggers`); offers are open iff non-empty. */
  pending: PendingTrigger[];
  log: RuntimeEvent[];
  /** The last declare's `declare:rejected` event (FR-12), cleared by the next accepted call. */
  rejection: RuntimeEvent | null;
  error: AppError | null;
  over: boolean;
  filters: LogFilters;
  setFilters(filters: Partial<LogFilters>): void;
  /** What the fight was started from (B-2); captured at begin, before `startCombat`. */
  start: FightStart | null;
  script: ScriptEntry[];
  begin(): boolean;
  declare(actionId: string, targetId?: string): void;
  step(): void;
  respond(triggerId: string, choice: 'take' | 'decline', targetId?: string): void;
  end(): void;
}

type Source<S> = Pick<StoreApi<S>, 'getState' | 'subscribe'>;

const IDLE = {
  fight: null,
  state: null,
  pending: [],
  log: [],
  rejection: null,
  error: null,
  over: false,
  filters: { round: 'all', type: 'all' },
  start: null,
  script: [],
} as const satisfies Partial<CombatStore>;

/** The ally's combatant id: the character's name as an id (`Brynn` → `brynn`). */
function allyIdOf(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ally';
}

/** A combat store bound to `worlds` and `characters` (the app's stores, or a test's own). */
export function createCombatStore(
  worlds: Source<WorldsState> = useWorldsStore,
  characters: Pick<StoreApi<CharacterStore>, 'getState'> = useCharacterStore,
) {
  let unsubscribe: (() => void) | null = null;

  const store = createStore<CombatStore>()((set, get) => {
    function publish(fight: Combat, patch: Partial<CombatStore>) {
      set({
        state: structuredClone(fight.state),
        pending: fight.pendingTriggers.map((t) => ({ ...t })),
        over: fight.state.phase === 'combat-over',
        ...patch,
      });
    }

    /** Run one host call on the open fight; on success record it and republish. */
    function call<T>(entry: ScriptEntry, run: (fight: Combat) => { ok: true; value: T } | { ok: false; error: AppError }): T | null {
      const fight = get().fight;
      if (!fight) return null;
      const r = run(fight);
      if (!r.ok) {
        set({ error: r.error });
        return null;
      }
      publish(fight, { script: [...get().script, entry], error: null });
      return r.value;
    }

    return {
      enemies: [],
      ...IDLE,

      addEnemy(statblockId) {
        const taken = new Set(get().enemies.map((e) => e.instanceId));
        let n = 1;
        while (taken.has(`${statblockId}-${n}`)) n += 1;
        set({ enemies: [...get().enemies, { statblockId, instanceId: `${statblockId}-${n}` }] });
      },

      removeEnemy(instanceId) {
        set({ enemies: get().enemies.filter((e) => e.instanceId !== instanceId) });
      },

      setFilters(filters) {
        set({ filters: { ...get().filters, ...filters } });
      },

      /** FR-11: snapshot the ally (B-2), derive its profile (B-1), subscribe, then start the fight. */
      begin() {
        const rt = worlds.getState().active?.runtime;
        const character = characters.getState().character;
        const enemies = get().enemies;
        if (!rt || !character || enemies.length === 0) return false;
        get().end();
        const id = allyIdOf(character.state.name);
        const start: FightStart = { ally: { id, snapshot: serialize(rt, character) }, enemies: enemies.map((e) => ({ ...e })) };
        const ally = allyProfile(rt, character, id);
        if (!ally.ok) {
          set({ error: ally.error });
          return false;
        }
        unsubscribe = combat.subscribe(rt, (e) => set((s) => ({ log: [...s.log, e] })));
        const fight = combat.begin(rt, ally.value, start.enemies);
        if (!fight.ok) {
          get().end();
          set({ error: fight.error });
          return false;
        }
        publish(fight.value, { fight: fight.value, start, script: [], rejection: null, error: null });
        return true;
      },

      /** FR-12: a rejection is an event, shown beside Declare; the call is still recorded. */
      declare(actionId, targetId) {
        const entry: ScriptEntry = targetId === undefined ? { op: 'declare', actionId } : { op: 'declare', actionId, targetId };
        const r = call(entry, (fight) => combat.declare(fight, actionId, targetId));
        if (r) set({ rejection: r.rejection });
      },

      step() {
        if (call({ op: 'step' }, combat.step)) set({ rejection: null });
      },

      respond(triggerId, choice, targetId) {
        const entry: ScriptEntry =
          targetId === undefined ? { op: 'respond', triggerId, choice } : { op: 'respond', triggerId, choice, targetId };
        if (call(entry, (fight) => combat.respond(fight, triggerId, choice, targetId))) set({ rejection: null });
      },

      /** Stop listening and drop the fight; the enemy roster stays for the next one. */
      end() {
        unsubscribe?.();
        unsubscribe = null;
        set({ ...IDLE });
      },
    };
  });

  // A different world, or a reopened one (a new Runtime), ends the fight and clears the roster.
  worlds.subscribe((next, prev) => {
    if (next.active?.runtime === prev.active?.runtime) return;
    store.getState().end();
    store.setState({ enemies: [] });
  });

  return store;
}

export const useCombatStore = createCombatStore();

/** FR-13: rounds present in the log, ascending. */
export function roundsOf(log: readonly RuntimeEvent[]): number[] {
  return [...new Set(log.map((e) => e.at.round))].sort((a, b) => a - b);
}

/** FR-13: event types present in the log, in first-seen order. */
export function typesOf(log: readonly RuntimeEvent[]): string[] {
  return [...new Set(log.map((e) => e.type))];
}

/** FR-13: the log rows the filters keep (a pure selector; the log itself is never trimmed). */
export function visibleLog(log: readonly RuntimeEvent[], filters: LogFilters): RuntimeEvent[] {
  return log.filter((e) => (filters.round === 'all' || e.at.round === filters.round) && (filters.type === 'all' || e.type === filters.type));
}

/**
 * DF-1 provenance: the `trigger:fired` event behind each open offer. The library answers the
 * oldest open offer of a `triggerId` first, so the open ones are that id's latest fired events.
 */
export function offerEvents(pending: readonly PendingTrigger[], log: readonly RuntimeEvent[]): (RuntimeEvent | undefined)[] {
  return pending.map((offer, i) => {
    const fired = log.filter((e) => e.type === 'trigger:fired' && e.payload.triggerId === offer.triggerId);
    const open = pending.filter((p) => p.triggerId === offer.triggerId).length;
    const nth = pending.slice(0, i).filter((p) => p.triggerId === offer.triggerId).length;
    return fired[fired.length - open + nth];
  });
}
