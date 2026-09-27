/**
 * Character store (M09, FR-6–10, FR-18): one session-scoped character for the active world (D-07) plus
 * that world's named snapshots (FR-10). Every mechanic is a library call on `active.runtime`
 * through `engine/runtime`; after each call the store publishes a fresh `viewOf` clone, because
 * the library mutates `character.state` in place. Never throws to views.
 */
import { create as createStore, type StoreApi } from 'zustand';
import type { IpcResult } from '../../../shared/ipc-contract';
import type { SnapshotMeta } from '../../../shared/model';
import { fromIpcError, toAppError, type AppError, type ErrorCard } from '../engine/errors';
import * as rules from '../engine/runtime';
import type { Character, CharacterView, ClassEntry, Outcome, RuntimeEvent } from '../engine/runtime';
import type { Runtime } from '../engine/schema';
import { getPersistence } from '../persistence/client';
import { useWorldsStore, type WorldsState } from './worlds';

export type CharacterSection = 'create' | 'progress' | 'pools' | 'spells' | 'conditions' | 'inventory' | 'snapshots';

export interface CreateRequest {
  name: string;
  race: string;
  classes: ClassEntry[];
}

export interface CharacterStore {
  /** The world the character and snapshot list belong to (`active.meta.id`). */
  worldId: string | null;
  /** The live library character (SESSION-06 builds the ally from it). Mutated only by library calls. */
  character: Character | null;
  /** Detached clone + library-derived facts; replaced after every successful call. */
  view: CharacterView | null;
  /** Pool values observed at creation, restore, or the last `rest` (the "at rest" reference). */
  poolsAtRest: Readonly<Record<string, number>>;
  lastEvents: readonly RuntimeEvent[];
  /** The latest rejection, keyed by the section whose control failed (one at a time). */
  errors: Partial<Record<CharacterSection, AppError>>;
  snapshots: SnapshotMeta[];
  checkBuild(race: string, classes: ClassEntry[]): readonly ErrorCard[];
  create(req: CreateRequest): boolean;
  awardXp(amount: number): void;
  setLevels(entries: ClassEntry[]): void;
  spend(pool: string, amount: number): void;
  prepare(spellId: string, slotIndex?: number): void;
  cast(spellId: string, slotIndex?: number): void;
  rest(): void;
  apply(conditionId: string): void;
  remove(conditionId: string): void;
  tick(): void;
  /** FR-18: grant `qty` of a pack item. */
  grant(itemId: string, qty: number): void;
  /** FR-18: drop held `qty`. */
  drop(itemId: string, qty: number): void;
  /** FR-18 / CA-14: roll a loot table with the user's explicit seed. */
  loot(tableId: string, seed: number): void;
  refreshSnapshots(): Promise<void>;
  saveSnapshot(name: string): Promise<boolean>;
  loadSnapshot(name: string): Promise<boolean>;
  deleteSnapshot(name: string): Promise<boolean>;
}

type WorldsSource = Pick<StoreApi<WorldsState>, 'getState' | 'subscribe'>;

async function call<T>(operation: string, request: () => Promise<IpcResult<T>>): Promise<Outcome<T>> {
  try {
    const r = await request();
    return r.ok ? r : { ok: false, error: fromIpcError(r.error) };
  } catch (e) {
    return { ok: false, error: toAppError(operation, e) };
  }
}

const EMPTY = { character: null, view: null, poolsAtRest: {}, lastEvents: [], errors: {} } as const;

