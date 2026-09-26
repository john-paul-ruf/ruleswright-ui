import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import type { WindowBounds } from '../shared/model';

const MIN_WIDTH = 1280;
const MIN_HEIGHT = 800;

/**
 * The single app window (NFR-Platform, NFR-Security): sandboxed renderer,
 * restored bounds, no popups, no navigation away from the app.
 */
export function createMainWindow(
  bounds: WindowBounds | null,
  onClose: (bounds: WindowBounds) => Promise<void>,
): BrowserWindow {
  const win = new BrowserWindow({
    x: bounds?.x,
    y: bounds?.y,
    width: Math.max(bounds?.width ?? MIN_WIDTH, MIN_WIDTH),
    height: Math.max(bounds?.height ?? MIN_HEIGHT, MIN_HEIGHT),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'Ruleswright',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (bounds?.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  // Bounds are persisted before the window really closes, so quitting never races the write.
  let isBoundsSaved = false;
  win.on('close', (event) => {
    if (isBoundsSaved) return;
    event.preventDefault();
    isBoundsSaved = true;
    const b = win.getNormalBounds();
    void onClose({ x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() }).finally(() =>
      win.close(),
    );
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
  return win;
}
