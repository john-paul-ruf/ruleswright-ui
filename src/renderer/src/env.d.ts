/// <reference types="vite/client" />
import type { RuleswrightApi } from '../../shared/ipc-contract';

declare global {
  interface Window {
    /** The preload bridge (M03); ids and names only, never paths. */
    readonly ruleswright: RuleswrightApi;
  }
}
