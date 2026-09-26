import { useUiStore, type Surface } from '../store/ui';
import { useWorldsStore } from '../store/worlds';
import { Chip } from '../ui';

const NAV: { surface: Exclude<Surface, 'combat'>; label: string }[] = [
  { surface: 'roll', label: 'Roll' },
  { surface: 'world', label: 'World' },
  { surface: 'character', label: 'Character' },
  { surface: 'fight', label: 'Fight' },
];

/** FR-1 top bar: glyph, active world name + `theme · seed`, and one-click nav to every surface. */
export function TopBar(): JSX.Element {
  const meta = useWorldsStore((s) => s.active?.meta ?? null);
  const surface = useUiStore((s) => s.surface);
  const navigate = useUiStore((s) => s.navigate);
  // Combat is reached from Fight, so Fight stays marked while fighting.
  const marked = surface === 'combat' ? 'fight' : surface;

  return (
    <header className="topbar section-head">
      <div className="topbar-inner">
        <div className="topbar-world">
          <span className="topbar-glyph" aria-hidden="true">
            ✦
          </span>
          <span className="kicker topbar-mark">Ruleswright</span>
          <span className="topbar-rule" aria-hidden="true" />
          {meta ? (
            <>
              <span className="display topbar-name" data-testid="active-world-name">
                {meta.name}
              </span>
              <Chip className="mono topbar-params" data-testid="active-world-seed">
                {meta.theme !== null && meta.seed !== null ? `${meta.theme} · ${meta.seed}` : 'imported · seed unknown'}
              </Chip>
            </>
          ) : (
            <span className="topbar-none">No world open</span>
          )}
        </div>
        <nav className="topbar-nav" aria-label="Surfaces">
          {NAV.map(({ surface: s, label }) => (
            <button
              key={s}
              type="button"
              className="navtab"
              data-testid={`nav-${s}`}
              aria-current={marked === s ? 'page' : undefined}
              onClick={() => navigate(s)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
