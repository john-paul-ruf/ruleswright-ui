/** Worlds store core (FR-1/2/3): themes, world list, active world, forge/open/export. Never throws to views. */
import { create } from 'zustand';
import type { IpcResult } from '../../../shared/ipc-contract';
import type { Knobs, SkippedDoc, WorldMeta } from '../../../shared/model';
import { forge as forgePack, listThemes, type ThemeInfo } from '../engine/compiler';
import { fromIpcError, toAppError, type AppError } from '../engine/errors';
import { openPack, type Pack, type Runtime } from '../engine/schema';
import { getPersistence } from '../persistence/client';

export interface ActiveWorld {
  meta: WorldMeta;
  /** The exact string main returned (or the one just saved) — never re-stringified (CA-01). */
  packJson: string;
  pack: Pack;
  runtime: Runtime;
}

export type ExportOutcome = { status: 'saved' | 'cancelled' } | { status: 'error'; error: AppError };

export interface WorldsState {
  themes: ThemeInfo[];
  worlds: WorldMeta[];
  skipped: SkippedDoc[];
  active: ActiveWorld | null;
  /** Session-scoped verdicts for worlds whose pack failed the gate (D-15, not persisted). */
  corrupt: Record<string, AppError>;
  busy: boolean;
  forgeError: AppError | null;
  openError: AppError | null;
  startup(): Promise<void>;
  refresh(): Promise<void>;
  forge(p: { themeId: string; seed: number; knobs: Knobs }): Promise<boolean>;
  open(worldId: string): Promise<boolean>;
  exportPack(worldId: string): Promise<ExportOutcome>;
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: AppError };

/** One bridge call as a value: IPC errors → `host`, a rejected promise → `unexpected`. */
async function call<T>(operation: string, request: () => Promise<IpcResult<T>>): Promise<Outcome<T>> {
  try {
    const r = await request();
    return r.ok ? r : { ok: false, error: fromIpcError(r.error) };
  } catch (e) {
    return { ok: false, error: toAppError(operation, e) };
  }
}

/** A fresh worlds store bound to whatever `getPersistence()` returns at call time. */
export function createWorldsStore() {
  return create<WorldsState>()((set, get) => {
    const rememberLast = (worldId: string) => call('settings:set', () => getPersistence().settingsSet({ lastWorldId: worldId }));

    return {
      themes: [],
      worlds: [],
      skipped: [],
      active: null,
      corrupt: {},
      busy: false,
      forgeError: null,
      openError: null,

      /** FR-1/3: themes, the world list, then reopen the last world if it is still listed. */
      async startup() {
        try {
          set({ themes: listThemes() });
        } catch (e) {
          set({ openError: toAppError('themes', e) });
        }
        await get().refresh();
        const settings = await call('settings:get', () => getPersistence().settingsGet());
        if (!settings.ok) {
          set({ openError: settings.error });
          return;
        }
        const last = settings.value.lastWorldId;
        if (last !== null && get().worlds.some((w) => w.id === last)) await get().open(last);
      },

      /** FR-3: reload the world list and the documents main skipped. */
      async refresh() {
        const r = await call('world:list', () => getPersistence().worldList());
        if (r.ok) set({ worlds: r.value.worlds, skipped: r.value.skipped });
        else set({ openError: r.error });
      },

      /** FR-2: forge → gate → persist → activate. Inputs stay in the view on failure. */
      async forge({ themeId, seed, knobs }) {
        set({ busy: true, forgeError: null });
        const forged = forgePack(themeId, seed, knobs);
        if (!forged.ok) {
          set({ busy: false, forgeError: forged.error });
          return false;
        }
        const saved = await call('world:save', () =>
          getPersistence().worldSave({
            world: { name: `${themeId} · ${seed}`, theme: themeId, seed, knobs, schemaVersion: forged.pack.manifest.schemaVersion },
            packJson: forged.packJson,
          }),
        );
        if (!saved.ok) {
          set({ busy: false, forgeError: saved.error });
          return false;
        }
        set({ active: { meta: saved.value, packJson: forged.packJson, pack: forged.pack, runtime: forged.runtime } });
        await rememberLast(saved.value.id);
        await get().refresh();
        set({ busy: false });
        return true;
      },

      /** FR-3: read the stored bytes, re-validate through the gate, activate; failures mark the world corrupt. */
      async open(worldId) {
        set({ busy: true, openError: null });
        const markCorrupt = (error: AppError) => {
          set((s) => ({ busy: false, openError: error, corrupt: { ...s.corrupt, [worldId]: error } }));
          return false;
        };
        const opened = await call('world:open', () => getPersistence().worldOpen({ worldId }));
        if (!opened.ok) return markCorrupt(opened.error);
        const gate = openPack(opened.value.packJson);
        if (!gate.ok) return markCorrupt(gate.error);
        const { [worldId]: _cleared, ...corrupt } = get().corrupt;
        set({
          busy: false,
          corrupt,
          active: { meta: opened.value.meta, packJson: opened.value.packJson, pack: gate.pack, runtime: gate.runtime },
        });
        await rememberLast(worldId);
        return true;
      },

      /** FR-5: write the stored pack bytes to a user-chosen file via main's native dialog. */
      async exportPack(worldId) {
        const r = await call('pack:export', () => getPersistence().packExport({ worldId }));
        if (!r.ok) return { status: 'error', error: r.error };
        return { status: r.value.cancelled ? 'cancelled' : 'saved' };
      },
    };
  });
}

export const useWorldsStore = createWorldsStore();
