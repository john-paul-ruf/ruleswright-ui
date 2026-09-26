import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Chip, ProgressBar, StatNumeral } from './Text';

export interface ArtifactRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  title: ReactNode;
  meta?: ReactNode;
  /** The row whose detail is showing. */
  open?: boolean;
}

/** World-surface list row: hover draws the accent border, the open row gets the accent chip. */
export function ArtifactRow({ title, meta, open = false, className, ...rest }: ArtifactRowProps): JSX.Element {
  return (
    <button
      type="button"
      aria-current={open || undefined}
      className={['artifact-row', open ? 'open' : '', className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      <span className="row-text">
        <span className="row-title">{title}</span>
        {meta !== undefined && <span className="row-meta">{meta}</span>}
      </span>
      <Chip tone={open ? 'accent' : 'default'}>open</Chip>
    </button>
  );
}

export interface CombatantRowProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  /** Mono data line (profile summary) shown verbatim. */
  meta?: ReactNode;
  /** hp as reported by the library; renders the numeral + bar when present. */
  hp?: { current: number; max: number };
  /** Whose turn it is: accent glow ring. */
  active?: boolean;
  /** Right-side slot: status chips or row actions. */
  trailing?: ReactNode;
}

/** Combatant row (FR-11/12): name, data line, hp numeral + bar, status. */
export function CombatantRow({ name, meta, hp, active = false, trailing, className, ...rest }: CombatantRowProps): JSX.Element {
  return (
    <div
      className={['combatant', active ? 'active' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-current={active || undefined}
      {...rest}
    >
      <div className="row-text">
        <p className="row-title">{name}</p>
        {meta !== undefined && <p className="mono row-data">{meta}</p>}
        {hp !== undefined && <ProgressBar className="combatant-bar" value={hp.current} max={hp.max} label="hp" />}
      </div>
      {hp !== undefined && <StatNumeral size="m" value={hp.current} label="hp" />}
      {trailing}
    </div>
  );
}

export type RecordStatus = 'complete' | 'diverged' | 'abandoned';

export interface RecordRowProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  status: RecordStatus;
  /** Mono line: rounds · events · age, or the first divergent event. */
  meta?: ReactNode;
  /** Mono RNG line, e.g. `rng a:… b:… c:… d:…`, rendered verbatim. */
  rng?: ReactNode;
  actions?: ReactNode;
}

/** Fight record row (B-3): name, outcome chip, meta, RNG words, actions. */
export function RecordRow({ name, status, meta, rng, actions, className, ...rest }: RecordRowProps): JSX.Element {
  return (
    <div className={['recrow', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      <div className="recrow-head">
        <p className="row-title">{name}</p>
        <Chip tone={status === 'diverged' ? 'danger' : 'default'}>{status}</Chip>
      </div>
      {meta !== undefined && <p className="mono row-data">{meta}</p>}
      {rng !== undefined && <p className="mono row-rng">{rng}</p>}
      {actions !== undefined && <div className="row-actions">{actions}</div>}
    </div>
  );
}
