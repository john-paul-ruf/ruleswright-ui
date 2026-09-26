/**
 * Roll surface, minimal functional form (FR-2/3). SESSION-03 crafts the visual design;
 * the `data-testid`s here are the stable e2e contract (PROGRAM-CONFIG Conventions).
 */
import { useState } from 'react';
import type { KnobSpec, ThemeInfo } from '../../engine/compiler';
import type { AppError } from '../../engine/errors';
import { useWorldsStore } from '../../store/worlds';
import type { Knobs, WorldMeta } from '../../../../shared/model';

type KnobInputs = Record<string, string>;

function defaultInputs(theme: ThemeInfo | undefined): KnobInputs {
  return Object.fromEntries((theme?.knobs ?? []).map((k) => [k.id, String(k.default)]));
}

/** Range knobs are sent as numbers, enum knobs as strings; the library judges the values. */
function toKnobs(theme: ThemeInfo, inputs: KnobInputs): Knobs {
  return Object.fromEntries(
    theme.knobs.map((k) => [k.id, k.type === 'range' ? Number(inputs[k.id]) : (inputs[k.id] ?? '')]),
  );
}

function paramsLabel(w: WorldMeta): string {
  return w.theme !== null && w.seed !== null ? `${w.theme} · ${w.seed}` : 'parameters unknown';
}

function ErrorDetails({ error }: { error: AppError }): JSX.Element {
  if (error.kind !== 'library') return <p>{error.message}</p>;
  return (
    <ul>
      {error.cards.map((card, i) => (
        <li key={i}>
          <strong>{card.rule}</strong> <code>{card.jsonPath}</code> {card.message}
          {card.hint !== undefined && <em> {card.hint}</em>}
        </li>
      ))}
    </ul>
  );
}

function KnobControl(props: { knob: KnobSpec; value: string; onChange: (v: string) => void }): JSX.Element {
  const { knob, value, onChange } = props;
  return (
    <label>
      {knob.id}{' '}
      {knob.type === 'enum' ? (
        <select data-testid={`roll-knob-${knob.id}`} value={value} onChange={(e) => onChange(e.target.value)}>
          {(knob.values ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <input
          data-testid={`roll-knob-${knob.id}`}
          type="number"
          min={knob.min}
          max={knob.max}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}{' '}
      <small>{knob.desc}</small>
    </label>
  );
}

/** FR-2 forge form + FR-3 world list. */
export function RollView(): JSX.Element {
  const themes = useWorldsStore((s) => s.themes);
  const worlds = useWorldsStore((s) => s.worlds);
  const active = useWorldsStore((s) => s.active);
  const corrupt = useWorldsStore((s) => s.corrupt);
  const busy = useWorldsStore((s) => s.busy);
  const forgeError = useWorldsStore((s) => s.forgeError);
  const openError = useWorldsStore((s) => s.openError);
  const forge = useWorldsStore((s) => s.forge);
  const open = useWorldsStore((s) => s.open);

  const [themeId, setThemeId] = useState<string | null>(null);
  const [seed, setSeed] = useState('');
  const [knobInputs, setKnobInputs] = useState<KnobInputs>({});

  const theme = themes.find((t) => t.id === themeId);
  const seedNumber = Number(seed);
  const canForge = theme !== undefined && seed.trim() !== '' && Number.isSafeInteger(seedNumber) && !busy;

  function selectTheme(t: ThemeInfo): void {
    setThemeId(t.id);
    setKnobInputs(defaultInputs(t));
  }

  function randomizeSeed(): void {
    // The one user-initiated randomness in the app (Custom Rule 3).
    setSeed(String(crypto.getRandomValues(new Uint32Array(1))[0]));
  }

  return (
    <section>
      <header>
        {active ? (
          <p>
            <span data-testid="active-world-name">{active.meta.name}</span>{' '}
            <span data-testid="active-world-seed">{paramsLabel(active.meta)}</span>
          </p>
        ) : (
          <p>No world open.</p>
        )}
      </header>

      <h2>Roll a world</h2>
      <div role="group" aria-label="Theme">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`roll-theme-${t.id}`}
            aria-pressed={t.id === themeId}
            onClick={() => selectTheme(t)}
          >
            {t.title} ({t.id})
          </button>
        ))}
      </div>
      <label>
        Seed{' '}
        <input data-testid="roll-seed" type="number" step={1} value={seed} onChange={(e) => setSeed(e.target.value)} />
      </label>
      <button type="button" data-testid="roll-seed-randomize" onClick={randomizeSeed}>
        Random seed
      </button>
      {theme?.knobs.map((k) => (
        <div key={k.id}>
          <KnobControl
            knob={k}
            value={knobInputs[k.id] ?? ''}
            onChange={(v) => setKnobInputs((prev) => ({ ...prev, [k.id]: v }))}
          />
        </div>
      ))}
      <button
        type="button"
        data-testid="roll-forge"
        disabled={!canForge}
        onClick={() => {
          if (theme) void forge({ themeId: theme.id, seed: seedNumber, knobs: toKnobs(theme, knobInputs) });
        }}
      >
        Forge
      </button>
      {forgeError && (
        <div data-testid="roll-error" role="alert">
          <ErrorDetails error={forgeError} />
        </div>
      )}

      <h2>Worlds</h2>
      {openError && (
        <div role="alert">
          <ErrorDetails error={openError} />
        </div>
      )}
      <ul>
        {worlds.map((w) => (
          <li key={w.id} data-testid="world-row">
            {w.name} <span>{paramsLabel(w)}</span>{' '}
            {corrupt[w.id] && <span data-testid="world-corrupt">corrupt</span>}{' '}
            <button type="button" data-testid="world-open" onClick={() => void open(w.id)}>
              Open
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
