/** FR-5 import: paste box + native file pick; rejections render verbatim under the paste box. */
import { useId, useState } from 'react';
import { useUiStore } from '../../store/ui';
import { useWorldsStore } from '../../store/worlds';
import { Button, ErrorCard, Kicker, Panel } from '../../ui';

export function ImportPanel(): JSX.Element {
  const importFromText = useWorldsStore((s) => s.importFromText);
  const importFromFile = useWorldsStore((s) => s.importFromFile);
  const importError = useWorldsStore((s) => s.importError);
  const busy = useWorldsStore((s) => s.busy);
  const navigate = useUiStore((s) => s.navigate);
  const [text, setText] = useState('');
  const titleId = useId();
  const pasteId = useId();

  async function submitPaste(): Promise<void> {
    // The paste stays editable on failure; it is cleared once it became a world.
    if (await importFromText(text)) {
      setText('');
      navigate('world');
    }
  }

  async function chooseFile(): Promise<void> {
    if ((await importFromFile()) === true) navigate('world');
  }

  return (
    <Panel pad="l" className="import-panel" aria-labelledby={titleId}>
      <Kicker>Pack I/O</Kicker>
      <h3 id={titleId} className="display import-title">
        Import a pack
      </h3>
      <p className="roll-note">Validated before it becomes a world. Packs made by node scripts land here unchanged.</p>
      <label className="visually-hidden" htmlFor={pasteId}>
        Paste pack JSON
      </label>
      <textarea
        id={pasteId}
        className="input import-paste"
        data-testid="import-paste"
        placeholder="Paste JSON…"
        spellCheck={false}
        value={text}
        aria-invalid={importError !== null || undefined}
        onChange={(e) => setText(e.target.value)}
      />
      {importError && <ErrorCard className="import-error" error={importError} />}
      <div className="row-actions import-actions">
        <Button data-testid="import-paste-submit" disabled={busy || text.trim() === ''} onClick={() => void submitPaste()}>
          Import pasted JSON
        </Button>
        <Button data-testid="import-file" disabled={busy} onClick={() => void chooseFile()}>
          Choose JSON file…
        </Button>
      </div>
    </Panel>
  );
}
