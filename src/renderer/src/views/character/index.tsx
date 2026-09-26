/** Character surface (M13, FR-6–10), per mocks/character.html: sheet column + snapshots/create side column. */
import { EmptyState } from '../../shell/EmptyState';
import { useCharacterStore } from '../../store/character';
import { useUiStore } from '../../store/ui';
import { useWorldsStore } from '../../store/worlds';
import { Button, WorldPlate } from '../../ui';
import { ConditionsPanel, DerivedPanel, PoolsSpellsPanel, ProgressionPanel } from './sheet';
import { CreatePanel, SnapshotsPanel } from './side';
import './character.css';

export function CharacterView(): JSX.Element {
  const active = useWorldsStore((s) => s.active);
  const view = useCharacterStore((s) => s.view);
  const navigate = useUiStore((s) => s.navigate);

  if (!active) return <EmptyState kind="no-world" />;
  const { pack, meta } = active;

  return (
    <div className="char" data-testid="char-surface">
      {view && (
        <WorldPlate
          kicker={`${meta.name} · Character`}
          name={<span data-testid="char-name-display">{view.state.name}</span>}
          params={[
            view.state.race,
            ...view.state.classes.map((c) => `${c.id} ${c.level}`),
            `level ${view.state.level}`,
            `xp ${view.state.xp}`,
          ].join(' · ')}
          actions={
            <Button variant="primary" onClick={() => navigate('fight')}>
              Take to a fight →
            </Button>
          }
        />
      )}
      <div className="char-grid">
        <div className="char-column">
          {view ? (
            <>
              <DerivedPanel view={view} pack={pack} />
              <PoolsSpellsPanel view={view} pack={pack} />
              <ConditionsPanel view={view} pack={pack} />
              <ProgressionPanel view={view} pack={pack} />
            </>
          ) : (
            <EmptyState kind="no-character" />
          )}
        </div>
        <aside className="char-column">
          <SnapshotsPanel key={`snap-${meta.id}`} />
          <CreatePanel key={`create-${meta.id}`} pack={pack} />
        </aside>
      </div>
    </div>
  );
}
