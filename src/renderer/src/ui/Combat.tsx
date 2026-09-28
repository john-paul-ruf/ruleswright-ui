import { useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';

export interface TriggerOfferProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** reactor · action */
  title: ReactNode;
  triggerId: string;
  /** The matching event (type, rolls, why.rule), verbatim. */
  provenance?: ReactNode;
  /** Target select, only when the reaction takes a target. */
  controls?: ReactNode;
  /** Take / Decline. */
  actions: ReactNode;
}

/** DF-1 trigger offer: one surface2 row per pending trigger. */
export function TriggerOffer({ title, triggerId, provenance, controls, actions, className, ...rest }: TriggerOfferProps): JSX.Element {
  return (
    <div className={['offer', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      <p className="row-title">{title}</p>
      <p className="mono row-data">{triggerId}</p>
      {provenance !== undefined && <div className="mono event-why">{provenance}</div>}
      {controls}
      <div className="row-actions">{actions}</div>
    </div>
  );
}

export interface CombatOverBannerProps extends HTMLAttributes<HTMLElement> {
  kicker: ReactNode;
  /** The library's combat-over report, verbatim. */
  headline: ReactNode;
  provenance?: ReactNode;
  actions?: ReactNode;
}

/** DF-1 combat-over banner: accent left rule above the combat grid. */
export function CombatOverBanner({ kicker, headline, provenance, actions, className, ...rest }: CombatOverBannerProps): JSX.Element {
  return (
    <section className={['overbanner', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      <p className="kicker">{kicker}</p>
      <p className="display overbanner-headline">{headline}</p>
      {provenance !== undefined && <p className="mono event-why">{provenance}</p>}
      {actions !== undefined && <div className="row-actions">{actions}</div>}
    </section>
  );
}

export interface BoardPiece {
  id: string;
  /** `A<n>` allies / `E<n>` enemies, by roster order. */
  label: string;
  side: 'ally' | 'enemy';
  x: number;
  y: number;
  /** `name (id) · side · (x, y)`: the token's title and accessible name. */
  title: string;
  /** Whose turn it is (combat only): the accent glow. */
  active?: boolean;
  testId?: string;
}

export interface BoardProps {
  /** The viewport in squares — display only; nothing is clamped (CX-D12). */
  cols: number;
  rows: number;
  /** Placement: 28px tokens in 36px squares; combat: 22px in 28px. */
  size: 'place' | 'combat';
  pieces: readonly BoardPiece[];
  label: string;
  /** Tokens focusable and movable (pointer: click a token, then a square, or drag; keys: arrows, Home, Esc). */
  editing?: boolean;
  /** A new request object focuses that token (entering a mode). */
  focusRequest?: { id: string } | null;
  onPlace?(id: string, x: number, y: number): void;
  onHome?(id: string): void;
  onEscape?(): void;
}

const NUDGE: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** A roster token outside the board (placement rows). */
export function TokenMark({ label, side }: Pick<BoardPiece, 'label' | 'side'>): JSX.Element {
  return (
    <span className={`board-token board-token-${side} board-token-mark`} aria-hidden="true">
      {label}
    </span>
  );
}

/**
 * CX Placement / Combat board: tokens at the positions given, verbatim. The origin is
 * `(min(0, min x), min(0, min y))`; pieces beyond the viewport are listed with their coordinates; shared
 * squares stack with a `×n` badge. It computes no reach, adjacency or legality (CA-12).
 */
export function Board({ cols, rows, size, pieces, label, editing = false, focusRequest, onPlace, onHome, onEscape }: BoardProps): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<string | null>(null);
  const shown = editing ? selected : null;

  const focusPiece = (id: string) =>
    boardRef.current?.querySelector<HTMLElement>(`[data-piece="${CSS.escape(id)}"]`)?.focus();
  useLayoutEffect(() => {
    const id = refocus.current;
    refocus.current = null;
    if (id !== null) focusPiece(id);
  });
  useLayoutEffect(() => {
    if (focusRequest) focusPiece(focusRequest.id);
  }, [focusRequest]);

  function place(id: string, x: number, y: number): void {
    refocus.current = id;
    setSelected(id);
    onPlace?.(id, x, y);
  }

  function onKey(piece: BoardPiece, e: KeyboardEvent<HTMLButtonElement>): void {
    const nudge = NUDGE[e.key];
    if (nudge) {
      e.preventDefault();
      place(piece.id, piece.x + nudge[0], piece.y + nudge[1]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      refocus.current = piece.id;
      onHome?.(piece.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelected(null);
      onEscape?.();
    }
  }

  const ox = Math.min(0, ...pieces.map((p) => p.x));
  const oy = Math.min(0, ...pieces.map((p) => p.y));
  const outside = pieces.filter((p) => p.x >= ox + cols || p.y >= oy + rows);
  const cells: JSX.Element[] = [<span key="corner" className="board-ax" />];
  for (let c = 0; c < cols; c += 1) {
    cells.push(
      <span key={`col${c}`} className="board-ax">
        {ox + c}
      </span>,
    );
  }
  for (let r = 0; r < rows; r += 1) {
    const y = oy + r;
    cells.push(
      <span key={`row${r}`} className="board-ax">
        {y}
      </span>,
    );
    for (let c = 0; c < cols; c += 1) {
      const x = ox + c;
      const here = pieces.filter((p) => p.x === x && p.y === y);
      cells.push(
        <div
          key={`${x},${y}`}
          className="board-sq"
          data-x={x}
          data-y={y}
          onClick={editing && shown !== null ? () => place(shown, x, y) : undefined}
          onDragOver={editing ? (e) => e.preventDefault() : undefined}
          onDrop={
            editing
              ? (e) => {
                  const id = e.dataTransfer.getData('text/plain');
                  if (id === '') return;
                  e.preventDefault();
                  place(id, x, y);
                }
              : undefined
          }
        >
          {here.map((p) => (
            <button
              key={p.id}
              type="button"
              className={['board-token', `board-token-${p.side}`, p.active ? 'active' : '', shown === p.id ? 'selected' : ''].filter(Boolean).join(' ')}
              data-piece={p.id}
              data-testid={p.testId}
              data-x={p.x}
              data-y={p.y}
              data-active={p.active ? 'true' : undefined}
              title={p.title}
              aria-label={p.title}
              aria-pressed={editing ? shown === p.id : undefined}
              tabIndex={editing ? 0 : -1}
              draggable={editing}
              onClick={
                editing
                  ? (e) => {
                      e.stopPropagation();
                      setSelected(p.id);
                    }
                  : undefined
              }
              onKeyDown={editing ? (e) => onKey(p, e) : undefined}
              onDragStart={editing ? (e) => e.dataTransfer.setData('text/plain', p.id) : undefined}
            >
              {p.label}
            </button>
          ))}
          {here.length > 1 && <span className="board-stack">×{here.length}</span>}
        </div>,
      );
    }
  }

  return (
    <div className="board-wrap">
      <div className="board-scroll">
        <div
          ref={boardRef}
          className={['board', `board-${size}`, editing ? 'editing' : ''].filter(Boolean).join(' ')}
          style={{ '--board-cols': cols, '--board-rows': rows } as CSSProperties}
          role="group"
          aria-label={label}
        >
          {cells}
        </div>
      </div>
      {outside.length > 0 && (
        <p className="mono board-note">outside the viewport · {outside.map((p) => `${p.label} ${p.id} (${p.x}, ${p.y})`).join(' · ')}</p>
      )}
    </div>
  );
}
