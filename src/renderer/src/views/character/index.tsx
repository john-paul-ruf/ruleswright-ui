/** Character surface (M13) placeholder: routing + empty state until SESSION-05 lands the surface. */
import { EmptyState } from '../../shell/EmptyState';
import { useWorldsStore } from '../../store/worlds';

export function CharacterView(): JSX.Element {
  const hasWorld = useWorldsStore((s) => s.active !== null);
  return <EmptyState kind={hasWorld ? 'no-character' : 'no-world'} />;
}
