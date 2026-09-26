/** The character sheet column (mocks/character.html): derived stats, pools & spells, conditions, progression. */
import { useState } from 'react';
import type { CharacterView } from '../../engine/runtime';
import type { Pack } from '../../engine/schema';
import { useCharacterStore } from '../../store/character';
import { Button, Chip, EmptyWell, ErrorCard, Input, Panel, Panel2, ProgressBar, Select, StatNumeral } from '../../ui';

interface SheetProps {
  view: CharacterView;
  pack: Pack;
}

/** Pack data shown as-is: `{vancian: 1}` → `vancian 1`. */
function costLine(cost: object): string {
  return Object.entries(cost)
    .map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

/** FR-6: hp/ac and saves, straight from `character.derived()`; the formulas are the pack's text. */
export function DerivedPanel({ view, pack }: SheetProps): JSX.Element {
  const { derived } = view;
  const formula = (id: string) => pack.formulas[id]?.expr;
  return (
    <Panel kicker="Derived · resolved through the pack's own formulas">
      <div className="char-derived">
        <StatNumeral value={<span data-testid="char-hp">{derived.hp}</span>} label="hp" />
        <StatNumeral value={<span data-testid="char-ac">{derived.ac}</span>} label="ac" />
        <ul className="char-saves" aria-label="Saves" data-testid="char-saves">
          {Object.entries(derived.saves).map(([save, v]) => (
            <li key={save} className="display char-save">
              {save} {v}
            </li>
          ))}
        </ul>
      </div>
      <p className="mono char-note">
        {['hp', 'ac']
          .filter((id) => formula(id) !== undefined)
          .map((id) => `${id} = ${formula(id)}`)
          .join(' · ')}
      </p>
    </Panel>
  );
}

function PoolRow({ pool, value, atRest }: { pool: string; value: number; atRest: number | undefined }): JSX.Element {
  const spend = useCharacterStore((s) => s.spend);
  const [amount, setAmount] = useState('1');
  return (
    <div className="char-pool">
      <div className="char-pool-head">
        <span className="row-title">{pool}</span>
        <span className="mono char-pool-value" data-testid={`char-pool-${pool}`}>
          {atRest === undefined ? value : `${value} / ${atRest} at rest`}
        </span>
      </div>
      <ProgressBar value={value} max={atRest ?? value} label={pool} />
      <div className="char-inline">
        <Input
          className="mono char-num"
          type="number"
          aria-label={`${pool} points to spend`}
          data-testid={`char-spend-amount-${pool}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button size="s" data-testid={`char-spend-${pool}`} onClick={() => spend(pool, Number(amount))}>
          Spend
        </Button>
      </div>
    </div>
  );
}

/** FR-8/9: pools (value over the "at rest" reference), known spells, slots; rejections verbatim. */
export function PoolsSpellsPanel({ view, pack }: SheetProps): JSX.Element {
  const poolsAtRest = useCharacterStore((s) => s.poolsAtRest);
  const error = useCharacterStore((s) => s.errors.pools ?? s.errors.spells);
  const rest = useCharacterStore((s) => s.rest);
  const prepare = useCharacterStore((s) => s.prepare);
  const cast = useCharacterStore((s) => s.cast);
  const { state, pools, known, restrictedSpells } = view;
  const bound = new Set(Object.values(state.slots).flat());
  const slotLevels = Object.entries(state.slots);

  return (
    <Panel
      kicker="Pools & spells"
      aside={
        <Button data-testid="char-rest" onClick={rest}>
          Rest <span className="mono text-10">replenishes all</span>
        </Button>
      }
    >
      <div className="char-stack">
        {pools.map((p) => (
          <PoolRow key={p} pool={p} value={state.pools[p] ?? 0} atRest={poolsAtRest[p]} />
        ))}
      </div>

      {known.length === 0 ? (
        <EmptyWell
          className="char-gap"
          data-testid="char-spells-empty"
          title="No known spells"
          message="This pack gives the character's classes no spell list — nothing to prepare or cast."
        />
      ) : (
        <>
          {slotLevels.length > 0 && (
            <div className="char-slots" data-testid="char-slots">
              {slotLevels.map(([level, slots]) => (
                <div key={level} className="char-inline">
                  <span className="kicker">level {level} slots</span>
                  {slots.map((id, i) => (
                    <Chip key={i} tone={id === null ? 'default' : 'accent'} className="mono" data-testid={`char-slot-${level}-${i}`}>
                      {id ?? 'empty'}
                    </Chip>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="char-spells">
            {known.map((id) => {
              const spell = pack.content.spells?.[id];
              const prepared = bound.has(id);
              return (
                <Panel2 key={id} pad="none" className="char-spell" data-testid={`char-spell-${id}`}>
                  <div className="char-spell-head">
                    <p className="row-title">{spell?.name ?? id}</p>
                    <Chip tone={prepared ? 'accent' : 'default'}>{prepared ? 'prepared' : 'known'}</Chip>
                  </div>
                  <p className="mono row-data">
                    {id}
                    {spell && ` · spell ${spell.magic.level} · cost ${costLine(spell.cost)}`}
                    {restrictedSpells.includes(id) && ' · restricted'}
                  </p>
                  <div className="row-actions">
                    <Button size="s" variant="primary" data-testid={`char-cast-${id}`} onClick={() => cast(id)}>
                      Cast
                    </Button>
                    <Button size="s" data-testid={`char-prepare-${id}`} onClick={() => prepare(id)}>
                      Prepare
                    </Button>
                  </div>
                </Panel2>
              );
            })}
          </div>
        </>
      )}

      {error && <ErrorCard className="char-gap" error={error} />}
    </Panel>
  );
}

/** FR-7: pack conditions, active durations, explicit ticks, and the restricted ids they cause. */
export function ConditionsPanel({ view, pack }: SheetProps): JSX.Element {
  const error = useCharacterStore((s) => s.errors.conditions);
  const apply = useCharacterStore((s) => s.apply);
  const remove = useCharacterStore((s) => s.remove);
  const tick = useCharacterStore((s) => s.tick);
  const catalog = Object.entries(pack.content.conditions ?? {});
  const [picked, setPicked] = useState(catalog[0]?.[0] ?? '');

  const active = new Map<string, number[]>();
  for (const c of view.state.conditions) active.set(c.conditionId, [...(active.get(c.conditionId) ?? []), c.duration]);

  return (
    <Panel kicker="Conditions" aside={<span className="text-12 dim">available list comes from the pack</span>}>
      <div className="char-stack">
        {[...active].map(([id, durations]) => {
          const def = pack.content.conditions?.[id];
          return (
            <Panel2 key={id} pad="none" className="char-condition">
              <div>
                <p className="row-title">
                  {def?.name ?? id}{' '}
                  <Chip tone="danger" data-testid={`char-condition-${id}`}>
                    {durations.join(' · ')} ticks left
                  </Chip>
                </p>
                <p className="mono row-data">restricts: {def?.restricts?.join(', ') || '—'}</p>
              </div>
              <Button size="s" variant="danger" data-testid={`char-remove-${id}`} onClick={() => remove(id)}>
                Remove
              </Button>
            </Panel2>
          );
        })}
        {active.size === 0 && <p className="text-12 dim">No active conditions.</p>}
      </div>

      <div className="char-inline char-gap">
        <Select
          className="char-grow"
          aria-label="Condition"
          data-testid="char-condition-select"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        >
          {catalog.map(([id, def]) => (
            <option key={id} value={id}>
              {def.name} · {def.duration} ticks
            </option>
          ))}
        </Select>
        <Button data-testid="char-apply-condition" disabled={picked === ''} onClick={() => apply(picked)}>
          + Apply condition
        </Button>
        <Button data-testid="char-tick" onClick={tick}>
          Tick −1
        </Button>
      </div>

      <dl className="mono char-restricted">
        <dt className="kicker">restricted actions</dt>
        <dd data-testid="char-restricted-actions">{view.restrictedActions.join(', ') || '—'}</dd>
        <dt className="kicker">restricted spells</dt>
        <dd data-testid="char-restricted-spells">{view.restrictedSpells.join(', ') || '—'}</dd>
      </dl>

      {error && <ErrorCard className="char-gap" error={error} />}
    </Panel>
  );
}

/** FR-6: host-awarded XP and direct level-set, both judged by the library. */
export function ProgressionPanel({ view, pack }: SheetProps): JSX.Element {
  const error = useCharacterStore((s) => s.errors.progress);
  const awardXp = useCharacterStore((s) => s.awardXp);
  const setLevels = useCharacterStore((s) => s.setLevels);
  const { classes, xp } = view.state;
  const [amount, setAmount] = useState('50');
  const [levels, setLevelInputs] = useState<Record<string, string>>({});
  const levelOf = (id: string, current: number) => levels[id] ?? String(current);

  return (
    <Panel kicker="Progression">
      <div className="char-inline">
        {classes.map((c) => (
          <span key={c.id} className="display text-24 char-accent" data-testid={`char-class-${c.id}`}>
            {pack.content.classes?.[c.id]?.name ?? c.id} {c.level}
          </span>
        ))}
        <span className="mono text-12 dim" data-testid="char-xp">
          XP {xp}
        </span>
      </div>
      <div className="char-inline char-gap">
        <Input
          className="mono char-num"
          type="number"
          aria-label="XP to award"
          data-testid="char-xp-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button data-testid="char-award-xp" onClick={() => awardXp(Number(amount))}>
          Award XP
        </Button>
      </div>
      <div className="char-inline char-gap">
        {classes.map((c) => (
          <label key={c.id} className="char-inline">
            <span className="kicker">{c.id}</span>
            <Input
              className="mono char-num"
              type="number"
              data-testid={`char-set-level-${c.id}`}
              value={levelOf(c.id, c.level)}
              onChange={(e) => setLevelInputs({ ...levels, [c.id]: e.target.value })}
            />
          </label>
        ))}
        <Button
          data-testid="char-set-level"
          onClick={() => setLevels(classes.map((c) => ({ id: c.id, level: Number(levelOf(c.id, c.level)) })))}
        >
          Set level
        </Button>
      </div>
      {error && <ErrorCard className="char-gap" error={error} />}
    </Panel>
  );
}
