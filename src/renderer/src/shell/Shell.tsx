import { useEffect } from 'react';
import { applyMood, moodForTheme } from '../moods/map';
import { useUiStore, type Surface } from '../store/ui';
import { useWorldsStore } from '../store/worlds';
import { CharacterView } from '../views/character';
import { CombatView } from '../views/combat';
import { FightView } from '../views/fight';
import { RollView } from '../views/roll';
import { WorldView } from '../views/world';
import { TopBar } from './TopBar';
import './shell.css';

const VIEWS: Record<Surface, () => JSX.Element> = {
  roll: RollView,
  world: WorldView,
  character: CharacterView,
  fight: FightView,
  combat: CombatView,
};

/** FR-1/FR-15 shell: persistent top bar, the active surface, and the mood of the open world. */
export function Shell(): JSX.Element {
  const surface = useUiStore((s) => s.surface);
  const theme = useWorldsStore((s) => s.active?.meta.theme ?? null);

  useEffect(() => {
    applyMood(moodForTheme(theme));
  }, [theme]);

  const View = VIEWS[surface];
  return (
    <>
      <TopBar />
      <main className="shell-main" data-surface={surface}>
        <View />
      </main>
    </>
  );
}
