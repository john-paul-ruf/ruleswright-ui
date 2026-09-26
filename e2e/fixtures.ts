/**
 * Electron harness (M17) every e2e spec reuses: the real built app from `out/main/index.js`
 * on an isolated userData dir, restartable on the same dir, with a request recorder and
 * native-dialog stubs.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test';

const MAIN = resolve(__dirname, '..', 'out', 'main', 'index.js');

export interface RulesWrightApp {
  app: ElectronApplication;
  page: Page;
  /** The isolated userData dir (`RULESWRIGHT_USER_DATA`). */
  userData: string;
  /** Every URL the renderer requested, across restarts (FR-17). */
  requests: string[];
  /** Close the app and relaunch it on the same userData. */
  restart(): Promise<void>;
  /** Make the next native save dialog pick `path` (null = cancel). */
  stubSaveDialog(path: string | null): Promise<void>;
  /** Make the next native open dialog pick `path` (null = cancel). */
  stubOpenDialog(path: string | null): Promise<void>;
}

async function launch(userData: string, requests: string[]): Promise<{ app: ElectronApplication; page: Page }> {
  // Never inherit a dev-server URL: the harness always exercises the built renderer.
  const { ELECTRON_RENDERER_URL: _devUrl, ...env } = process.env;
  const app = await electron.launch({ args: [MAIN], env: { ...env, RULESWRIGHT_USER_DATA: userData } as Record<string, string> });
  const page = await app.firstWindow();
  page.on('request', (r) => requests.push(r.url()));
  await page.waitForLoadState('domcontentloaded');
  // Resources loaded before the listener attached are still visible to the page's own timing log.
  const loaded = await page.evaluate(() => [
    location.href,
    ...performance.getEntriesByType('resource').map((e) => e.name),
  ]);
  requests.push(...loaded);
  return { app, page };
}

export const test = base.extend<{ rw: RulesWrightApp }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring form
  rw: async ({}, use) => {
    const userData = mkdtempSync(join(tmpdir(), 'ruleswright-e2e-'));
    const requests: string[] = [];
    let current = await launch(userData, requests);
    const handle: RulesWrightApp = {
      get app() {
        return current.app;
      },
      get page() {
        return current.page;
      },
      userData,
      requests,
      async restart() {
        await current.app.close();
        current = await launch(userData, requests);
      },
      async stubSaveDialog(path) {
        await current.app.evaluate(({ dialog }, p) => {
          dialog.showSaveDialog = (async () => ({ canceled: p === null, filePath: p ?? '' })) as never;
        }, path);
      },
      async stubOpenDialog(path) {
        await current.app.evaluate(({ dialog }, p) => {
          dialog.showOpenDialog = (async () => ({ canceled: p === null, filePaths: p === null ? [] : [p] })) as never;
        }, path);
      },
    };
    try {
      await use(handle);
    } finally {
      await current.app.close().catch(() => undefined);
      rmSync(userData, { recursive: true, force: true });
    }
  },
});

export { expect } from '@playwright/test';
