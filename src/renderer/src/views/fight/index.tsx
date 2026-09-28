/** Fight assembly (M14, FR-11/14), per mocks/fight.html: the ally, the enemy roster, placement, determinism. */
import { useMemo, useState } from 'react';
import { EmptyState } from '../../shell/EmptyState';
import { useCharacterStore } from '../../store/character';
import { listSpawnable, spatialLabel, spatialOf, spawnProfile, useCombatStore, type Position } from '../../store/combat';
import { useUiStore } from '../../store/ui';
import { useWorldsStore, type ActiveWorld } from '../../store/worlds';
import { Board, Button, Chip, CombatantRow, ErrorCard, Field, Input, Panel, Panel2, Select, TokenMark, type BoardPiece } from '../../ui';
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
      {error && error.operation !== ASSEMBLE && <ErrorCard error={error} />}

      <div className="fight-sides">
        <AlliesPanel runtime={runtime} />
        <EnemiesPanel runtime={runtime} />
      </div>

      <PlacementPanel pack={pack} />

      <DeterminismPanel />
    </div>
  );
}

/** The ally side (FR-11, CX Ally spawn row): the character, then its bestiary spawns in `startCombat` order. */
function AlliesPanel({ runtime }: { runtime: ActiveWorld['runtime'] }): JSX.Element | null {
  const view = useCharacterStore((s) => s.view);
  const allySpawns = useCombatStore((s) => s.allySpawns);
  const add = useCombatStore((s) => s.addAllySpawn);
  const remove = useCombatStore((s) => s.removeAllySpawn);
  const spawnable = useMemo(() => listSpawnable(runtime), [runtime]);
  const [pick, setPick] = useState(spawnable[0] ?? '');
  if (!view) return null;
  const { state, derived } = view;
  const classes = state.classes.map((c) => `${c.id} ${c.level}`).join(' / ');
  return (
    <Panel kicker="Allies" aside={<Chip tone="accent">your character</Chip>}>
      <div className="fight-stack">
        <CombatantRow
          className="fight-row"
          data-testid="fight-ally"
          active
          name={state.name}
          meta={`${state.race} · ${classes} · hp ${derived.hp} · ac ${derived.ac}`}
          trailing={<Chip>fixed</Chip>}
        />
        {allySpawns.map((a) => (
          <CombatantRow
            key={a.instanceId}
            className="fight-row"
            data-testid={`fight-ally-spawn-${a.instanceId}`}
            name={a.statblockId}
            meta={`spawnMonster · ${a.instanceId} · ally side`}
            trailing={
              <Button
                size="s"
                aria-label={`Remove ${a.instanceId}`}
                data-testid={`fight-ally-spawn-remove-${a.instanceId}`}
                onClick={() => remove(a.instanceId)}
              >
                −
              </Button>
            }
          />
        ))}
      </div>
      <p className="fight-note">The active character anchors the ally side (FR-11). Its combat profile comes from the library.</p>
      <div className="fight-add">
        <Field label="Ally bestiary spawn" className="fight-grow">
          <Select data-testid="fight-add-ally" value={pick} onChange={(e) => setPick(e.target.value)}>
            {spawnable.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </Select>
        </Field>
        <Button data-testid="fight-add-ally-submit" disabled={pick === ''} onClick={() => add(pick)}>
          + Add bestiary spawn
        </Button>
      </div>
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
      <AssembleByThreat />
      <p className="fight-note">Spawns are the pack&apos;s bestiary ids — no monsters are invented UI-side.</p>
    </Panel>
  );
}

const ASSEMBLE = 'fight:assemble';

function isFiniteNumber(text: string): boolean {
  return text.trim() !== '' && Number.isFinite(Number(text));
}

/**
 * FR-11 threat budget (CX Assemble by threat row): budget + an explicit encounter seed → the library's
 * `assembleEncounter`; its result is shown verbatim (CA-08). Only finite numbers enable Assemble.
 */
function AssembleByThreat(): JSX.Element {
  const encounter = useCombatStore((s) => s.encounter);
  const error = useCombatStore((s) => s.error);
  const assemble = useCombatStore((s) => s.assembleEnemies);
  const [budget, setBudget] = useState('');
  const [seed, setSeed] = useState('');
  const ready = isFiniteNumber(budget) && isFiniteNumber(seed);

  function randomizeSeed(): void {
    // A user-initiated pick into the visible field, never passed implicitly (Constraints: the encounter seed).
    setSeed(String(crypto.getRandomValues(new Uint32Array(1))[0]));
  }

  const groups = encounter && (encounter.groups.length === 0 ? '(none)' : encounter.groups.map((g) => `${g.id} ×${g.count}`).join(', '));
  return (
    <div className="fight-assemble">
      <p className="kicker fight-assemble-kicker">Assemble by threat</p>
      <div className="fight-assemble-row">
        <Input
          className="mono fight-assemble-budget"
          type="number"
          step="any"
          aria-label="threat budget"
          title="budget"
          data-testid="fight-assemble-budget"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <Input
          className="mono fight-assemble-seed"
          type="number"
          step={1}
          aria-label="encounter seed"
          title="seed"
          data-testid="fight-assemble-seed"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
        <Button data-testid="fight-assemble-seed-randomize" onClick={randomizeSeed}>
          <span aria-hidden="true">⟳</span> Randomize
        </Button>
        <Button variant="primary" data-testid="fight-assemble" disabled={!ready} onClick={() => assemble(Number(budget), Number(seed))}>
          Assemble
        </Button>
      </div>
      <p className="mono fight-assemble-hint">
        budget · seed — the encounter seed is explicit: typed, or picked by Randomize before the library is called
      </p>
      {encounter && (
        <p className="mono fight-assemble-summary" data-testid="fight-encounter-summary">
          encounter · groups {groups} · threat {encounter.threat} · budget {encounter.budget} · seedUsed {encounter.seedUsed} · heuristic{' '}
          {encounter.heuristic}
        </p>
      )}
      {error && error.operation === ASSEMBLE && (
        <div className="fight-assemble-error" data-testid="fight-assemble-error" role="alert">
          <ErrorCard error={error} />
        </div>
      )}
    </div>
  );
}

const INTEGER = /^-?\d+$/;

/** One coordinate: any integer moves the token; anything else marks the input and moves nothing. */
function CoordInput({ id, axis, value, onCommit }: { id: string; axis: 'x' | 'y'; value: number; onCommit(v: number): void }): JSX.Element {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  return (
    <Input
      className="mono place-coord"
      data-testid={`fight-place-${id}-${axis}`}
      aria-label={`${id} ${axis}`}
      inputMode="numeric"
      invalid={!INTEGER.test(text.trim())}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (INTEGER.test(e.target.value.trim())) onCommit(parseInt(e.target.value, 10));
      }}
    />
  );
}

