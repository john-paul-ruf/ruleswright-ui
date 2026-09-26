/** Fight assembly (M14, FR-11/14), per mocks/fight.html: the ally, the enemy roster, determinism. */
import { useMemo, useState } from 'react';
import { EmptyState } from '../../shell/EmptyState';
import { useCharacterStore } from '../../store/character';
import { listSpawnable, spatialLabel, spawnProfile, useCombatStore } from '../../store/combat';
import { useUiStore } from '../../store/ui';
import { useWorldsStore, type ActiveWorld } from '../../store/worlds';
import { Button, Chip, CombatantRow, ErrorCard, Field, Panel, Select } from '../../ui';
import { DeterminismPanel } from './determinism';
import './fight.css';

export function FightView(): JSX.Element {
  const active = useWorldsStore((s) => s.active);
  const hasCharacter = useCharacterStore((s) => s.view !== null);
  if (!active) return <EmptyState kind="no-world" />;
  if (!hasCharacter) return <EmptyState kind="no-character" />;
  return <Fight key={active.meta.id} active={active} />;
}

function Fight({ active }: { active: ActiveWorld }): JSX.Element {
  const { meta, pack, runtime } = active;
  const enemies = useCombatStore((s) => s.enemies);
  const error = useCombatStore((s) => s.error);
  const begin = useCombatStore((s) => s.begin);
  const navigate = useUiStore((s) => s.navigate);
  const spatial = spatialLabel(pack);
  const seed = meta.seed === null ? 'seed unknown' : `seed ${meta.seed}`;

  function onBegin(): void {
    if (begin()) navigate('combat');
  }

  return (
    <div className="fight" data-testid="fight-surface">
      <header className="fight-head">
        <div>
          <p className="kicker">{meta.name} · Fight</p>
          <h1 className="display fight-title">Assemble a Fight</h1>
          <p className="mono fight-params" data-testid="fight-spatial">
            {spatial} · {seed}
          </p>
        </div>
        <Button variant="primary" data-testid="fight-begin" disabled={enemies.length === 0} onClick={onBegin}>
          Begin combat →
        </Button>
      </header>
      {error && <ErrorCard error={error} />}

      <div className="fight-sides">
        <AlliesPanel />
        <EnemiesPanel runtime={runtime} />
      </div>

      <DeterminismPanel />
    </div>
  );
}

function AlliesPanel(): JSX.Element | null {
  const view = useCharacterStore((s) => s.view);
  if (!view) return null;
  const { state, derived } = view;
  const classes = state.classes.map((c) => `${c.id} ${c.level}`).join(' / ');
  return (
    <Panel kicker="Allies" aside={<Chip tone="accent">your character</Chip>}>
      <CombatantRow
        className="fight-row"
        data-testid="fight-ally"
        active
        name={state.name}
        meta={`${state.race} · ${classes} · hp ${derived.hp} · ac ${derived.ac}`}
        trailing={<Chip>fixed</Chip>}
      />
      <p className="fight-note">The active character anchors the ally side (FR-11). Its combat profile comes from the library.</p>
    </Panel>
  );
}

function EnemiesPanel({ runtime }: { runtime: ActiveWorld['runtime'] }): JSX.Element {
  const enemies = useCombatStore((s) => s.enemies);
  const add = useCombatStore((s) => s.addEnemy);
  const remove = useCombatStore((s) => s.removeEnemy);
  const spawnable = useMemo(() => listSpawnable(runtime), [runtime]);
  const [pick, setPick] = useState(spawnable[0] ?? '');

  return (
    <Panel kicker="Enemies" aside={<Chip>from bestiary</Chip>}>
      <div className="fight-stack">
        {enemies.map((e) => {
          const profile = spawnProfile(runtime, e.statblockId, e.instanceId);
          return (
            <CombatantRow
              key={e.instanceId}
              className="fight-row"
              data-testid={`fight-enemy-${e.instanceId}`}
              name={e.instanceId}
              meta={
                profile.ok
                  ? `spawnMonster · ${e.statblockId} · hp ${profile.value.hp} · ac ${profile.value.ac} · actions: ${profile.value.actions.join(', ')}`
                  : e.statblockId
              }
              trailing={
                <Button
                  size="s"
                  aria-label={`Remove ${e.instanceId}`}
                  data-testid={`fight-enemy-remove-${e.instanceId}`}
                  onClick={() => remove(e.instanceId)}
                >
                  −
                </Button>
              }
            />
          );
        })}
        {enemies.length === 0 && <p className="text-12 dim">No enemies yet — add a spawn from the bestiary.</p>}
      </div>
      <div className="fight-add">
        <Field label="Bestiary spawn" className="fight-grow">
          <Select data-testid="fight-add-enemy" value={pick} onChange={(e) => setPick(e.target.value)}>
            {spawnable.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </Select>
        </Field>
        <Button data-testid="fight-add-enemy-submit" disabled={pick === ''} onClick={() => add(pick)}>
          + Add spawn
        </Button>
      </div>
      <p className="fight-note">Spawns are the pack&apos;s bestiary ids — no monsters are invented UI-side.</p>
    </Panel>
  );
}
