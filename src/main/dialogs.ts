import { dialog, type BrowserWindow } from 'electron';

/** Native file pickers; resolve to a path chosen by the user, or null when cancelled. */
export interface Dialogs {
  saveJson(defaultName: string): Promise<string | null>;
  openJson(): Promise<string | null>;
}

const JSON_FILTERS = [{ name: 'Pack JSON', extensions: ['json'] }];

/**
 * FR-5 import/export pickers. `dialog.show*Dialog` is looked up at call time so
 * e2e tests can stub it through `electronApp.evaluate`.
 */
export function createDialogs(getWindow: () => BrowserWindow | null): Dialogs {
  return {
    async saveJson(defaultName) {
      const options = { defaultPath: defaultName, filters: JSON_FILTERS };
      const win = getWindow();
      const r = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
      return r.canceled || !r.filePath ? null : r.filePath;
    },
    async openJson() {
      const options = { properties: ['openFile' as const], filters: JSON_FILTERS };
      const win = getWindow();
      const r = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      return r.canceled ? null : (r.filePaths[0] ?? null);
    },
  };
}
