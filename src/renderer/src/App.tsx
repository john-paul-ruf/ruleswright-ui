import { useEffect } from 'react';
import { Shell } from './shell/Shell';
import { useWorldsStore } from './store/worlds';

let hasStarted = false;

/** Renderer root (M16). Startup runs once, even under StrictMode's double effects. */
export function App(): JSX.Element {
  useEffect(() => {
    if (hasStarted) return;
    hasStarted = true;
    void useWorldsStore.getState().startup();
  }, []);
  return <Shell />;
}
