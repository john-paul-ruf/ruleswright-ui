/**
 * The Board panel (M15, FR-11), per mocks/combat.html (CX Combat board + Reposition control): grid packs
 * only. Tokens sit at `state.combatants[id].position`, the library's; distances are the library's
 * `spatial.distance` (CA-15). No reach, adjacency or legality is computed here (CA-12, EG-4). Reposition
 * mirrors the store's `move` precondition and hands it the complete positions map (CA-13).
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { distance, spatialOf, useCombatStore, type CombatState, type Position } from '../../store/combat';
import { Board, Button, Panel, type BoardPiece } from '../../ui';

type Positions = Record<string, Position>;

export function CombatBoard({ state }: { state: CombatState }): JSX.Element | null {
  const fight = useCombatStore((s) => s.fight);
  const sides = useCombatStore((s) => s.live?.sides);
  const pending = useCombatStore((s) => s.pending.length);
  const over = useCombatStore((s) => s.over);
  const move = useCombatStore((s) => s.move);
  const [draft, setDraft] = useState<{ at: Positions; opened: Positions } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const moveRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  // The store's `move` precondition (CX-D10), mirrored: awaiting-declare, no open offer, not over.
  const canMove = state.phase === 'awaiting-declare' && pending === 0 && !over;
  const editing = draft !== null && canMove;

  useEffect(() => {
    if (draft !== null && !canMove) setDraft(null);
  }, [draft, canMove]);
  useEffect(() => {
    if (returnFocus.current && moveRef.current && !moveRef.current.disabled) {
      returnFocus.current = false;
      moveRef.current.focus();
    }
  });

  const spatial = fight ? spatialOf(fight.runtime.pack) : null;
  if (!fight || !sides || spatial === null) return null;

  const roster = [...sides.allies.map((a) => ({ id: a.id, side: 'ally' as const })), ...sides.enemies.map((e) => ({ id: e.id, side: 'enemy' as const }))];
  const live: Positions = {};
  for (const { id } of roster) {
    const position = state.combatants[id]?.position;
    if (position) live[id] = { x: position.x, y: position.y };
  }
  const shown = editing ? draft.at : live;
  let allies = 0;
  let foes = 0;
  const pieces: BoardPiece[] = roster.flatMap(({ id, side }) => {
    const label = side === 'ally' ? `A${(allies += 1)}` : `E${(foes += 1)}`;
    const c = state.combatants[id];
    const at = shown[id];
    if (!c || !at) return [];
    const active = id === state.active;
    const title = `${c.name} (${id}) · ${side === 'ally' ? 'allies' : 'enemies'} · (${at.x}, ${at.y})${active ? ' · active' : ''}`;
    return [{ id, label, side, x: at.x, y: at.y, title, active, testId: `combat-token-${id}` }];
  });
  const from = live[state.active];

  function open(): void {
    setDraft({ at: structuredClone(live), opened: structuredClone(live) });
    const first = pieces[0];
    if (first) setFocusRequest({ id: first.id });
  }

  function close(): void {
    setDraft(null);
    returnFocus.current = true;
  }

  function place(id: string, position: Position): void {
    if (draft) setDraft({ ...draft, at: { ...draft.at, [id]: { x: position.x, y: position.y } } });
  }

  function apply(): void {
    if (draft) move(draft.at);
    close();
  }

  return (
    <Panel
      pad="s"
      kicker="Board"
      data-testid="combat-board"
      aside={
        <Button ref={moveRef} size="s" data-testid="combat-move" disabled={!canMove || editing} onClick={open}>
          Reposition…
        </Button>
      }
    >
      <p className="mono combat-spatial" data-testid="combat-spatial-def">
        spatial {JSON.stringify(spatial)}
      </p>
      {!canMove && (
        <p className="combat-note" data-testid="combat-move-unavailable">
          Reposition is unavailable after a declare / while offers are open.
        </p>
      )}
      {editing && (
        <div className="combat-move-banner combat-gap" data-testid="combat-move-banner">
          <p className="combat-move-title">host repositioning — the engine has no movement rule</p>
          <p className="mono combat-note">Tab to a token · arrows move 1 square · Home = back to where it stood · Esc = cancel</p>
        </div>
      )}
      <div className="combat-gap">
        <Board
          cols={8}
          rows={6}
          size="combat"
          pieces={pieces}
          label="Combat board, 8 by 6 viewport"
          editing={editing}
          focusRequest={focusRequest}
          onPlace={(id, x, y) => place(id, { x, y })}
          onHome={(id) => {
            const opened = draft?.opened[id];
            if (opened) place(id, opened);
          }}
          onEscape={close}
        />
      </div>
      {editing && (
        <div className="row-actions">
          <Button size="s" variant="primary" data-testid="combat-move-apply" onClick={apply}>
            Apply reposition
          </Button>
          <Button size="s" data-testid="combat-move-cancel" onClick={close}>
            Cancel
          </Button>
        </div>
      )}
      {from && (
        <>
          <p className="kicker combat-kicker-s combat-gap">Distance from {state.active} (active) · library</p>
          <div className="combat-dl">
            {roster
              .filter(({ id }) => id !== state.active && live[id])
              .map(({ id }) => {
                const at = live[id] as Position;
                return (
                  <Fragment key={id}>
                    <span className="mono">{id}</span>
                    <span className="mono">
                      <span data-testid={`combat-distance-${id}`}>{distance(fight.runtime, from, at)}</span>{' '}
                      <span className="dim">
                        · ({at.x}, {at.y})
                      </span>
                    </span>
                  </Fragment>
                );
              })}
          </div>
        </>
      )}
      <p className="combat-note">
        {editing ? (
          'Distances refresh from the library after Apply.'
        ) : (
          <>
            Distances are the library&apos;s (<span className="mono">spatial.distance</span>); reach is judged only at Declare.
          </>
        )}
      </p>
    </Panel>
  );
}
