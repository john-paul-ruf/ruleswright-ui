import { useEffect } from 'react';
import { useWorldsStore } from './store/worlds';
import { RollView } from './views/roll';

let hasStarted = false;

/** Renderer root (M16). Startup runs once, even under StrictMode's double effects. */
export function App(): JSX.Element {
  useEffect(() => {
    if (hasStarted) return;
    hasStarted = true;
    void useWorldsStore.getState().startup();
  }, []);
  return (
    <main>
      <RollView />
    </main>
  );
}
