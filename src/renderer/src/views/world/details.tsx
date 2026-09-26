/**
 * Bespoke detail layouts (FR-4). Everything shown is pack data verbatim; the known keys are only
 * laid out first — every other key still renders as `key: value` in mono.
 */
import type { ReactNode } from 'react';
import type { ClassDef, Pack, SpellDef, Statblock, TableDef } from '../../engine/schema';
import { Chip, Kicker, Panel2 } from '../../ui';
import type { BespokeKind } from './sections';

type Entry = Record<string, unknown>;

/** A scalar as-is; anything structured as its compact JSON. */
export function verbatim(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);
}

function Fields({ entry, skip }: { entry: Entry; skip: readonly string[] }): JSX.Element | null {
  const keys = Object.keys(entry).filter((k) => !skip.includes(k));
  if (keys.length === 0) return null;
  return (
    <dl className="world-fields">
      {keys.map((k) => (
        <div key={k} className="world-field">
          <dt className="mono world-key">{k}</dt>
          <dd className="mono world-value">{verbatim(entry[k])}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="world-block">
      <p className="mono world-key">{label}</p>
      <div className="world-block-body">{children}</div>
    </div>
  );
}

function Chips({ items }: { items: readonly unknown[] }): JSX.Element {
  return (
    <div className="world-chips">
      {items.map((item, i) => (
        <Chip key={i} className="mono">
          {verbatim(item)}
        </Chip>
      ))}
    </div>
  );
}

/** A small data grid; header and cells are shown exactly as given. */
function Grid({ head, rows }: { head: readonly string[]; rows: readonly (readonly ReactNode[])[] }): JSX.Element {
  return (
    <div className="world-grid-scroll">
      <table className="mono world-grid">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (c === 0 ? <th key={c} scope="row">{cell}</th> : <td key={c}>{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Per-level arrays keyed by name (saves, slots): one row per key, one column per array index. */
function PerLevelGrid({ label, byKey }: { label: string; byKey: Record<string, readonly unknown[]> }): JSX.Element {
  const width = Math.max(0, ...Object.values(byKey).map((values) => values.length));
  const head = [label, ...Array.from({ length: width }, (_, i) => `L${i + 1}`)];
  return <Grid head={head} rows={Object.entries(byKey).map(([key, values]) => [key, ...values.map(verbatim)])} />;
}

function Heading({ kicker, name }: { kicker: string; name: string }): JSX.Element {
  return (
    <>
      <Kicker>{kicker}</Kicker>
      <h2 className="display world-detail-name">{name}</h2>
    </>
  );
}

function Source({ paths }: { paths: readonly string[] }): JSX.Element {
  return <p className="mono world-source">source artifact · {paths.join(' · ')}</p>;
}

function ClassDetail({ id, def, pack }: { id: string; def: ClassDef; pack: Pack }): JSX.Element {
  const progression = pack.progression[id];
  const attackTable = progression?.attackTable;
  const defenses = attackTable ? [...new Set(attackTable.flatMap((row) => Object.keys(row.byDefense)))] : [];
  return (
    <>
      <Heading kicker="Class detail" name={def.name} />
      {def.spellLists !== undefined && (
        <Block label="spellLists">
          <Chips items={def.spellLists} />
        </Block>
      )}
      {def.armorCasting !== undefined && (
        <Block label="armorCasting">
          <Chips items={def.armorCasting} />
        </Block>
      )}
      {def.features !== undefined && (
        <Block label="features">
          <ul className="world-list">
            {def.features.map((f, i) => (
              <li key={i} className="mono">
                level {f.level} · {f.ref}
              </li>
            ))}
          </ul>
        </Block>
      )}
      <Fields entry={def as unknown as Entry} skip={['name', 'spellLists', 'armorCasting', 'features']} />
      {progression !== undefined && (
        <Panel2 pad="s" className="world-progression" kicker="Progression — pack data, verbatim">
          <Fields entry={{ hd: progression.hd }} skip={[]} />
          {progression.attackBonus !== undefined && (
            <Block label="attackBonus">
              <p className="mono world-dsl">{progression.attackBonus}</p>
            </Block>
          )}
          <Block label="saves">
            <PerLevelGrid label="save" byKey={progression.saves} />
          </Block>
          {progression.slots !== undefined && (
            <Block label="slots">
              <PerLevelGrid label="spell level" byKey={progression.slots} />
            </Block>
          )}
          {attackTable !== undefined && (
            <Block label="attackTable · byDefense">
              <Grid
                head={['level', ...defenses]}
                rows={attackTable.map((row) => [row.level, ...defenses.map((d) => verbatim(row.byDefense[d] ?? ''))])}
              />
            </Block>
          )}
          <Fields
            entry={progression as unknown as Entry}
            skip={['hd', 'attackBonus', 'saves', 'slots', 'attackTable']}
          />
        </Panel2>
      )}
      <Source paths={[`content.classes.${id}`, ...(progression ? [`progression.${id}`] : [])]} />
    </>
  );
}

function SpellDetail({ id, def }: { id: string; def: SpellDef }): JSX.Element {
  return (
    <>
      <Heading kicker="Spell detail" name={def.name} />
      <Fields entry={{ ...def.magic } as Entry} skip={[]} />
      <Block label="cost">
        <Fields entry={{ ...def.cost } as Entry} skip={[]} />
      </Block>
      {def.targeting !== undefined && (
        <Block label="targeting">
          <Fields entry={{ ...def.targeting } as Entry} skip={[]} />
        </Block>
      )}
      {def.tags !== undefined && (
        <Block label="tags">
          <Chips items={def.tags} />
        </Block>
      )}
      <Panel2 pad="s" className="world-progression" kicker="effect — pack DSL, verbatim">
        <p className="mono world-dsl">{def.effect}</p>
      </Panel2>
      <Fields entry={def as unknown as Entry} skip={['name', 'magic', 'cost', 'targeting', 'tags', 'effect']} />
      <Source paths={[`content.spells.${id}`]} />
    </>
  );
}

function StatblockDetail({ id, def }: { id: string; def: Statblock }): JSX.Element {
  return (
    <>
      <Heading kicker="Statblock" name={def.name} />
      <Fields
        entry={def as unknown as Entry}
        skip={['name', 'abilityOverrides', 'saveOverrides', 'actions']}
      />
      {def.abilityOverrides !== undefined && (
        <Block label="abilityOverrides">
          <Fields entry={def.abilityOverrides} skip={[]} />
        </Block>
      )}
      {def.saveOverrides !== undefined && (
        <Block label="saveOverrides">
          <Fields entry={def.saveOverrides} skip={[]} />
        </Block>
      )}
      <Block label="actions">
        <Chips items={def.actions} />
      </Block>
      <Source paths={[`bestiary.${id}`]} />
    </>
  );
}

function TableDetail({ id, def }: { id: string; def: TableDef }): JSX.Element {
  return (
    <>
      <Heading kicker="Table" name={id} />
      <Fields entry={def as unknown as Entry} skip={['entries']} />
      <Block label="entries">
        <ul className="world-list">
          {def.entries.map((entry, i) => {
            const { value, min, max, ...rest } = entry;
            const range = min !== undefined || max !== undefined ? [`${verbatim(min)}–${verbatim(max)}`] : [];
            const pointer = [...range, ...Object.entries(rest).map(([k, v]) => `${k} ${verbatim(v)}`)];
            return (
              <li key={i} className="mono">
                {pointer.join(' · ')} → {verbatim(value)}
              </li>
            );
          })}
        </ul>
      </Block>
      <Source paths={[`tables.${id}`]} />
    </>
  );
}

/** The detail body for one entry of a bespoke section. */
export function EntryDetail({ kind, id, entry, pack }: { kind: BespokeKind; id: string; entry: unknown; pack: Pack }): JSX.Element {
  switch (kind) {
    case 'classes':
      return <ClassDetail id={id} def={entry as ClassDef} pack={pack} />;
    case 'spells':
      return <SpellDetail id={id} def={entry as SpellDef} />;
    case 'bestiary':
      return <StatblockDetail id={id} def={entry as Statblock} />;
    case 'tables':
      return <TableDetail id={id} def={entry as TableDef} />;
  }
}

/** One-line list-row data for an entry, from its own fields. */
export function entryMeta(kind: BespokeKind, id: string, entry: unknown, pack: Pack): string {
  const parts = [id];
  if (kind === 'classes') {
    const hd = pack.progression[id]?.hd;
    if (hd !== undefined) parts.push(`hd ${hd}`);
  } else if (kind === 'spells') {
    const { magic } = entry as SpellDef;
    parts.push(`level ${magic.level}`, magic.lists.join(', '));
  } else if (kind === 'bestiary') {
    const def = entry as Statblock;
    parts.push(`threat ${def.threat}`);
    if (def.level !== undefined) parts.push(`level ${def.level}`);
  } else {
    const def = entry as TableDef;
    parts.push(def.kind, `${def.entries.length} entries`);
  }
  return parts.join(' · ');
}

/** The list-row title: the entry's `name` when it has one, else its id. */
export function entryTitle(id: string, entry: unknown): string {
  const name = (entry as Entry).name;
  return typeof name === 'string' ? name : id;
}
