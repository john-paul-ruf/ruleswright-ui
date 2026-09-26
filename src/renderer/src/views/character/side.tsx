/** The side column (mocks/character.html): snapshots (FR-10) and the create form (FR-6). */
import { useState } from 'react';
import type { Pack } from '../../engine/schema';
import { useCharacterStore } from '../../store/character';
import { Button, ConfirmDialog, ErrorCard, Field, Input, Panel, Select, SnapshotCard } from '../../ui';

/** FR-10: named snapshots of this world; each card shows its pack identity verbatim (B-3, D-20). */
export function SnapshotsPanel(): JSX.Element {
  const snapshots = useCharacterStore((s) => s.snapshots);
  const hasCharacter = useCharacterStore((s) => s.character !== null);
  const error = useCharacterStore((s) => s.errors.snapshots);
  const save = useCharacterStore((s) => s.saveSnapshot);
  const load = useCharacterStore((s) => s.loadSnapshot);
  const remove = useCharacterStore((s) => s.deleteSnapshot);
  const [name, setName] = useState('');
  const [doomed, setDoomed] = useState<string | null>(null);

  async function onSave(): Promise<void> {
    if (await save(name.trim())) setName('');
  }

  return (
    <Panel kicker="Snapshots">
      <div className="char-stack">
        {snapshots.map((s) => (
          <SnapshotCard
            key={s.name}
            name={s.name}
            meta={s.createdAt}
            identity={
              <span data-testid={`char-snapshot-pack-${s.name}`}>
                pack {s.packIdentity.id} · schema {s.packIdentity.schemaVersion} · {s.packIdentity.contentHash}
              </span>
            }
            actions={
              <>
                <Button size="s" data-testid={`char-snapshot-load-${s.name}`} onClick={() => void load(s.name)}>
                  Restore
                </Button>
                <Button size="s" variant="danger" data-testid={`char-snapshot-delete-${s.name}`} onClick={() => setDoomed(s.name)}>
                  Delete
                </Button>
              </>
            }
          />
        ))}
        {snapshots.length === 0 && <p className="text-12 dim">No snapshots in this world yet.</p>}
      </div>

      <Field label="Snapshot name" className="char-gap">
        <Input
          data-testid="char-snapshot-name"
          placeholder="pre-combat"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!hasCharacter}
        />
      </Field>
      <Button
        variant="primary"
        className="char-full char-gap"
        data-testid="char-snapshot-save"
        disabled={!hasCharacter || name.trim() === ''}
        onClick={() => void onSave()}
      >
        Save snapshot
      </Button>
      <p className="mono char-note">
        each card shows its pack identity (id · schemaVersion · contentHash, verbatim); restore checks it — mismatched
        packs are rejected loudly (FR-10)
      </p>
      {error && <ErrorCard className="char-gap" error={error} />}

      <ConfirmDialog
        open={doomed !== null}
        tone="danger"
        title={`Delete snapshot “${doomed ?? ''}”?`}
        message="The snapshot file is removed from this world."
        confirmLabel="Delete"
        onCancel={() => setDoomed(null)}
        onConfirm={() => {
          if (doomed !== null) void remove(doomed);
          setDoomed(null);
        }}
      />
    </Panel>
  );
}

/** FR-6: create through the library; the build validator's cards show live; replacing confirms first. */
export function CreatePanel({ pack }: { pack: Pack }): JSX.Element {
  const current = useCharacterStore((s) => s.view?.state.name ?? null);
  const createError = useCharacterStore((s) => s.errors.create);
  const checkBuild = useCharacterStore((s) => s.checkBuild);
  const create = useCharacterStore((s) => s.create);
  const races = Object.entries(pack.content.races ?? {});
  const classes = Object.entries(pack.content.classes ?? {});
  const [name, setName] = useState('');
  const [race, setRace] = useState(races[0]?.[0] ?? '');
  const [cls, setCls] = useState(classes[0]?.[0] ?? '');
  const [level, setLevel] = useState('1');
  const [confirming, setConfirming] = useState(false);

  const entries = [{ id: cls, level: Number(level) }];
  const live = checkBuild(race, entries);
  const submit = () => {
    if (create({ name: name.trim(), race, classes: entries })) setName('');
  };

  return (
    <Panel kicker="Create a new character">
      <div className="char-stack">
        <Field label="Name">
          <Input data-testid="char-name" placeholder="Brynn" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Race">
          <Select data-testid="char-race" value={race} onChange={(e) => setRace(e.target.value)}>
            {races.map(([id, def]) => (
              <option key={id} value={id}>
                {def.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="field">
          <span className="kicker">Class + level</span>
          <div className="char-inline char-nowrap">
            <Select aria-label="Class" data-testid="char-class" value={cls} onChange={(e) => setCls(e.target.value)}>
              {classes.map(([id, def]) => (
                <option key={id} value={id}>
                  {def.name}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Level"
              className="mono char-num"
              type="number"
              data-testid="char-level"
              invalid={live.length > 0}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
          </div>
        </div>
        <Button
          variant="primary"
          className="char-full"
          data-testid="char-create"
          disabled={name.trim() === ''}
          onClick={() => (current === null ? submit() : setConfirming(true))}
        >
          Create via library
        </Button>
        <p className="text-12 dim">
          World holds exactly one character (v1).
          {current !== null && ` Creating clears ${current} — after confirmation (FR-6).`}
        </p>
        {live.length > 0 ? (
          <ErrorCard error={{ kind: 'library', operation: 'character:create', name: 'validateBuild', message: '', cards: live }} />
        ) : (
          createError && <ErrorCard error={createError} />
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Replace ${current ?? 'the character'}?`}
        message={`Creating ${name.trim()} clears ${current ?? 'the current character'}. Unsaved progress is lost; snapshots stay.`}
        confirmLabel="Create"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          submit();
        }}
      />
    </Panel>
  );
}
