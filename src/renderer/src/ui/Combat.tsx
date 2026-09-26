import type { HTMLAttributes, ReactNode } from 'react';

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
