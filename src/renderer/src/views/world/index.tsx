/** World surface (M12, FR-4/FR-14a/FR-5 export): browse the pack, rerun same seed, export. */
import { useMemo, useState } from 'react';
import { rerunUnavailableReason } from '../../engine/determinism';
import { EmptyState } from '../../shell/EmptyState';
import { useDeterminismStore, type RerunState } from '../../store/determinism';
import { useUiStore } from '../../store/ui';
import { useWorldsStore, type ActiveWorld, type ExportOutcome } from '../../store/worlds';
import { ArtifactRow, Button, DeterminismStrip, ErrorCard, JsonView, Kicker, Panel, WorldPlate } from '../../ui';
import { EntryDetail, entryMeta, entryTitle } from './details';
import { sectionsOf, type WorldSection } from './sections';
import './world.css';

export function WorldView(): JSX.Element {
  const active = useWorldsStore((s) => s.active);
  if (!active) return <EmptyState kind="no-world" />;
  // Keyed by world: switching worlds resets section, selection, raw and export state.
  return <World key={active.meta.id} active={active} />;
}

function paramsLine({ meta }: ActiveWorld): string {
  const params = meta.theme !== null && meta.seed !== null ? `${meta.theme} · seed ${meta.seed}` : 'imported · seed unknown';
  return `${params} · schemaVersion ${meta.schemaVersion}`;
}

function RerunMark({ state }: { state: RerunState | undefined }): JSX.Element | null {
  if (state === undefined || state === 'running' || state.status === 'unavailable') return null;
  const pass = state.status === 'pass';
  return (
    <span className={`mono world-rerun-mark ${pass ? 'is-pass' : 'is-fail'}`} aria-hidden="true">
      {pass ? '✓' : '✗'}
    </span>
  );
}

const STRIP = { className: 'world-strip', role: 'status', 'aria-live': 'polite' } as const;

/** FR-14a strip: pass (ok) · fail (danger + diff pointer) · unavailable (never faked) · library error. */
function RerunStrip({ state, unavailable }: { state: RerunState | undefined; unavailable: string | null }): JSX.Element {
  const result = state === undefined || state === 'running' ? null : state;
  const reason = unavailable ?? (result?.status === 'unavailable' ? result.reason : null);
  if (reason !== null) {
    return (
      <DeterminismStrip {...STRIP} data-testid="world-determinism" state="unavailable" title="Rerun same seed — unavailable" detail={reason} />
    );
  }
  if (result === null) {
    return (
      <DeterminismStrip
        {...STRIP}
        data-testid="world-determinism"
        aria-busy={state === 'running'}
        state="idle"
        title={state === 'running' ? 'Rerun same seed — running…' : 'Rerun same seed'}
        detail="regenerates from the stored theme + seed + knobs and compares the bytes with the stored pack"
      />
    );
  }
  switch (result.status) {
    case 'pass':
      return (
        <DeterminismStrip
          {...STRIP}
          data-testid="ok-card"
          state="pass"
          title="Rerun same seed — verified"
          detail={`byte-identical · ${result.bytes} bytes · regenerated from theme+seed+knobs in ${Math.round(result.ms)} ms`}
        />
      );
    case 'fail':
      return (
        <DeterminismStrip
          {...STRIP}
          data-testid="world-determinism"
          state="fail"
          title="Rerun same seed — bytes differ"
          detail={
            <div data-testid="world-determinism-pointer" className="world-pointer">
              <p>
                first difference at char {result.offset} · stored {result.storedLength} chars · rerun {result.rerunLength}{' '}
                chars
              </p>
              <p>stored …{result.storedExcerpt}…</p>
              <p>rerun  …{result.rerunExcerpt}…</p>
            </div>
          }
        />
      );
    default:
      return (
        <DeterminismStrip
          {...STRIP}
          data-testid="world-determinism"
          state="fail"
          title="Rerun same seed — the library refused"
          detail={result.status === 'error' ? <ErrorCard error={result.error} /> : undefined}
        />
      );
  }
}

function ExportStatus({ outcome }: { outcome: ExportOutcome | 'running' | null }): JSX.Element | null {
  if (outcome === null || outcome === 'running') return null;
  if (outcome.status === 'error') return <ErrorCard error={outcome.error} className="world-export" />;
  return (
    <p className="mono world-export world-export-status" data-testid="world-export-status" role="status">
      {outcome.status === 'saved' ? 'exported · the stored pack.json bytes were written' : 'export cancelled'}
    </p>
  );
}

