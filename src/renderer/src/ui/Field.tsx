import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

function inputClass(invalid: boolean | undefined, className: string | undefined): string {
  return ['input', invalid ? 'input-invalid' : '', className ?? ''].filter(Boolean).join(' ');
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Error state: danger border + `aria-invalid`. */
  invalid?: boolean;
}

/** Text/number entry on the base fill with a hairline border. */
export function Input({ invalid, className, ...rest }: InputProps): JSX.Element {
  return <input className={inputClass(invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** Option entry, styled like `Input`. */
export function Select({ invalid, className, ...rest }: SelectProps): JSX.Element {
  return <select className={inputClass(invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export interface FieldProps {
  /** Kicker label above the control. */
  label: string;
  /** Dim helper line under the control. */
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Kicker-labelled wrapper; the label element makes the whole block the control's label. */
export function Field({ label, hint, children, className }: FieldProps): JSX.Element {
  return (
    <label className={['field', className ?? ''].filter(Boolean).join(' ')}>
      <span className="kicker">{label}</span>
      {children}
      {hint !== undefined && <span className="field-hint">{hint}</span>}
    </label>
  );
}