/** A character store bound to `worlds` (the app's worlds store, or a test's own). */
export function createCharacterStore(worlds: WorldsSource = useWorldsStore) {
  const store = createStore<CharacterStore>()((set, get) => {
    const runtime = (): Runtime | null => worlds.getState().active?.runtime ?? null;

    const fail = (section: CharacterSection, error: AppError) => set({ errors: { [section]: error } });

    const clear = (section: CharacterSection): CharacterStore['errors'] => {
      const { [section]: _cleared, ...rest } = get().errors;
      return rest;
    };

    /** Run one library mutation on the current character; publish a fresh view on success. */
    function mutate(section: CharacterSection, run: (rt: Runtime, c: Character) => Outcome<RuntimeEvent | readonly RuntimeEvent[]>) {
      const rt = runtime();
      const c = get().character;
      if (!rt || !c) return null;
      const r = run(rt, c);
      if (!r.ok) {
        fail(section, r.error);
        return null;
      }
      const events = Array.isArray(r.value) ? (r.value as readonly RuntimeEvent[]) : [r.value as RuntimeEvent];
      const view = rules.viewOf(rt, c);
      set({ view, lastEvents: events, errors: clear(section) });
      return view;
    }

    function adopt(rt: Runtime, character: Character, events: readonly RuntimeEvent[], section: CharacterSection) {
      const view = rules.viewOf(rt, character);
      set({ character, view, poolsAtRest: { ...view.state.pools }, lastEvents: events, errors: clear(section) });
    }

    return {
      worldId: worlds.getState().active?.meta.id ?? null,
      ...EMPTY,
      snapshots: [],

      checkBuild(race, classes) {
        const rt = runtime();
        return rt ? rules.checkBuild(rt, race, classes) : [];
      },

      /** FR-6: create (replacing any current character — the view confirms first). */
      create(req) {
        const rt = runtime();
        if (!rt) return false;
        const r = rules.create(rt, req);
        if (!r.ok) {
          fail('create', r.error);
          return false;
        }
        adopt(rt, r.value, [], 'create');
        return true;
      },

      awardXp: (amount) => void mutate('progress', (rt, c) => rules.awardXp(rt, c, amount)),
      setLevels: (entries) => void mutate('progress', (rt, c) => rules.setLevels(rt, c, entries)),
      spend: (pool, amount) => void mutate('pools', (rt, c) => rules.spend(rt, c, pool, amount)),
      prepare: (spellId, slotIndex) => void mutate('spells', (rt, c) => rules.prepare(rt, c, spellId, slotIndex)),
      cast: (spellId, slotIndex) => void mutate('spells', (rt, c) => rules.cast(rt, c, spellId, slotIndex)),
      rest() {
        const view = mutate('pools', (rt, c) => rules.restNow(rt, c));
        if (view) set({ poolsAtRest: { ...view.state.pools } });
      },
      apply: (conditionId) => void mutate('conditions', (rt, c) => rules.apply(rt, c, conditionId)),
      remove: (conditionId) => void mutate('conditions', (rt, c) => rules.remove(rt, c, conditionId)),
      tick: () => void mutate('conditions', (rt, c) => rules.tick(rt, c)),
      grant: (itemId, qty) => void mutate('inventory', (rt, c) => rules.grant(rt, c, itemId, qty)),
      drop: (itemId, qty) => void mutate('inventory', (rt, c) => rules.drop(rt, c, itemId, qty)),
      loot: (tableId, seed) => void mutate('inventory', (rt, c) => rules.loot(rt, c, tableId, seed)),

      /** FR-10: this world's snapshots, newest first (main's order). */
      async refreshSnapshots() {
        const worldId = get().worldId;
        if (worldId === null) {
          set({ snapshots: [] });
          return;
        }
        const r = await call('snapshot:list', () => getPersistence().snapshotList({ worldId }));
        if (get().worldId !== worldId) return;
        if (r.ok) set({ snapshots: r.value });
        else fail('snapshots', r.error);
      },

      /** FR-10 / CA-06: the verbatim `serializeCharacter` envelope, keyed by its own pack block. */
      async saveSnapshot(name) {
        const rt = runtime();
        const { character, worldId } = get();
        if (!rt || !character || worldId === null) return false;
        const snapshot = rules.serialize(rt, character);
        const r = await call('snapshot:save', () =>
          getPersistence().snapshotSave({ worldId, name, packIdentity: snapshot.pack, snapshot }),
        );
        if (!r.ok) {
          fail('snapshots', r.error);
          return false;
        }
        set({ errors: clear('snapshots') });
        await get().refreshSnapshots();
        return true;
      },

      /** FR-10 / CA-06: load → `restoreCharacter`; a foreign pack is E-SNAP-01 and nothing changes. */
      async loadSnapshot(name) {
        const worldId = get().worldId;
        if (worldId === null) return false;
        const r = await call('snapshot:load', () => getPersistence().snapshotLoad({ worldId, name }));
        const rt = runtime();
        if (get().worldId !== worldId || !rt) return false;
        if (!r.ok) {
          fail('snapshots', r.error);
          return false;
        }
        const restored = rules.restore(rt, r.value.snapshot);
        if (!restored.ok) {
          fail('snapshots', restored.error);
          return false;
        }
        adopt(rt, restored.value, [], 'snapshots');
        return true;
      },

      async deleteSnapshot(name) {
        const worldId = get().worldId;
        if (worldId === null) return false;
        const r = await call('snapshot:delete', () => getPersistence().snapshotDelete({ worldId, name }));
        if (!r.ok) {
          fail('snapshots', r.error);
          return false;
        }
        set({ errors: clear('snapshots') });
        await get().refreshSnapshots();
        return true;
      },
    };
  });

  // A different world (or a reopened one: a new Runtime) ends the session-scoped character (D-07).
  worlds.subscribe((next, prev) => {
    const id = next.active?.meta.id ?? null;
    if (id === (prev.active?.meta.id ?? null) && next.active?.runtime === prev.active?.runtime) return;
    store.setState({ worldId: id, ...EMPTY, snapshots: [] });
    void store.getState().refreshSnapshots();
  });
  void store.getState().refreshSnapshots();

  return store;
}

export const useCharacterStore = createCharacterStore();
