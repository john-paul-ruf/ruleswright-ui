import { useUiStore, type Surface } from '../store/ui';
import { Button, EmptyWell } from '../ui';

export type EmptyKind = 'no-world' | 'no-character' | 'no-fights';

/** design.md Empty States table: message (split at its dash into title + line) and CTA target. */
const EMPTY: Record<EmptyKind, { title: string; message: string; cta: string; to: Surface }> = {
  'no-world': { title: 'No world yet', message: 'Roll one, or import a pack.', cta: 'Go to Roll →', to: 'roll' },
  'no-character': {
    title: 'No character in this world yet',
    message: 'Create one.',
    cta: 'Go to Character →',
    to: 'character',
  },
  'no-fights': { title: 'No fights yet', message: 'Assemble one.', cta: 'Go to Fight →', to: 'fight' },
};

/** FR-1 empty state: centered well, one-line why, one primary CTA that routes back. */
export function EmptyState({ kind }: { kind: EmptyKind }): JSX.Element {
  const navigate = useUiStore((s) => s.navigate);
  const { title, message, cta, to } = EMPTY[kind];
  return (
    <EmptyWell
      data-testid="empty-state"
      data-kind={kind}
      title={title}
      message={message}
      action={
        <Button variant="primary" onClick={() => navigate(to)}>
          {cta}
        </Button>
      }
    />
  );
}
