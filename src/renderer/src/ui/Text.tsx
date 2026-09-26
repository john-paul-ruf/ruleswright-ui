import type { HTMLAttributes, ReactNode } from 'react';

function join(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** Mono caps micro-label over every panel. */
export function Kicker({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>): JSX.Element {
  return <p className={join('kicker', className)} {...rest} />;
}

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'default' | 'accent' | 'danger';
}

/** Small rounded metadata pill (counts, states, tags). */
export function Chip({ tone = 'default', className, ...rest }: ChipProps): JSX.Element {
  return <span className={join('chip', tone !== 'default' && `chip-${tone}`, className)} {...rest} />;
}

export interface StatNumeralProps {
  value: ReactNode;
  label: string;
  /** `l` = 40px sheet stat, `m` = 26px combatant hp. */
  size?: 'l' | 'm';
  className?: string;
}

/** Display-font numeral with its kicker label (hp, ac). The value is shown as given. */
export function StatNumeral({ value, label, size = 'l', className }: StatNumeralProps): JSX.Element {
  return (
    <div className={join('stat', className)}>
      <p className={size === 'l' ? 'statnum' : 'hpnum'}>{value}</p>
      <p className="kicker">{label}</p>
    </div>
  );
}

export interface ProgressBarProps {
  value: number;
  max: number;
  /** Accessible name, e.g. "hp" or a pool id. */
  label: string;
  className?: string;
}

/** Pool/hp bar; the fill is the given value over the given max, clamped to the track. */
export function ProgressBar({ value, max, label, className }: ProgressBarProps): JSX.Element {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={join('bar', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
