import type { HTMLAttributes, ReactNode } from 'react';

export type EventVariant = 'roll' | 'mutation' | 'system';

export interface EventRowProps extends HTMLAttributes<HTMLDivElement> {
  variant: EventVariant;
  /** Mono caps line: round · event type. */
  kicker: ReactNode;
  summary: ReactNode;
  /** Roll text, verbatim (never animated arithmetic — FR-13). */
  rolls?: ReactNode;
  /** Provenance (`why.rule`, `why.rolls`) rendered in mono, verbatim. */
  why?: ReactNode;
  children?: ReactNode;
}

/** Provenance-colored log entry (FR-13): roll = accent rule, mutation = accent2, system = hairline. */
export function EventRow({ variant, kicker, summary, rolls, why, children, className, ...rest }: EventRowProps): JSX.Element {
  return (
    <div className={['event', `event-${variant}`, className ?? ''].filter(Boolean).join(' ')} {...rest}>
      <p className="kicker event-kicker">{kicker}</p>
      <p className="event-summary">{summary}</p>
      {rolls !== undefined && <p className="mono event-rolls">{rolls}</p>}
      {why !== undefined && <p className="mono event-why">{why}</p>}
      {children}
    </div>
  );
}
