/** Worlds store (FR-1/2/3/5): themes, world list, active world, forge/open/manage/import/export. Never throws to views. */
import { create } from 'zustand';
import type { IpcResult } from '../../../shared/ipc-contract';
import type { Knobs, SkippedDoc, WorldMeta } from '../../../shared/model';
import { forge as forgePack, listThemes, type ThemeInfo } from '../engine/compiler';
import { fromIpcError, toAppError, type AppError } from '../engine/errors';
import { importPackText, openPack, type Pack, type Runtime } from '../engine/schema';
import { getPersistence } from '../persistence/client';

export interface ActiveWorld {
  meta: WorldMeta;
  /** The exact string main returned (or the one just saved) — never re-stringified (CA-01). */
  packJson: string;
  pack: Pack;
  runtime: Runtime;
}

export interface DeleteCounts {
  snapshots: number;
  fights: number;
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
  importError: AppError | null;
  /** Display-only generation time of the last successful forge. */
  forgeMs: number | null;
  startup(): Promise<void>;
  refresh(): Promise<void>;
  forge(p: { themeId: string; seed: number; knobs: Knobs }): Promise<boolean>;
  open(worldId: string): Promise<boolean>;
  exportPack(worldId: string): Promise<ExportOutcome>;
  rename(worldId: string, name: string): Promise<AppError | null>;
  deleteCounts(worldId: string): Promise<DeleteCounts | AppError>;
  remove(worldId: string): Promise<AppError | null>;
  importFromText(text: string): Promise<boolean>;
  importFromFile(): Promise<boolean | 'cancelled'>;
}

/** Starting a new action retires the previous action's error, so one failure shows at a time. */
const NO_ACTION_ERRORS = { forgeError: null, openError: null, importError: null } as const;

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
      importError: null,
      forgeMs: null,

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
        set({ busy: true, ...NO_ACTION_ERRORS });
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
        set({
          active: { meta: saved.value, packJson: forged.packJson, pack: forged.pack, runtime: forged.runtime },
          forgeMs: forged.ms,
        });
        await rememberLast(saved.value.id);
        await get().refresh();
        set({ busy: false });
        return true;
      },

      /** FR-3: read the stored bytes, re-validate through the gate, activate; failures mark the world corrupt. */
      async open(worldId) {
        set({ busy: true, ...NO_ACTION_ERRORS });
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

      /** FR-3: rename (1–80 chars, main-validated); the open world's meta follows. */
      async rename(worldId, name) {
        const r = await call('world:rename', () => getPersistence().worldRename({ worldId, name }));
        if (!r.ok) return r.error;
        const active = get().active;
        if (active?.meta.id === worldId) set({ active: { ...active, meta: r.value } });
        await get().refresh();
        return null;
      },

      /** FR-3: what a delete cascades over, so the confirm can name the counts (database.md). */
      async deleteCounts(worldId) {
        const snapshots = await call('snapshot:list', () => getPersistence().snapshotList({ worldId }));
        if (!snapshots.ok) return snapshots.error;
        const fights = await call('fight:list', () => getPersistence().fightList({ worldId }));
        if (!fights.ok) return fights.error;
        return { snapshots: snapshots.value.length, fights: fights.value.length };
      },

      /** FR-3: delete with cascade (main also clears `lastWorldId`); closes the world if it was open. */
      async remove(worldId) {
        const r = await call('world:delete', () => getPersistence().worldDelete({ worldId }));
        if (!r.ok) return r.error;
        const { [worldId]: _gone, ...corrupt } = get().corrupt;
        set((s) => ({ corrupt, active: s.active?.meta.id === worldId ? null : s.active }));
        await get().refresh();
        return null;
      },

      /**
       * FR-5: gate pasted/opened pack text, persist canonical bytes (D-05) with provenance params
       * or all-null params (D-03), then open the new world. On rejection nothing is written.
       */
      async importFromText(text) {
        set({ busy: true, ...NO_ACTION_ERRORS });
        const imported = importPackText(text);
        if (!imported.ok) {
          set({ busy: false, importError: imported.error });
          return false;
        }
        const { params } = imported;
        const saved = await call('world:save', () =>
          getPersistence().worldSave({
            world: {
              name: imported.suggestedName,
              theme: params?.theme ?? null,
              seed: params?.seed ?? null,
              knobs: params?.knobs ?? null,
              schemaVersion: imported.pack.manifest.schemaVersion,
            },
            packJson: imported.packJson,
          }),
        );
        if (!saved.ok) {
          set({ busy: false, importError: saved.error });
          return false;
        }
        const opened = await get().open(saved.value.id);
        await get().refresh();
        return opened;
      },

      /** FR-5: pick a pack file through main's native dialog, then import its text. */
      async importFromFile() {
        set({ ...NO_ACTION_ERRORS });
        const r = await call('pack:import', () => getPersistence().packImport());
        if (!r.ok) {
          set({ importError: r.error });
          return false;
        }
        if (r.value.cancelled) return 'cancelled';
        return get().importFromText(r.value.packText);
      },
    };
  });
}

export const useWorldsStore = createWorldsStore();
