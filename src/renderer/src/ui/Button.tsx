import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** `s` is the compact in-row size (Replay, Restore, −). */
  size?: 'm' | 's';
}

/** Design-system button: primary advances the flow, ghost is secondary, danger destroys. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'm', className, type = 'button', ...rest },
  ref,
) {
  const classes = ['btn', `btn-${variant}`, size === 's' ? 'btn-s' : '', className ?? ''].filter(Boolean).join(' ');
  return <button ref={ref} type={type} className={classes} {...rest} />;
});
