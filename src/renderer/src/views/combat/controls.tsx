/**
 * The control column (FR-12, DF-1): phase + declare/step, trigger offers, combatants. A declare rejection
 * renders as the design's card: `declare:rejected · <kind>`, then `<rule> <resource>` and the message verbatim.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { offerEvents, useCombatStore, type CombatState } from '../../store/combat';
import { Button, Chip, CombatantRow, ErrorCard, Field, Panel, Select, TriggerOffer } from '../../ui';

/** Keep keyboard play alive: when the focused control disappears or is disabled, move focus to `target`. */
function useRescueFocus(target: RefObject<HTMLElement>, when: unknown): void {
  useEffect(() => {
    const focused = document.activeElement;
    const lost = focused === null || focused === document.body || (focused as HTMLButtonElement).disabled === true;
    if (lost && target.current && !(target.current as HTMLButtonElement).disabled) target.current.focus();
  }, [target, when]);
}

function TargetOptions({ state }: { state: CombatState }): JSX.Element {
  return (
    <>
      <option value="">no target — the library resolves</option>
      {state.order.map((id) => (
        <option key={id} value={id}>
          {id} ({state.combatants[id]?.side})
        </option>
      ))}
    </>
  );
}

export function PhasePanel({ state }: { state: CombatState }): JSX.Element {
  const pending = useCombatStore((s) => s.pending.length);
  const over = useCombatStore((s) => s.over);
  const rejection = useCombatStore((s) => s.rejection);
  const error = useCombatStore((s) => s.error);
  const declare = useCombatStore((s) => s.declare);
  const step = useCombatStore((s) => s.step);
  const actions = state.combatants[state.active]?.actions ?? [];
  const [picked, setPicked] = useState('');
  const [target, setTarget] = useState('');
  const actionId = actions.includes(picked) ? picked : (actions[0] ?? '');
  const locked = over || pending > 0;
  const stepRef = useRef<HTMLButtonElement>(null);
  useRescueFocus(stepRef, pending === 0 && !over);

  return (
    <Panel pad="s" kicker="Phase · begin → declare → resolve → end">
      <p className="display combat-phase" data-testid="combat-phase">
        {state.phase}
      </p>
      <p className="mono combat-meta">
        <span data-testid="combat-round">round {state.round}</span> · turn {state.turn} ·{' '}
        <span data-testid="combat-active">active: {state.active}</span>
      </p>

      <Field label="Declare an action" className="combat-gap">
        <Select data-testid="combat-declare-select" value={actionId} disabled={locked} onChange={(e) => setPicked(e.target.value)}>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Target" className="combat-gap-s">
        <Select data-testid="combat-target-select" value={target} disabled={locked} onChange={(e) => setTarget(e.target.value)}>
          <TargetOptions state={state} />
        </Select>
      </Field>
      <Button
        variant="primary"
        className="combat-full combat-gap-s"
        data-testid="combat-declare"
        disabled={locked || actionId === ''}
        onClick={() => declare(actionId, target === '' ? undefined : target)}
      >
        Declare
      </Button>

      {rejection && (
        <div className="combat-gap" data-testid="combat-rejection">
          <ErrorCard
            error={{
              kind: 'library',
              operation: rejection.type,
              name: String(rejection.payload.kind),
              message: String(rejection.payload.message),
              cards: [{ rule: rejection.why.rule, jsonPath: String(rejection.payload.resource), message: String(rejection.payload.message) }],
            }}
          />
        </div>
      )}

      <hr className="combat-rule" />
      <Button ref={stepRef} variant="primary" className="combat-full combat-step" data-testid="combat-step" disabled={locked} onClick={step}>
        Step →
      </Button>
      <p className="combat-note combat-center">all advancement through declare + step (FR-12)</p>
      {error && <ErrorCard className="combat-gap" error={error} />}
    </Panel>
  );
}

/** DF-1: one row per open offer (`fight.pendingTriggers`); Declare/Step wait until every offer is answered. */
export function OffersPanel({ state }: { state: CombatState }): JSX.Element | null {
  const pending = useCombatStore((s) => s.pending);
  const log = useCombatStore((s) => s.log);
  const respond = useCombatStore((s) => s.respond);
  const [targets, setTargets] = useState<Record<number, string>>({});
  const first = useRef<HTMLButtonElement>(null);
  useRescueFocus(first, pending.length);
  if (pending.length === 0) return null;
  const fired = offerEvents(pending, log);

  function answer(n: number, triggerId: string, choice: 'take' | 'decline'): void {
    const t = targets[n] ?? '';
    respond(triggerId, choice, choice === 'take' && t !== '' ? t : undefined);
    setTargets({});
  }

  return (
    <Panel pad="s" kicker="Trigger offers" aside={<Chip tone="accent">{pending.length} pending</Chip>} data-testid="combat-offers">
      <p className="combat-note">answer each to continue — rows are the library&apos;s pendingTriggers, verbatim</p>
      <div className="combat-stack">
        {pending.map((offer, n) => {
          const event = fired[n];
          return (
            <TriggerOffer
              key={n}
              data-testid={`combat-trigger-${n}`}
              title={`${offer.actorId} · ${offer.actionId}`}
              triggerId={offer.triggerId}
              provenance={
                <>
                  <p>
                    on {offer.matchingEvent}
                    {event && ` · round ${event.at.round} · turn ${event.at.turn}`}
                  </p>
                  {event && <p>why.rule · {event.why.rule}</p>}
                </>
              }
              controls={
                <Field label="Target (optional)" className="combat-gap-s">
                  <Select
                    data-testid={`combat-trigger-target-${n}`}
                    value={targets[n] ?? ''}
                    onChange={(e) => setTargets({ ...targets, [n]: e.target.value })}
                  >
                    <TargetOptions state={state} />
                  </Select>
                </Field>
              }
              actions={
                <>
                  <Button size="s" variant="primary" data-testid={`combat-trigger-take-${n}`} onClick={() => answer(n, offer.triggerId, 'take')}>
                    Take
                  </Button>
                  <Button
                    ref={n === 0 ? first : undefined}
                    size="s"
                    data-testid={`combat-trigger-decline-${n}`}
                    onClick={() => answer(n, offer.triggerId, 'decline')}
                  >
                    Decline
                  </Button>
                </>
              }
            />
          );
        })}
      </div>
    </Panel>
  );
}

export function CombatantsPanel({ state }: { state: CombatState }): JSX.Element {
  const hpAtStart = useCombatStore((s) => s.hpAtStart);
  return (
    <Panel pad="s" kicker="Combatants">
      <div className="combat-stack">
        {state.order.map((id) => {
          const c = state.combatants[id];
          if (!c) return null;
          return (
            <CombatantRow
              key={id}
              data-testid={`combat-combatant-${id}`}
              active={id === state.active}
              name={c.name}
              meta={`${c.side} · hp ${c.hp.current} / ${hpAtStart[id] ?? c.hp.current} at start · ac ${c.ac}`}
              hp={{ current: c.hp.current, max: hpAtStart[id] ?? c.hp.current }}
            />
          );
        })}
      </div>
    </Panel>
  );
}
