/** The Fight determinism strip (FR-14, mocks/fight.html): rerun same seed (read-only reuse of store/determinism). */
import { useDeterminismStore } from '../../store/determinism';
import { useWorldsStore } from '../../store/worlds';
import { RecordsPanel } from './records';
import { Button, DeterminismStrip, ErrorCard, Panel, Panel2 } from '../../ui';

function RerunStrip(): JSX.Element {
  const worldId = useWorldsStore((s) => s.active?.meta.id ?? null);
  const state = useDeterminismStore((s) => (worldId === null ? undefined : s.byWorld[worldId]));
  const rerun = useDeterminismStore((s) => s.rerun);
  const running = state === 'running';
  const action = (
    <Button data-testid="fight-rerun" disabled={running} onClick={() => void rerun()}>
      ⟳ Rerun same seed
    </Button>
  );
  const common = { 'data-testid': 'fight-determinism', role: 'status', 'aria-live': 'polite', action } as const;

  if (state === undefined || running) {
    return (
      <DeterminismStrip
        {...common}
        aria-busy={running}
        state="idle"
        title={running ? 'Rerun same seed — running…' : 'Rerun same seed'}
        detail="regenerates from the stored theme + seed + knobs and compares the bytes with the stored pack"
      />
    );
  }
  switch (state.status) {
    case 'pass':
      return (
        <DeterminismStrip
          {...common}
          state="pass"
          title="Rerun same seed — verified"
          detail={`byte-identical · ${state.bytes} bytes · regenerated from theme+seed+knobs`}
        />
      );
    case 'fail':
      return (
        <DeterminismStrip
          {...common}
          state="fail"
          title="Rerun same seed — bytes differ"
          detail={`first difference at char ${state.offset} · stored ${state.storedLength} chars · rerun ${state.rerunLength} chars`}
        />
      );
    case 'unavailable':
      return <DeterminismStrip {...common} state="unavailable" title="Rerun same seed — unavailable" detail={state.reason} />;
    default:
      return <DeterminismStrip {...common} state="fail" title="Rerun same seed — error" detail={<ErrorCard error={state.error} />} />;
  }
}

/** FR-14: rerun (pack bytes) beside replay (recorded fights). */
export function DeterminismPanel(): JSX.Element {
  return (
    <Panel kicker="Determinism">
      <div className="fight-determinism">
        <RerunStrip />
        <Panel2 pad="s">
          <p className="row-title">Replay a recorded fight</p>
          <p className="fight-note">
            A record stores the fight&apos;s start and every host call; replay re-applies them to a fresh fight in the re-rolled
            pack. Any divergence is flagged in the log instead of silently continuing (FR-14).
          </p>
          <RecordsPanel />
        </Panel2>
      </div>
    </Panel>
  );
}