/**
 * FR-11 placement (CX Placement board): grid packs only. Every position is the store's host input, passed
 * verbatim to Begin; the library judges it (CA-12). Nothing here computes reach or legality.
 */
function PlacementPanel({ pack }: { pack: ActiveWorld['pack'] }): JSX.Element | null {
  const positions = useCombatStore((s) => s.positions);
  const defaults = useCombatStore((s) => s.defaultPositions);
  const enemies = useCombatStore((s) => s.enemies);
  const allySpawns = useCombatStore((s) => s.allySpawns);
  const setPosition = useCombatStore((s) => s.setPosition);
  const resetPositions = useCombatStore((s) => s.resetPositions);
  const allyName = useCharacterStore((s) => s.view?.state.name);
  const spatial = spatialOf(pack);
  if (spatial === null || positions === null || defaults === null) return null;

  const statblockOf = new Map([...allySpawns, ...enemies].map((e) => [e.instanceId, e.statblockId]));
  const enemyIds = new Set(enemies.map((e) => e.instanceId));
  let allies = 0;
  let foes = 0;
  const roster = Object.keys(defaults).flatMap((id) => {
    const at: Position | undefined = positions[id];
    const home = defaults[id];
    if (!at || !home) return [];
    const statblock = statblockOf.get(id);
    const side = enemyIds.has(id) ? ('enemy' as const) : ('ally' as const);
    const label = side === 'ally' ? `A${(allies += 1)}` : `E${(foes += 1)}`;
    const name = statblock ?? allyName ?? id;
    const sideName = side === 'ally' ? 'allies' : 'enemies';
    return [{ id, label, side, name, sideName, at, home }];
  });
  const pieces: BoardPiece[] = roster.map((r) => ({
    id: r.id,
    label: r.label,
    side: r.side,
    x: r.at.x,
    y: r.at.y,
    title: `${r.name} (${r.id}) · ${r.sideName} · (${r.at.x}, ${r.at.y})`,
    testId: `fight-token-${r.id}`,
  }));

  return (
    <Panel kicker="Placement · grid" aside={<Chip>host input, not a rule</Chip>} data-testid="fight-placement">
      <p className="mono place-spatial" data-testid="fight-spatial-def">
        spatial {JSON.stringify(spatial)}
      </p>
      <div className="place-body">
        <div className="place-board">
          <Board
            cols={12}
            rows={8}
            size="place"
            pieces={pieces}
            label="Placement board, 12 by 8 viewport"
            editing
            onPlace={(id, x, y) => setPosition(id, { x, y })}
            onHome={(id) => {
              const home = defaults[id];
              if (home) setPosition(id, home);
            }}
          />
          <p className="mono place-caption">viewport 12 × 8 · display only · shared squares allowed</p>
        </div>
        <div>
          <div className="place-rows">
            {roster.map((r) => (
              <div key={r.id} className="place-row" data-testid={`fight-place-${r.id}`} data-x={r.at.x} data-y={r.at.y}>
                <TokenMark label={r.label} side={r.side} />
                <div className="row-text">
                  <p className="row-title place-name">{r.name}</p>
                  <p className="mono row-data">
                    {r.id} · {r.sideName} · default ({r.home.x}, {r.home.y})
                  </p>
                </div>
                <div className="place-coords">
                  <CoordInput id={r.id} axis="x" value={r.at.x} onCommit={(x) => setPosition(r.id, { x, y: r.at.y })} />
                  <CoordInput id={r.id} axis="y" value={r.at.y} onCommit={(y) => setPosition(r.id, { x: r.at.x, y })} />
                </div>
              </div>
            ))}
          </div>
          <Button className="place-reset" data-testid="fight-place-reset" onClick={resetPositions}>
            Reset to default layout
          </Button>
          <Panel2 pad="none" className="place-keys">
            <p className="kicker place-keys-kicker">Pointer &amp; keyboard</p>
            <p className="mono place-keys-lines">
              pointer · click a token, then a square (or drag it)
              <br />
              Tab / Shift+Tab · next / previous token, then the x · y inputs
              <br />← → ↑ ↓ · move the focused token one square
              <br />
              Home · focused token back to its default square
              <br />
              Esc · clear the selection
              <br />x · y inputs · any integer; a non-integer marks the input and moves nothing
            </p>
          </Panel2>
          <p className="fight-note">
            Default: allies in column 0, enemies in column 1, one row each — everyone starts where melee is legal. Change anything
            before Begin; the library judges reach at every Declare.
          </p>
        </div>
      </div>
    </Panel>
  );
}
