/** Combat (M15, FR-11–13), per mocks/combat.html + DF-1 + CX + DF-CX-1: the event log is the primary panel. */
import { useEffect, useRef } from 'react';
import { EmptyState } from '../../shell/EmptyState';
import { spatialLabel, spatialOf, useCombatStore, type RuntimeEvent } from '../../store/combat';
import { useUiStore } from '../../store/ui';
import { useWorldsStore } from '../../store/worlds';
import { Button, Chip, CombatOverBanner, Panel } from '../../ui';
import { RECORD_NAME_INPUT, RecordsPanel } from '../fight/records';
import { CombatBoard } from './board';
import { CombatantsPanel, OffersPanel, PhasePanel } from './controls';
import { EventLog } from './log';
import { TurnOrderPanel } from './order';
import './combat.css';

export function CombatView(): JSX.Element {
  const active = useWorldsStore((s) => s.active);
  const state = useCombatStore((s) => s.state);
  if (!active) return <EmptyState kind="no-world" />;
  if (!state) return <EmptyState kind="no-fights" />;
  const { meta, pack } = active;
  const seed = meta.seed === null ? 'seed unknown' : `seed ${meta.seed}`;
  const spatial = spatialOf(pack);

  return (
    <div className="combat" data-testid="combat-surface">
      <header className="combat-head">
        <div>
          <p className="kicker">
            {meta.name} · {seed} · round {state.round} · {state.phase}
          </p>
          <h1 className="display combat-title">Combat</h1>
        </div>
        {/* DF-CX-1 Spatial caption: the pack's spatial section, verbatim. */}
        <div className="combat-head-chips">
          <Chip>{spatialLabel(pack)}</Chip>
          <span className="mono combat-caption" data-testid="combat-spatial-caption">
            {spatial ? `model ${spatial.model} · reach.default ${spatial.reach.default}` : 'this pack declares no spatial model'}
          </span>
        </div>
      </header>
      <OverBanner />
      <div className="combat-grid">
        <EventLog />
        <aside className="combat-column">
          <PhasePanel state={state} />
          <OffersPanel state={state} />
          <CombatBoard state={state} />
          <TurnOrderPanel state={state} />
          <CombatantsPanel state={state} />
          <Panel pad="s" kicker="Replay & records">
            <RecordsPanel recordable />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function lastEnded(log: readonly RuntimeEvent[]): RuntimeEvent | undefined {
  for (let i = log.length - 1; i >= 0; i -= 1) if (log[i]?.type === 'combat:ended') return log[i];
  return undefined;
}

/** DF-1: announced only once the library reports `combat-over`, from its `combat:ended` event verbatim. */
function OverBanner(): JSX.Element | null {
  const over = useCombatStore((s) => s.over);
  const round = useCombatStore((s) => s.state?.round);
  const ended = useCombatStore((s) => lastEnded(s.log));
  const navigate = useUiStore((s) => s.navigate);
  const back = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (over && (document.activeElement === document.body || (document.activeElement as HTMLButtonElement | null)?.disabled)) {
      back.current?.focus();
    }
  }, [over]);

  if (!over) return null;
  return (
    <CombatOverBanner
      data-testid="combat-over"
      role="status"
      aria-live="polite"
      kicker={`Combat over · round ${round} · phase combat-over`}
      headline={ended ? `winner ${String(ended.payload.winner)} · defeated ${String(ended.payload.defeated)}` : 'combat-over'}
      provenance={ended ? `${ended.type} · why.rule ${ended.why.rule}` : undefined}
      actions={
        <>
          <Button variant="primary" data-testid="combat-over-record" onClick={() => document.getElementById(RECORD_NAME_INPUT)?.focus()}>
            Record this fight…
          </Button>
          <Button ref={back} data-testid="combat-back" onClick={() => navigate('fight')}>
            ← Back to Fight assembly
          </Button>
        </>
      }
    />
  );
}
