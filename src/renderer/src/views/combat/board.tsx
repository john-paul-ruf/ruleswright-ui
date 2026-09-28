/**
 * The Board panel (M15, FR-11), per mocks/combat.html (CX Combat board): grid packs only. Tokens sit at
 * `state.combatants[id].position`, the library's; distances are the library's `spatial.distance` (CA-15).
 * No reach, adjacency or legality is computed here (CA-12, EG-4).
 */
import { Fragment } from 'react';
import { distance, spatialOf, useCombatStore, type CombatState } from '../../store/combat';
import { Board, Panel, type BoardPiece } from '../../ui';

export function CombatBoard({ state }: { state: CombatState }): JSX.Element | null {
  const fight = useCombatStore((s) => s.fight);
  const sides = useCombatStore((s) => s.live?.sides);
  const spatial = fight ? spatialOf(fight.runtime.pack) : null;
  if (!fight || !sides || spatial === null) return null;

  const roster = [...sides.allies.map((a) => ({ id: a.id, side: 'ally' as const })), ...sides.enemies.map((e) => ({ id: e.id, side: 'enemy' as const }))];
  let allies = 0;
  let foes = 0;
  const pieces: BoardPiece[] = roster.flatMap(({ id, side }) => {
    const label = side === 'ally' ? `A${(allies += 1)}` : `E${(foes += 1)}`;
    const c = state.combatants[id];
    if (!c?.position) return [];
    const { x, y } = c.position;
    const active = id === state.active;
    const title = `${c.name} (${id}) · ${side === 'ally' ? 'allies' : 'enemies'} · (${x}, ${y})${active ? ' · active' : ''}`;
    return [{ id, label, side, x, y, title, active, testId: `combat-token-${id}` }];
  });
  const from = state.combatants[state.active]?.position;

  return (
    <Panel pad="s" kicker="Board" data-testid="combat-board">
      <p className="mono combat-spatial" data-testid="combat-spatial-def">
        spatial {JSON.stringify(spatial)}
      </p>
      <div className="combat-gap">
        <Board cols={8} rows={6} size="combat" pieces={pieces} label="Combat board, 8 by 6 viewport" />
      </div>
      {from && (
        <>
          <p className="kicker combat-kicker-s combat-gap">Distance from {state.active} (active) · library</p>
          <div className="combat-dl">
            {pieces
              .filter((p) => p.id !== state.active)
              .map((p) => (
                <Fragment key={p.id}>
                  <span className="mono">{p.id}</span>
                  <span className="mono">
                    <span data-testid={`combat-distance-${p.id}`}>{distance(fight.runtime, from, p)}</span>{' '}
                    <span className="dim">
                      · ({p.x}, {p.y})
                    </span>
                  </span>
                </Fragment>
              ))}
          </div>
        </>
      )}
      <p className="combat-note">
        Distances are the library&apos;s (<span className="mono">spatial.distance</span>); reach is judged only at Declare.
      </p>
    </Panel>
  );
}
