export interface JsonViewProps {
  /** Shown exactly as given; callers choose pretty or raw. */
  json: string;
  /** Accessible name of the scroll region. */
  label: string;
  className?: string;
}

/** Raw-JSON body (FR-4 fallback): a keyboard-scrollable `<pre>`, never re-formatted. */
export function JsonView({ json, label, className }: JsonViewProps): JSX.Element {
  return (
    <pre className={['mono', 'json-view', className ?? ''].filter(Boolean).join(' ')} tabIndex={0} aria-label={label}>
      {json}
    </pre>
  );
}
