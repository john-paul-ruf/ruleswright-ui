import type { HTMLAttributes, ReactNode } from 'react';
import { Chip } from './Text';

export interface WorldPlateProps extends HTMLAttributes<HTMLElement> {
  name: ReactNode;
  /** Mono data line: theme · seed · schemaVersion …, verbatim. */
  params: ReactNode;
  kicker?: ReactNode;
  actions?: ReactNode;
}

/** World header (FR-4): kicker, display name, mono params line, actions. */
export function WorldPlate({ name, params, kicker = 'World', actions, className, ...rest }: WorldPlateProps): JSX.Element {
  return (
    <header className={['worldplate', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      <div>
        <p className="kicker">{kicker}</p>
        <h1 className="display worldplate-name">{name}</h1>
        <p className="mono worldplate-params">{params}</p>
      </div>
      {actions !== undefined && <div className="row-actions">{actions}</div>}
    </header>
  );
}

export interface SnapshotCardProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  meta?: ReactNode;
  /** `pack <id> · schema <n> · <contentHash>`, verbatim (B-3). */
  identity: ReactNode;
  actions?: ReactNode;
}

/** Named character snapshot with its pack identity (FR-10). */
export function SnapshotCard({ name, meta, identity, actions, className, ...rest }: SnapshotCardProps): JSX.Element {
  return (
    <div className={['panel2', 'snapshot', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      <p className="row-title">{name}</p>
      {meta !== undefined && <p className="mono row-data">{meta}</p>}
      <p className="mono row-data row-wrap">{identity}</p>
      {actions !== undefined && <div className="row-actions">{actions}</div>}
    </div>
  );
}

export type DeterminismState = 'pass' | 'fail' | 'unavailable' | 'idle';

export interface DeterminismStripProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  state: DeterminismState;
  title: ReactNode;
  /** Explanation, or the diff pointer on fail. */
  detail?: ReactNode;
  action?: ReactNode;
}

const STATE_LABEL: Record<DeterminismState, string> = {
  pass: 'verified',
  fail: 'failed',
  unavailable: 'unavailable',
  idle: 'not run',
};

/** FR-14 strip: pass (ok), fail (danger + diff pointer), unavailable (never faked), idle. */
export function DeterminismStrip({ state, title, detail, action, className, ...rest }: DeterminismStripProps): JSX.Element {
  return (
    <div
      className={['determinism', `determinism-${state}`, className ?? ''].filter(Boolean).join(' ')}
      data-state={state}
      {...rest}
    >
      <div className="determinism-head">
        <p className="determinism-title">
          <span aria-hidden="true">⟳ </span>
          {title}
        </p>
        <Chip tone={state === 'fail' ? 'danger' : state === 'pass' ? 'accent' : 'default'}>{STATE_LABEL[state]}</Chip>
      </div>
      {detail !== undefined && <div className="mono determinism-detail">{detail}</div>}
      {action !== undefined && <div className="row-actions">{action}</div>}
    </div>
  );
}

export interface EmptyWellProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  message: ReactNode;
  action?: ReactNode;
}

/** Centered surface2 well: one-line why + one primary CTA (FR-1). */
export function EmptyWell({ title, message, action, className, ...rest }: EmptyWellProps): JSX.Element {
  return (
    <div className={['panel2', 'empty-well', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      <p className="display empty-title">{title}</p>
      <p className="empty-message">{message}</p>
      {action !== undefined && <div className="empty-action">{action}</div>}
    </div>
  );
}
