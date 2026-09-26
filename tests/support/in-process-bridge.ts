import { createIpcHandlers } from '../../src/main/ipc';
import { createStorage } from '../../src/main/storage';
import type { Dialogs } from '../../src/main/dialogs';
import { IPC, type RuleswrightApi } from '../../src/shared/ipc-contract';

/** Dialog stand-in: the test sets the path the "user" picks (null = cancel). */
export interface FakeDialogs extends Dialogs {
  savePath: string | null;
  openPath: string | null;
  saveRequests: string[];
}

export function createFakeDialogs(): FakeDialogs {
  const fake: FakeDialogs = {
    savePath: null,
    openPath: null,
    saveRequests: [],
    async saveJson(defaultName) {
      fake.saveRequests.push(defaultName);
      return fake.savePath;
    },
    async openJson() {
      return fake.openPath;
    },
  };
  return fake;
}

/**
 * A `RuleswrightApi` over the real main handlers + real fs under `root`; only the
 * Electron transport is skipped. Payloads and results are structured-cloned like IPC.
 */
export function createInProcessBridge(root: string, dialogs: FakeDialogs = createFakeDialogs()): RuleswrightApi {
  const handlers = createIpcHandlers({ storage: createStorage(root), dialogs });
  return Object.fromEntries(
    Object.entries(IPC).map(([method, channel]) => [
      method,
      async (payload?: unknown) => structuredClone(await handlers[channel](structuredClone(payload))),
    ]),
  ) as RuleswrightApi;
}
