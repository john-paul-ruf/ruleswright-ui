/**
 * Turn order (M15, FR-11/12), per mocks/combat.html DF-CX-1 "Turn order panel" + "Initiative provenance block":
 * rows are `state.order` in library order, the active row is `state.active`, and the initiative block is the
 * `combat:start` event verbatim (CA-01). No down/skipped label (CX-D3): hp is only a number.
 */
import { initiativeOf, useCombatStore, type CombatState, type RuntimeEvent } from '../../store/combat';
import { Chip, Panel } from '../../ui';

/** A payload list (e.g. `initiative`) joined in the order the library emitted it; never re-sorted. */
function listed(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(' · ') : String(value);
}

function InitiativeBlock({ event }: { event: RuntimeEvent | undefined }): JSX.Element {
  return (
    <div className="panel2 combat-well combat-gap" data-testid="combat-initiative">
      <p className="kicker combat-kicker-s">Initiative · combat:start</p>
      {event ? (
        <div className="combat-dl">
          <span className="kicker combat-kicker-s">initiative</span>
          <span className="mono">{listed(event.payload.initiative)}</span>
          <span className="kicker combat-kicker-s">why.rolls</span>
          <span className="mono combat-strong">{event.why.rolls.join(' · ')}</span>
          <span className="kicker combat-kicker-s">why.rule</span>
          <span className="mono dim">{event.why.rule}</span>
        </div>
      ) : (
        <p className="combat-note">initiative event not in this log</p>
      )}
    </div>
  );
}

export function TurnOrderPanel({ state }: { state: CombatState }): JSX.Element {
  const start = useCombatStore((s) => initiativeOf(s.log));
  return (
    <Panel
      pad="s"
      kicker="Turn order"
      data-testid="combat-order"
      aside={
        <span className="mono combat-order-position" data-testid="combat-order-position">
          {/* `state.turn` is the library's 0-based index into `order`; the +1 is display indexing only. */}
          round {state.round} · turn {state.turn + 1} of {state.order.length}
        </span>
      }
    >
      <ol className="combat-order-list">
        {state.order.map((id, index) => {
          const c = state.combatants[id];
          if (!c) return null;
          const active = id === state.active;
          return (
            <li
              key={id}
              className={active ? 'combat-order-row active' : 'combat-order-row'}
              data-testid={`combat-order-${id}`}
              data-active={active}
              aria-current={active || undefined}
            >
              <span className="mono combat-order-index">{index + 1}</span>
              <span className="combat-order-name">{c.name}</span>
              <Chip tone={c.side === 'allies' ? 'accent' : 'default'}>{c.side}</Chip>
              <span className="hpnum">{c.hp.current}</span>
            </li>
          );
        })}
      </ol>
      <p className="mono combat-note">hp 0 is shown as a number only — no down / skipped label (the library decides who acts).</p>
      <InitiativeBlock event={start} />
    </Panel>
  );
}
