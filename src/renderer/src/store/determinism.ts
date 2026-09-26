/** Rerun-same-seed state per world (FR-14a, D-11). No durable write. Never throws to views. */
import { create, type StoreApi } from 'zustand';
import { rerunSameSeed, type RerunResult } from '../engine/determinism';
import { toAppError } from '../engine/errors';
import { useWorldsStore, type WorldsState } from './worlds';

export type { RerunResult };
export type RerunState = RerunResult | 'running';

export interface DeterminismState {
  /** Latest rerun per world id; a world with no entry has not been rerun this session. */
  byWorld: Record<string, RerunState>;
  /** FR-14a: rerun the active world against its stored bytes (`active.packJson`, CA-01). */
  rerun(): Promise<void>;
}

/** A determinism store reading the active world from `worlds` (the app's worlds store by default). */
export function createDeterminismStore(worlds: StoreApi<WorldsState> = useWorldsStore) {
  return create<DeterminismState>()((set) => {
    const put = (worldId: string, state: RerunState) => set((s) => ({ byWorld: { ...s.byWorld, [worldId]: state } }));

    return {
      byWorld: {},

      async rerun() {
        const active = worlds.getState().active;
        if (!active) return;
        const { meta, packJson } = active;
        put(meta.id, 'running');
        // Let the view paint the running state before the synchronous generate.
        await new Promise((resolve) => setTimeout(resolve, 0));
        try {
          put(meta.id, rerunSameSeed(meta, packJson));
        } catch (e) {
          put(meta.id, { status: 'error', error: toAppError('rerun', e) });
        }
      },
    };
  });
}

export const useDeterminismStore = createDeterminismStore();
