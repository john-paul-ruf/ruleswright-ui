import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for destructive confirmations (delete). */
  tone?: 'primary' | 'danger';
  onConfirm(): void;
  onCancel(): void;
  /** Extra body (e.g. a rename input); its first control receives initial focus. */
  children?: ReactNode;
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: `role="dialog"` + `aria-modal`, focus trapped inside, Esc cancels, and focus
 * returns to the element that opened it. Initial focus: the first body control, else Cancel.
 */
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null {
  const { open, title, message, confirmLabel, cancelLabel = 'Cancel', tone = 'primary', onConfirm, onCancel, children } = props;
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyControl = dialogRef.current?.querySelector<HTMLElement>(`.dialog-body ${FOCUSABLE}`);
    (bodyControl ?? cancelRef.current)?.focus();
    return () => opener?.focus();
  }, [open]);

  if (!open) return null;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message !== undefined ? messageId : undefined}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="display dialog-title">
          {title}
        </h2>
        {message !== undefined && (
          <p id={messageId} className="dialog-message">
            {message}
          </p>
        )}
        {children !== undefined && <div className="dialog-body">{children}</div>}
        <div className="dialog-actions">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
