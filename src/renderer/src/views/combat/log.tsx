/** The event log (FR-13, CA-07): every library event verbatim, filterable by round and type. */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { roundsOf, typesOf, useCombatStore, visibleLog, type RuntimeEvent } from '../../store/combat';
import { EventRow, Panel, Select, type EventVariant } from '../../ui';

/** Event types that report a state change (the mutation voice, accent2). */
const MUTATION = /^(damage|healing|hp|condition|pool|slot|spell)[:]/;

export function variantOf(e: RuntimeEvent): EventVariant {
  if (e.why.rolls.length > 0) return 'roll';
  return MUTATION.test(e.type) ? 'mutation' : 'system';
}

/** A display line built only from `actor`/`target`/`payload` — never a replacement for `why`. */
export function summaryOf(e: RuntimeEvent): string {
  const who = e.actor === undefined ? '' : e.target === undefined ? e.actor : `${e.actor} → ${e.target}`;
  const data = Object.entries(e.payload).map(([k, v]) => `${k} ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  return [who, ...data].filter(Boolean).join(' · ') || e.type;
}

/** One log row: type, summary, `why.rolls` and `why.rule` verbatim. */
export function LogRow({ event, flagged = false, ...rest }: { event: RuntimeEvent; flagged?: boolean; 'data-testid'?: string }): JSX.Element {
  return (
    <EventRow
      {...rest}
      data-type={event.type}
      data-round={event.at.round}
      className={flagged ? 'combat-flagged' : undefined}
      variant={variantOf(event)}
      kicker={`round ${event.at.round} · turn ${event.at.turn} · ${event.type}`}
      summary={summaryOf(event)}
      rolls={event.why.rolls.length > 0 ? event.why.rolls.join(' · ') : undefined}
      why={`why.rule · ${event.why.rule}`}
    />
  );
}

/** The primary panel: filters + the scrolling log; follows the newest row unless the reader scrolled up. */
export function EventLog(): JSX.Element {
  const log = useCombatStore((s) => s.log);
  const filters = useCombatStore((s) => s.filters);
  const setFilters = useCombatStore((s) => s.setFilters);
  const rows = useMemo(() => {
    const kept = new Set(visibleLog(log, filters));
    return log.flatMap((event, index) => (kept.has(event) ? [{ event, index }] : []));
  }, [log, filters]);
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [rows]);

  function onScroll(): void {
    const el = scroller.current;
    if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  }

  return (
    <Panel
      pad="s"
      data-testid="combat-log"
      kicker="Event log · the stage"
      aside={
        <div className="combat-filters">
          <Select
            aria-label="Filter by round"
            data-testid="combat-filter-round"
            value={String(filters.round)}
            onChange={(e) => setFilters({ round: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
          >
            <option value="all">all rounds</option>
            {roundsOf(log).map((r) => (
              <option key={r} value={r}>
                round {r}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by event type"
            data-testid="combat-filter-type"
            value={filters.type}
            onChange={(e) => setFilters({ type: e.target.value })}
          >
            <option value="all">all types</option>
            {typesOf(log).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      <div ref={scroller} className="combat-scroll" role="log" aria-label="Event log" tabIndex={0} onScroll={onScroll}>
        {rows.map(({ event, index }) => (
          <LogRow key={index} event={event} data-testid="combat-event" />
        ))}
      </div>
      <p className="mono combat-note">
        {rows.length} of {log.length} events · every event: type · summary · why.rule · why.rolls verbatim (FR-13)
      </p>
    </Panel>
  );
}
