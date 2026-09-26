/** World surface (M12) placeholder: routing + empty state until SESSION-04 lands the surface. */
import { EmptyState } from '../../shell/EmptyState';
import { useWorldsStore } from '../../store/worlds';
import { WorldPlate } from '../../ui';

export function WorldView(): JSX.Element {
  const meta = useWorldsStore((s) => s.active?.meta ?? null);
  if (!meta) return <EmptyState kind="no-world" />;
  const params = meta.theme !== null && meta.seed !== null ? `${meta.theme} · seed ${meta.seed}` : 'imported · seed unknown';
  return <WorldPlate name={meta.name} params={`${params} · schemaVersion ${meta.schemaVersion}`} />;
}
