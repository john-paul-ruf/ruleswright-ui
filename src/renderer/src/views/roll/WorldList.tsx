/** FR-3 world list: open, inline rename, cascade delete with named counts, corrupt + skipped display. */
import { useRef, useState, type KeyboardEvent } from 'react';
import type { WorldMeta } from '../../../../shared/model';
import type { AppError } from '../../engine/errors';
import { moodForTheme } from '../../moods/map';
import { useWorldsStore, type DeleteCounts } from '../../store/worlds';
import { Button, Chip, ConfirmDialog, ErrorCard, Input, Kicker } from '../../ui';
import { MOOD_GLYPH } from './glyphs';

function paramsLabel(w: WorldMeta): string {
  return w.theme !== null && w.seed !== null ? `${w.theme} · ${w.seed}` : 'imported · seed unknown';
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

interface PendingDelete {
  world: WorldMeta;
  counts: DeleteCounts;
}

interface WorldRowProps {
  world: WorldMeta;
  isActive: boolean;
  /** Session verdict: the pack failed the gate (chip always shown). */
  corrupt: AppError | undefined;
  /** Show the verdict card: this row's open is the failure being reported now (one error card per screen). */
  showVerdict: boolean;
  /** A failure of this world's delete, reported after the confirm dialog closed. */
  deleteError: AppError | undefined;
  onAskDelete(world: WorldMeta): Promise<AppError | null>;
}

function WorldRow({ world, isActive, corrupt, showVerdict, deleteError, onAskDelete }: WorldRowProps): JSX.Element {
  const open = useWorldsStore((s) => s.open);
  const rename = useWorldsStore((s) => s.rename);
  const busy = useWorldsStore((s) => s.busy);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const renameButton = useRef<HTMLButtonElement>(null);

  function stopEditing(): void {
    setDraft(null);
    renameButton.current?.focus();
  }

  async function onRenameKey(e: KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (e.key === 'Escape') {
      setError(null);
      stopEditing();
    } else if (e.key === 'Enter' && draft !== null) {
      const failure = await rename(world.id, draft);
      setError(failure);
      if (!failure) stopEditing();
    }
  }

  const shownError = error ?? deleteError ?? (showVerdict ? corrupt : undefined);
  return (
    <article className="panel pad-s worldrow" data-testid="world-row" aria-current={isActive || undefined}>
      <div className="worldrow-top">
        <span className="worldrow-glyph" data-mood={moodForTheme(world.theme)} aria-hidden="true">
          {MOOD_GLYPH[moodForTheme(world.theme)]}
        </span>
        <span className="worldrow-chips">
          {isActive && <Chip tone="accent">last opened</Chip>}
          {corrupt && (
            <Chip tone="danger" data-testid="world-corrupt">
              corrupt
            </Chip>
          )}
        </span>
      </div>
      {draft === null ? (
        <h3 className="display worldrow-name">{world.name}</h3>
      ) : (
        <Input
          className="worldrow-rename"
          aria-label={`New name for ${world.name}`}
          value={draft}
          invalid={error !== null}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => void onRenameKey(e)}
        />
      )}
      <p>
        <Chip className="worldrow-params">{paramsLabel(world)}</Chip>
      </p>
      <p className="mono worldrow-data">
        schema {world.schemaVersion} · updated {world.updatedAt}
      </p>
      <div className="row-actions worldrow-actions">
        <Button variant={isActive ? 'primary' : 'ghost'} data-testid="world-open" disabled={busy} onClick={() => void open(world.id)}>
          Open
        </Button>
        <Button
          ref={renameButton}
          data-testid="world-rename"
          aria-expanded={draft !== null}
          onClick={() => {
            setError(null);
            if (draft === null) setDraft(world.name);
            else stopEditing();
          }}
        >
          Rename
        </Button>
        <Button
          variant="danger"
          data-testid="world-delete"
          onClick={() => void onAskDelete(world).then((failure) => setError(failure))}
        >
          Delete
        </Button>
      </div>
      {shownError && <ErrorCard className="worldrow-error" error={shownError} />}
    </article>
  );
}

/** FR-3: the saved worlds, the open (last-opened) one first, plus every document main skipped. */
export function WorldList(): JSX.Element {
  const worlds = useWorldsStore((s) => s.worlds);
  const skipped = useWorldsStore((s) => s.skipped);
  const corrupt = useWorldsStore((s) => s.corrupt);
  const activeId = useWorldsStore((s) => s.active?.meta.id ?? null);
  const openError = useWorldsStore((s) => s.openError);
  const deleteCounts = useWorldsStore((s) => s.deleteCounts);
  const remove = useWorldsStore((s) => s.remove);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [deleteError, setDeleteError] = useState<{ worldId: string; error: AppError } | null>(null);

  const ordered = [...worlds.filter((w) => w.id === activeId), ...worlds.filter((w) => w.id !== activeId)];
  // An open failure already shown on its corrupt row is not repeated here.
  const standaloneError = openError && !Object.values(corrupt).includes(openError) ? openError : null;

  async function askDelete(world: WorldMeta): Promise<AppError | null> {
    const counts = await deleteCounts(world.id);
    if ('kind' in counts) return counts;
    setDeleteError(null);
    setPending({ world, counts });
    return null;
  }

  async function confirmDelete(): Promise<void> {
    if (!pending) return;
    const { world } = pending;
    setPending(null);
    const failure = await remove(world.id);
    if (failure) setDeleteError({ worldId: world.id, error: failure });
  }

  return (
    <section className="roll-section" aria-labelledby="roll-worlds-title">
      <div className="roll-head">
        <h2 id="roll-worlds-title" className="display roll-h2">
          Your worlds
        </h2>
        <Kicker>{worlds.length} saved · app user-data dir</Kicker>
      </div>
      {standaloneError && <ErrorCard className="roll-standalone-error" error={standaloneError} />}
      {worlds.length === 0 ? (
        <p className="roll-note">No world yet — Roll one, or import a pack.</p>
      ) : (
        <div className="roll-grid-3">
          {ordered.map((w) => (
            <WorldRow
              key={w.id}
              world={w}
              isActive={w.id === activeId}
              corrupt={corrupt[w.id]}
              showVerdict={openError !== null && corrupt[w.id] === openError}
              deleteError={deleteError?.worldId === w.id ? deleteError.error : undefined}
              onAskDelete={askDelete}
            />
          ))}
        </div>
      )}
      {skipped.length > 0 && (
        <ul className="skipped-list" aria-label="Skipped documents">
          {skipped.map((s) => (
            <li key={s.location} className="skipped-line">
              <Chip tone="danger">skipped</Chip>
              <span className="mono">
                {s.location} — {s.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pending !== null}
        title={`Delete ${pending?.world.name ?? ''}?`}
        message={
          pending ?
          `This also removes ${plural(pending.counts.snapshots, 'snapshot', 'snapshots')} and ${plural(
            pending.counts.fights,
            'fight record',
            'fight records',
          )}.`
          : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
