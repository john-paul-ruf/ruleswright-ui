import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('ruleswright', {});
