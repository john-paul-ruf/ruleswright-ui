/** Fight assembly (M14) placeholder: routing + empty state until SESSION-06 lands the surface. */
import { EmptyState } from '../../shell/EmptyState';
import { useWorldsStore } from '../../store/worlds';

export function FightView(): JSX.Element {
  const hasWorld = useWorldsStore((s) => s.active !== null);
  return <EmptyState kind={hasWorld ? 'no-character' : 'no-world'} />;
}
