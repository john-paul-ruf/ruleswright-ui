/**
 * Combat store (M09, FR-11–13): the enemy roster, the live fight and its provenanced log. Every
 * host call goes through `engine/combat` and is appended to `script` (B-2); every event on the
 * world's runtime reaches `log` while a fight is open — never dropped, never deduped (CA-07).
 * Never throws to views.
 */
import { create as createStore, type StoreApi } from 'zustand';
import type { IpcResult } from '../../../shared/ipc-contract';
import type { FightRecordMeta } from '../../../shared/model';
import * as combat from '../engine/combat';
import type { Combat, CombatState, EnemySpec, FightStart, PendingTrigger, RuntimeEvent, ScriptEntry } from '../engine/combat';
import { allyProfile } from '../engine/combat-profile';
import { fromIpcError, toAppError, type AppError } from '../engine/errors';
import { recordingOf, replay, type Declaration, type Recording, type ReplayResult } from '../engine/replay';
import { serialize, type Outcome } from '../engine/runtime';
import { getPersistence } from '../persistence/client';
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
  /** Each combatant's hp as the library reported it at begin (the bar's reference, never computed). */
  hpAtStart: Readonly<Record<string, number>>;
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
  /** The declare calls with the combatant active when each was issued (FightDoc `declarations`). */
  declarations: Declaration[];
  /** This world's fight records (FR-14b), newest first. */
  records: FightRecordMeta[];
  recordsError: AppError | null;
  /** The latest replay: its record name, verdict and the replayed events. */
  replayed: { name: string; result: ReplayResult; events: RuntimeEvent[] } | null;
  begin(): boolean;
  declare(actionId: string, targetId?: string): void;
  step(): void;
  respond(triggerId: string, choice: 'take' | 'decline', targetId?: string): void;
  end(): void;
  refreshRecords(): Promise<void>;
  /** FR-14b: save the open fight (start, script, events, combat snapshot) under `name`. */
  record(name: string): Promise<boolean>;
  /** FR-14b: replay a stored record; a divergence also rewrites its `outcome` to `diverged`. */
  replay(name: string): Promise<void>;
}

type Source<S> = Pick<StoreApi<S>, 'getState' | 'subscribe'>;

const IDLE = {
  fight: null,
  state: null,
  hpAtStart: {},
  pending: [],
  log: [],
  rejection: null,
  error: null,
  over: false,
  filters: { round: 'all', type: 'all' },
  start: null,
  script: [],
  declarations: [],
} as const satisfies Partial<CombatStore>;

async function bridge<T>(operation: string, request: () => Promise<IpcResult<T>>): Promise<Outcome<T>> {
  try {
    const r = await request();
    return r.ok ? r : { ok: false, error: fromIpcError(r.error) };
  } catch (e) {
    return { ok: false, error: toAppError(operation, e) };
  }
}

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

    const worldId = (): string | null => worlds.getState().active?.meta.id ?? null;

    return {
      enemies: [],
      ...IDLE,
      records: [],
      recordsError: null,
      replayed: null,

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
        const live = combat.begin(rt, ally.value, start.enemies);
        if (!live.ok) {
          get().end();
          set({ error: live.error });
          return false;
        }
        const { fight } = live.value;
        const hpAtStart = Object.fromEntries(Object.values(fight.state.combatants).map((c) => [c.id, c.hp.current]));
        publish(fight, { fight, start, hpAtStart, script: [], rejection: null, error: null });
        return true;
      },

      /** FR-12: a rejection is an event, shown beside Declare; the call is still recorded. */
      declare(actionId, targetId) {
        const entry: ScriptEntry = targetId === undefined ? { op: 'declare', actionId } : { op: 'declare', actionId, targetId };
        const combatantId = get().fight?.state.active ?? '';
        const r = call(entry, (fight) => combat.declare(fight, actionId, targetId));
        if (!r) return;
        const declaration = { combatantId, action: actionId, options: targetId === undefined ? {} : { targetId } };
        set({ rejection: r.rejection, declarations: [...get().declarations, declaration] });
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

      async refreshRecords() {
        const id = worldId();
        if (id === null) {
          set({ records: [] });
          return;
        }
        const r = await bridge('fight:list', () => getPersistence().fightList({ worldId: id }));
        if (worldId() !== id) return;
        set(r.ok ? { records: r.value, recordsError: null } : { recordsError: r.error });
      },

      async record(name) {
        const id = worldId();
        const { fight, start, script, log, declarations, over } = get();
        if (id === null || !fight || !start) return false;
        const rec: Recording = recordingOf(fight, start, script, log, declarations);
        const r = await bridge('fight:save', () =>
          getPersistence().fightSave({
            worldId: id,
            name,
            record: {
              declarations: rec.declarations,
              combat: rec.combat,
              outcome: over ? 'complete' : 'abandoned',
              start: rec.start,
              script: rec.script,
              events: rec.events,
            },
          }),
        );
        if (!r.ok) {
          set({ recordsError: r.error });
          return false;
        }
        set({ recordsError: null });
        await get().refreshRecords();
        return true;
      },

      async replay(name) {
        const active = worlds.getState().active;
        if (!active) return;
        const loaded = await bridge('fight:load', () => getPersistence().fightLoad({ worldId: active.meta.id, name }));
        if (!loaded.ok) {
          set({ recordsError: loaded.error });
          return;
        }
        const doc = loaded.value as unknown as Partial<Recording>;
        const { result, events } = replay(active.meta, active.packJson, doc);
        set({ replayed: { name, result, events }, recordsError: null });
        if (result.status !== 'diverged') return;
        const r = await bridge('fight:set-outcome', () =>
          getPersistence().fightSetOutcome({ worldId: active.meta.id, name, outcome: 'diverged' }),
        );
        if (!r.ok) set({ recordsError: r.error });
        await get().refreshRecords();
      },
    };
  });

  // A different world, or a reopened one (a new Runtime), ends the fight and clears the roster.
  worlds.subscribe((next, prev) => {
    if (next.active?.runtime === prev.active?.runtime) return;
    store.getState().end();
    store.setState({ enemies: [], records: [], recordsError: null, replayed: null });
    void store.getState().refreshRecords();
  });
  void store.getState().refreshRecords();

  return store;
}

export const useCombatStore = createCombatStore();

/** Library facts the Fight/Combat surfaces read (views reach the engine only through stores). */
export { listSpawnable, spatialLabel, spawnProfile } from '../engine/combat';
export type { CombatState, CombatantState, EnemySpec, PendingTrigger, RuntimeEvent } from '../engine/combat';

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
