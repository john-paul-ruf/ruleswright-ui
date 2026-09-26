/** The typed client over the preload bridge (M07). Stores reach main only through here. */
import type { RuleswrightApi } from '../../../shared/ipc-contract';

export type Persistence = RuleswrightApi;

let override: Persistence | null = null;

/** The active client: `window.ruleswright` in the app, or whatever tests bound via `setPersistence`. */
export function getPersistence(): Persistence {
  return override ?? window.ruleswright;
}

/** Test DI: bind an in-process bridge over the real main handlers. */
export function setPersistence(p: Persistence): void {
  override = p;
}
