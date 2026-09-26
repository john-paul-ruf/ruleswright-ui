import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type RuleswrightApi } from '../shared/ipc-contract';

/** The single bridge object `window.ruleswright`, one method per channel in the `IPC` table. */
const api = Object.fromEntries(
  Object.entries(IPC).map(([method, channel]) => [method, (payload?: unknown) => ipcRenderer.invoke(channel, payload)]),
) as RuleswrightApi;

contextBridge.exposeInMainWorld('ruleswright', api);
