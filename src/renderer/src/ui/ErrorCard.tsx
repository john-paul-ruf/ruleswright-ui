import type { ReactNode } from 'react';
import type { AppErrorLike } from './types';

export interface ErrorCardProps {
  error: AppErrorLike;
  className?: string;
}

function kickerFor(error: AppErrorLike): string {
  if (error.kind === 'library') return `${error.operation} · ${error.name}`;
  if (error.kind === 'host') return `${error.operation} · ${error.code}`;
  return error.operation;
}

/**
 * FR-16 / CA-05: the one error pattern. Library cards render verbatim (rule, jsonPath, message,
 * hint); host errors render code + message; unexpected errors render operation + message.
 */
export function ErrorCard({ error, className }: ErrorCardProps): JSX.Element {
  let body: ReactNode;
  if (error.kind === 'library' && error.cards.length > 0) {
    body = (
      <ul className="errorcard-cards">
        {error.cards.map((card, i) => (
          <li key={i} className="errorcard-block">
            <p className="mono errorcard-locus">
              <span className="errorcard-rule">{card.rule}</span> <span className="dim">{card.jsonPath}</span>
            </p>
            <p className="mono errorcard-message">{card.message}</p>
            {card.hint !== undefined && <p className="errorcard-hint">{card.hint}</p>}
          </li>
        ))}
      </ul>
    );
  } else {
    body = <p className="mono errorcard-message">{error.message}</p>;
  }
  return (
    <div className={['errorcard', className ?? ''].filter(Boolean).join(' ')} data-testid="error-card" data-kind={error.kind}>
      <p className="kicker errorcard-kicker">{kickerFor(error)}</p>
      {body}
    </div>
  );
}

export interface OkCardProps {
  title: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Mirror of the error card for verified states (determinism pass). */
export function OkCard({ title, detail, children, className }: OkCardProps): JSX.Element {
  return (
    <div className={['okcard', className ?? ''].filter(Boolean).join(' ')} data-testid="ok-card">
      <p className="okcard-title">{title}</p>
      {detail !== undefined && <p className="mono okcard-detail">{detail}</p>}
      {children}
    </div>
  );
}
