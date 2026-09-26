/** FR-2 forge: library theme cards, seed + user-initiated randomize, knobs from the theme's declarations. */
import { useId, useState } from 'react';
import type { Knobs } from '../../../../shared/model';
import type { KnobSpec, ThemeInfo } from '../../engine/compiler';
import { moodForTheme } from '../../moods/map';
import { useUiStore } from '../../store/ui';
import { useWorldsStore } from '../../store/worlds';
import { Button, ErrorCard, Input, Panel, Select, ThemeCard } from '../../ui';
import { MOOD_GLYPH } from './glyphs';

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

/** The declaration line, verbatim from the theme's knob spec. */
function declLine(knob: KnobSpec): string {
  const shape = knob.type === 'enum' ? `enum ${(knob.values ?? []).join('|')}` : `range ${knob.min}–${knob.max}`;
  return `decl: ${shape} · default ${knob.default}`;
}

function KnobRow(props: { knob: KnobSpec; value: string; onChange: (v: string) => void }): JSX.Element {
  const { knob, value, onChange } = props;
  const id = useId();
  const control = {
    id,
    className: 'knob-control',
    'data-testid': `roll-knob-${knob.id}`,
    'aria-describedby': `${id}-desc`,
    value,
  };
  return (
    <div className="knob">
      <div className="knob-text">
        <label className="knob-label" htmlFor={id}>
          {knob.id}
        </label>
        <span className="mono knob-decl">{declLine(knob)}</span>
        <span id={`${id}-desc`} className="knob-desc">
          {knob.desc}
        </span>
      </div>
      {knob.type === 'enum' ? (
        <Select {...control} onChange={(e) => onChange(e.target.value)}>
          {(knob.values ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </Select>
      ) : (
        <Input {...control} type="number" min={knob.min} max={knob.max} step={1} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function ForgeForm(): JSX.Element {
  const themes = useWorldsStore((s) => s.themes);
  const busy = useWorldsStore((s) => s.busy);
  const forgeError = useWorldsStore((s) => s.forgeError);
  const forgeMs = useWorldsStore((s) => s.forgeMs);
  const forge = useWorldsStore((s) => s.forge);
  const navigate = useUiStore((s) => s.navigate);

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
    <section className="roll-section-forge" aria-labelledby="roll-forge-title">
      <h2 id="roll-forge-title" className="display roll-h2">
        Roll a new world
      </h2>

      <div className="roll-grid-2" role="group" aria-label="Theme">
        {themes.map((t) => {
          const mood = moodForTheme(t.id);
          return (
            <ThemeCard
              key={t.id}
              data-testid={`roll-theme-${t.id}`}
              glyph={MOOD_GLYPH[mood]}
              mood={mood}
              title={t.title}
              description={<span className="mono">{t.id}</span>}
              selected={t.id === themeId}
              onClick={() => selectTheme(t)}
            />
          );
        })}
      </div>

      <div className="roll-grid-2">
        <Panel kicker="Seed">
          <div className="seed-row">
            <Input
              data-testid="roll-seed"
              aria-label="Seed"
              type="number"
              step={1}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
            <Button data-testid="roll-seed-randomize" onClick={randomizeSeed}>
              <span aria-hidden="true">⟳</span> Randomize
            </Button>
          </div>
          <p className="roll-note">
            Randomize is a user pick, made before the engine is ever called. The seed drives the world and every roll in it.
          </p>
        </Panel>

        <Panel kicker="Knobs · rendered from the theme's declarations">
          {theme ? (
            theme.knobs.map((k) => (
              <KnobRow
                key={k.id}
                knob={k}
                value={knobInputs[k.id] ?? ''}
                onChange={(v) => setKnobInputs((prev) => ({ ...prev, [k.id]: v }))}
              />
            ))
          ) : (
            <p className="roll-note">Pick a theme to see its knobs.</p>
          )}
          {forgeError && (
            <div className="knob-error" data-testid="roll-error" role="alert">
              <ErrorCard error={forgeError} />
            </div>
          )}
        </Panel>
      </div>

      <div className="forge-row">
        <Button
          variant="primary"
          className="forge-button"
          data-testid="roll-forge"
          disabled={!canForge}
          aria-busy={busy || undefined}
          onClick={async () => {
            if (!theme) return;
            // Design flow 1: a validated forge opens the new world on the World surface.
            if (await forge({ themeId: theme.id, seed: seedNumber, knobs: toKnobs(theme, knobInputs) })) navigate('world');
          }}
        >
          {busy ? 'Forging…' : 'Forge the world →'}
        </Button>
        <span className="roll-note">
          {forgeMs !== null && !forgeError ? `generated in ${forgeMs.toFixed(1)} ms · ` : ''}validated before it opens
        </span>
      </div>
    </section>
  );
}
