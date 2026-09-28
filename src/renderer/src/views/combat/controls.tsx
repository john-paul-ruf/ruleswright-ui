/**
 * The control column (FR-12, DF-1): phase + declare/step, trigger offers, combatants. A declare rejection
 * renders as the design's card: `declare:rejected · <kind>`, then `<rule> <resource>` and the message verbatim.
 * DF-CX-1: the selected action's pack definition (CA-03) and each combatant's library state (CA-02, CA-04) are
 * shown as reported — no affordability preview; the declare result stays the authority (CX-D4).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  actionInfo,
  offerEvents,
  slotGrants,
  useCombatStore,
  type ActionInfo,
  type CombatantState,
  type CombatState,
} from '../../store/combat';
import { Button, Chip, CombatantRow, ErrorCard, Field, Panel, Select, TriggerOffer } from '../../ui';

/** Keep keyboard play alive: when the focused control disappears or is disabled, move focus to `target`. */
function useRescueFocus(target: RefObject<HTMLElement>, when: unknown): void {
  useEffect(() => {
    const focused = document.activeElement;
    const lost = focused === null || focused === document.body || (focused as HTMLButtonElement).disabled === true;
    if (lost && target.current && !(target.current as HTMLButtonElement).disabled) target.current.focus();
  }, [target, when]);
}

/** DF-CX-1 Action detail: `pack.actions[id]` verbatim; an absent part is `—`; `effect` is not shown. */
function ActionDetail({ actionId, info }: { actionId: string; info: ActionInfo | null }): JSX.Element {
  const absent = <span className="mono dim">—</span>;
  return (
    <div className="panel2 combat-well combat-gap-s" data-testid="combat-action-detail" aria-live="polite">
      <p className="kicker combat-kicker-s">Action · {actionId}</p>
      <div className="combat-dl">
        <span className="kicker combat-kicker-s">cost</span>
        {info ? <span className="mono">{JSON.stringify(info.cost)}</span> : absent}
        <span className="kicker combat-kicker-s">tags</span>
        {info && info.tags.length > 0 ? <span className="mono">{info.tags.join(' · ')}</span> : absent}
        <span className="kicker combat-kicker-s">trigger.on</span>
        {info?.triggerOn ? <span className="mono">{info.triggerOn}</span> : absent}
        <span className="kicker combat-kicker-s">valid</span>
        {info?.valid ? <span className="mono">{info.valid}</span> : absent}
      </div>
    </div>
  );
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
  const pack = useCombatStore((s) => s.fight?.runtime.pack);
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
      {pack && actionId !== '' && <ActionDetail actionId={actionId} info={actionInfo(pack, actionId)} />}
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

/** `<slot> <remaining>/<grant>`: grant keys in the library's order, then any ledger key it does not grant (`—`). */
function ledgerOf(c: CombatantState, grants: Readonly<Record<string, number>>): string[] {
  const remaining = c.slots.remaining;
  const names = [...Object.keys(grants), ...Object.keys(remaining).filter((name) => !Object.hasOwn(grants, name))];
  return names.map((name) => `${name} ${remaining[name] ?? '—'}/${grants[name] ?? '—'}`);
}

/** DF-CX-1 Combatant detail: the library's ledger, pools, bound slots and conditions, as reported. */
function CombatantDetail({ c, active }: { c: CombatantState; active: boolean }): JSX.Element | null {
  const fight = useCombatStore((s) => s.fight);
  if (!fight) return null;
  const conditionDefs = fight.runtime.pack.content.conditions ?? {};
  const pools = Object.entries(c.pools);
  const bound = Object.entries(c.boundSlots);
  const empty = (text: string) => <span className="combat-empty">{text}</span>;
  return (
    <details className="combat-detail" open={active}>
      <summary className="kicker combat-kicker-s" aria-label={`Detail · ${c.name}`}>
        Detail
      </summary>
      <div className="combat-dl">
        <span className="kicker combat-kicker-s">slots</span>
        <span className="combat-chips" data-testid={`combat-ledger-${c.id}`}>
          {ledgerOf(c, slotGrants(fight.runtime)).map((slot) => (
            <Chip key={slot} className="mono">
              {slot}
            </Chip>
          ))}
        </span>
        <span className="kicker combat-kicker-s">pools</span>
        <span data-testid={`combat-pools-${c.id}`}>
          {pools.length > 0 ? <span className="mono">{pools.map(([id, n]) => `${id} ${n}`).join(' · ')}</span> : empty('no pools')}
        </span>
        {bound.length > 0 && (
          <>
            <span className="kicker combat-kicker-s">bound</span>
            <span className="mono" data-testid={`combat-bound-${c.id}`}>
              {bound.map(([level, n]) => `L${level} ×${n}`).join(' · ')}
            </span>
          </>
        )}
        <span className="kicker combat-kicker-s">conditions</span>
        <span data-testid={`combat-conditions-${c.id}`}>
          {c.conditions.length > 0
            ? c.conditions.map(({ conditionId, duration }, i) => {
                const restricts = conditionDefs[conditionId]?.restricts ?? [];
                return (
                  <span key={i} className="combat-condition">
                    <span className="mono">
                      {conditionId} · {duration}
                    </span>
                    {restricts.length > 0 && <span className="mono combat-note-s">restricts {restricts.join(' · ')}</span>}
                  </span>
                );
              })
            : empty('no conditions')}
        </span>
      </div>
    </details>
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
            <div key={id}>
              <CombatantRow
                data-testid={`combat-combatant-${id}`}
                active={id === state.active}
                name={c.name}
                meta={`${c.side} · hp ${c.hp.current} / ${hpAtStart[id] ?? c.hp.current} at start · ac ${c.ac}`}
                hp={{ current: c.hp.current, max: hpAtStart[id] ?? c.hp.current }}
              />
              <CombatantDetail c={c} active={id === state.active} />
            </div>
          );
        })}
      </div>
      <p className="mono combat-note">as the library reports it — no affordability preview, no down label</p>
    </Panel>
  );
}