function World({ active }: { active: ActiveWorld }): JSX.Element {
  const { meta, pack } = active;
  const navigate = useUiStore((s) => s.navigate);
  const exportPack = useWorldsStore((s) => s.exportPack);
  const rerunState = useDeterminismStore((s) => s.byWorld[meta.id]);
  const rerun = useDeterminismStore((s) => s.rerun);

  const sections = useMemo(() => sectionsOf(pack), [pack]);
  const unavailable = useMemo(() => rerunUnavailableReason(meta), [meta]);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [openIds, setOpenIds] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState(false);
  const [exported, setExported] = useState<ExportOutcome | 'running' | null>(null);

  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const kind = section?.bespoke ?? null;
  const entries = kind !== null && section ? Object.entries(section.data as Record<string, unknown>) : [];
  const openId = section ? (openIds[section.id] ?? entries[0]?.[0]) : undefined;
  const openEntry = entries.find(([id]) => id === openId);
  const rawView = !section
    ? null
    : kind !== null && openEntry
      ? { path: `${section.path}.${openEntry[0]}`, json: JSON.stringify(openEntry[1], null, 2) }
      : { path: section.path, json: JSON.stringify(section.data, null, 2) };
  const showRaw = rawView !== null && (raw || kind === null);

  async function onExport() {
    setExported('running');
    setExported(await exportPack(meta.id));
  }

  const navItem = (s: WorldSection) => (
    <button
      key={s.id}
      type="button"
      className="world-subnav-item"
      data-testid={`world-nav-${s.id}`}
      aria-current={s.id === section?.id || undefined}
      onClick={() => setSectionId(s.id)}
    >
      <span className="world-subnav-label">{s.id}</span>
      {s.count !== null && <span className="mono world-subnav-count">{s.count}</span>}
    </button>
  );
  const fallback = sections.filter((s) => s.bespoke === null);

  return (
    <div className="world">
      <WorldPlate
        name={meta.name}
        params={paramsLine(active)}
        actions={
          <>
            <Button
              data-testid="world-raw-toggle"
              aria-pressed={showRaw}
              disabled={kind === null}
              title={kind === null ? 'No bespoke view for this section: it is shown as raw JSON' : undefined}
              onClick={() => setRaw((r) => !r)}
            >
              Raw JSON
            </Button>
            <Button
              data-testid="rerun-same-seed"
              disabled={unavailable !== null || rerunState === 'running'}
              title={unavailable ?? 'Regenerate from stored theme + seed + knobs'}
              onClick={() => {
                setExported(null);
                void rerun();
              }}
            >
              <span aria-hidden="true">⟳</span> Rerun same seed <RerunMark state={rerunState} />
            </Button>
            <Button data-testid="export-pack" disabled={exported === 'running'} onClick={() => void onExport()}>
              Export JSON
            </Button>
            <Button variant="primary" onClick={() => navigate('character')}>
              Live in this world →
            </Button>
          </>
        }
      />
      <ExportStatus outcome={exported} />
      <RerunStrip state={rerunState} unavailable={unavailable} />

      <div className="world-body">
        <nav className="panel world-subnav" aria-label="Pack sections">
          {sections.filter((s) => s.bespoke !== null).map(navItem)}
          {fallback.length > 0 && (
            <>
              <hr className="world-subnav-rule" />
              <p className="kicker world-subnav-kicker">Other artifacts → raw</p>
              {fallback.map(navItem)}
            </>
          )}
        </nav>

        <div className="world-content">
          {kind !== null && section && (
            <div className="world-main">
              <div className="world-rows">
                <Kicker className="world-section-kicker">{section.id}</Kicker>
                {entries.map(([id, entry]) => (
                  <ArtifactRow
                    key={id}
                    data-testid={`world-entry-${id}`}
                    title={entryTitle(id, entry)}
                    meta={<span className="mono">{entryMeta(kind, id, entry, pack)}</span>}
                    open={id === openId}
                    onClick={() => setOpenIds((o) => ({ ...o, [section.id]: id }))}
                  />
                ))}
                {entries.length === 0 && <p className="dim world-note">This pack has no {section.id}.</p>}
                <p className="dim world-note">
                  Every row is pack data — the UI hardcodes no rule content. Artifact kinds without a bespoke view open
                  straight into raw JSON.
                </p>
              </div>
              <Panel as="article" className="world-detail" data-testid="world-detail">
                {openEntry ? (
                  <EntryDetail kind={kind} id={openEntry[0]} entry={openEntry[1]} pack={pack} />
                ) : (
                  <p className="dim">Nothing to show.</p>
                )}
              </Panel>
            </div>
          )}

          {showRaw && rawView && (
            <section className="world-raw-section">
              <Kicker>Raw view · {rawView.path}</Kicker>
              <div data-testid="world-raw" className="world-raw">
                <JsonView json={rawView.json} label={`Raw JSON of ${rawView.path}`} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
