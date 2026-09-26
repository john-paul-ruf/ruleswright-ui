import { app, ipcMain, session, type BrowserWindow } from 'electron';
import { createDialogs } from './dialogs';
import { createIpcHandlers, registerIpc } from './ipc';
import { createStorage } from './storage';
import { createMainWindow } from './window';

// Test isolation hook (D-12): must run before `ready` so every userData read uses it.
if (process.env.RULESWRIGHT_USER_DATA) app.setPath('userData', process.env.RULESWRIGHT_USER_DATA);

const LOCAL_PROTOCOLS = new Set(['file:', 'devtools:', 'data:']);

/** FR-17: zero network I/O — only local app resources (and the dev server in dev) may load. */
function isAllowedUrl(url: string): boolean {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  try {
    const parsed = new URL(url);
    if (LOCAL_PROTOCOLS.has(parsed.protocol)) return true;
    return devUrl !== undefined && parsed.origin === new URL(devUrl).origin;
  } catch {
    return false;
  }
}

let mainWindow: BrowserWindow | null = null;

void app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedUrl(details.url) });
  });

  const storage = createStorage(app.getPath('userData'));
  registerIpc(ipcMain, createIpcHandlers({ storage, dialogs: createDialogs(() => mainWindow) }));

  const settings = await storage.getSettings();
  mainWindow = createMainWindow(settings.windowBounds, async (windowBounds) => {
    await storage.setSettings({ windowBounds }).catch((e: unknown) => {
      console.warn('[main] could not save window bounds', e);
    });
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => app.quit());
