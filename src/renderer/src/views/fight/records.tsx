/**
 * Fight records (FR-14b, B-3), per the record rows of mocks/fight.html and mocks/combat.html: each row shows
 * the stored `combat.rng` words, and Replay re-applies the record's script, flagging the first divergent event.
 * On Fight only (design "Resume action (CX)"), Resume continues a record in Combat when every event matches.
 */
import { useEffect, useState } from 'react';
import type { FightRecordMeta } from '../../../../shared/model';
import { useCombatStore, type RuntimeEvent } from '../../store/combat';
import { useUiStore } from '../../store/ui';
import { Button, Chip, DeterminismStrip, ErrorCard, Field, Input, RecordRow } from '../../ui';
import { LogRow } from '../combat/log';
import './fight.css';

export const RECORD_NAME_INPUT = 'record-name-input';

/** B-3 / CA-06: the four stored uint32 words as 8-digit lowercase hex (display only, never recomputed). */
function rngLine(rng: unknown): string {
  const words = rng as Record<'a' | 'b' | 'c' | 'd', unknown> | null;
  const hex = (w: unknown) => (typeof w === 'number' ? (w >>> 0).toString(16).padStart(8, '0') : '—');
  return words === null || typeof words !== 'object' ? 'rng —' : `rng a:${hex(words.a)} b:${hex(words.b)} c:${hex(words.c)} d:${hex(words.d)}`;
}

function metaLine(r: FightRecordMeta): string {
  if (r.eventCount === null) return `no replay script (legacy record) · ${r.createdAt}`;
  return `round ${r.round ?? '—'} · ${r.eventCount} events · ${r.createdAt}`;
}

function RecordForm(): JSX.Element {
  const record = useCombatStore((s) => s.record);
  const hasFight = useCombatStore((s) => s.fight !== null);
  const [name, setName] = useState('');

  async function onRecord(): Promise<void> {
    if (await record(name.trim())) setName('');
  }

  return (
    <div className="records-form">
      <Field label="Record name" className="fight-grow">
        <Input id={RECORD_NAME_INPUT} data-testid="combat-record-name" placeholder="barrow-watch-1" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button data-testid="combat-record" disabled={!hasFight || name.trim() === ''} onClick={() => void onRecord()}>
        Record this fight
      </Button>
    </div>
  );
}

function ReplayResultView(): JSX.Element | null {
  const replayed = useCombatStore((s) => s.replayed);
  if (!replayed) return null;
  const { name, result, events } = replayed;
  const common = { 'data-testid': 'fight-replay-status', 'data-status': result.status, role: 'status', 'aria-live': 'polite' } as const;
  let strip: JSX.Element;
  let flagged = -1;
  switch (result.status) {
    case 'complete':
      strip = <DeterminismStrip {...common} state="pass" title={`Replay of ${name} — complete`} detail={`every one of ${events.length} events matches the record`} />;
      break;
    case 'unavailable':
      strip = <DeterminismStrip {...common} state="unavailable" title={`Replay of ${name} — unavailable`} detail={result.reason} />;
      break;
    case 'error':
      strip = <DeterminismStrip {...common} state="fail" title={`Replay of ${name} — error`} detail={<ErrorCard error={result.error} />} />;
      break;
    default:
      if (result.stage === 'pack') {
        strip = (
          <DeterminismStrip
            {...common}
            state="fail"
            title={`Replay of ${name} — diverged at stage pack`}
            detail="the re-rolled pack's bytes differ from the stored pack; no combat was run"
          />
        );
      } else {
        flagged = result.index;
        strip = (
          <DeterminismStrip
            {...common}
            state="fail"
            title={`Replay of ${name} — diverged at event ${result.index}`}
            detail={`recorded ${result.expected?.type ?? 'no event'} · replayed ${result.actual?.type ?? 'no event'}`}
          />
        );
      }
  }
  const missing: RuntimeEvent | undefined = flagged >= events.length && result.status === 'diverged' && result.stage === 'events' ? result.expected : undefined;
  return (
    <div className="records-replay">
      {strip}
      {events.length > 0 && (
        <div className="records-scroll" role="log" aria-label={`Replayed events of ${name}`} tabIndex={0}>
          {events.map((event, i) => (
            <LogRow key={i} event={event} flagged={i === flagged} data-testid={i === flagged ? 'fight-replay-divergence' : 'fight-replay-event'} />
          ))}
          {missing && <LogRow event={missing} flagged data-testid="fight-replay-divergence" />}
        </div>
      )}
    </div>
  );
}

/** FR-14 resume refused (design "Resume action (CX)"): a status line under the row's actions, like a diverged replay. */
function ResumeRefusal({ name }: { name: string }): JSX.Element | null {
  const resumed = useCombatStore((s) => (s.resumed?.name === name ? s.resumed.result : null));
  if (!resumed) return null;
  let detail: JSX.Element;
  if (resumed.status === 'diverged') detail = <span className="mono row-data">first divergence at event {resumed.index}</span>;
  else if (resumed.status === 'unavailable') detail = <span className="mono row-data">{resumed.reason}</span>;
  else detail = <ErrorCard error={resumed.error} className="resume-status-error" />;
  return (
    <div className="resume-status" data-testid="fight-resume-status" data-status={resumed.status} role="status" aria-live="polite">
      <Chip tone="danger">resume refused</Chip>
      {detail}
    </div>
  );
}

/** The records list (+ the record form on the Combat surface) and the latest replay; Resume only off Combat. */
export function RecordsPanel({ recordable = false }: { recordable?: boolean }): JSX.Element {
  const records = useCombatStore((s) => s.records);
  const error = useCombatStore((s) => s.recordsError);
  const refresh = useCombatStore((s) => s.refreshRecords);
  const replay = useCombatStore((s) => s.replay);
  const resume = useCombatStore((s) => s.resume);
  const navigate = useUiStore((s) => s.navigate);

  async function onResume(name: string): Promise<void> {
    if (await resume(name)) navigate('combat');
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="records" data-testid="fight-records">
      {recordable && <RecordForm />}
      {error && <ErrorCard error={error} />}
      <div className="records-list">
        {records.map((r) => (
          <RecordRow
            key={r.name}
            data-testid={`fight-record-${r.name}`}
            name={r.name}
            status={r.outcome}
            meta={metaLine(r)}
            rng={<span data-testid={`fight-record-rng-${r.name}`}>{rngLine(r.rng)}</span>}
            actions={
              <>
                <Button size="s" data-testid={`fight-replay-${r.name}`} onClick={() => void replay(r.name)}>
                  Replay
                </Button>
                {!recordable && (
                  <>
                    <Button size="s" data-testid={`fight-resume-${r.name}`} onClick={() => void onResume(r.name)}>
                      Resume
                    </Button>
                    <ResumeRefusal name={r.name} />
                  </>
                )}
              </>
            }
          />
        ))}
        {records.length === 0 && <p className="text-12 dim">No recorded fights in this world yet.</p>}
      </div>
      <p className="mono fight-note">rng = the record&apos;s stored combat.rng &#123;a,b,c,d&#125;, four uint32 words as 8-digit lowercase hex (FR-14)</p>
      {!recordable && (
        <p className="fight-note">
          Resume re-applies the record&apos;s script, repositions included, on the stored pack; play continues only when every re-applied
          event matches the record.
        </p>
      )}
      <ReplayResultView />
    </div>
  );
}
