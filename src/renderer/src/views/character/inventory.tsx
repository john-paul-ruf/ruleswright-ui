/** The Inventory panel (FR-18, mocks/character.html): held stacks, Grant, Loot, the last mutation's events. */
import { useState } from 'react';
import type { CharacterView } from '../../engine/runtime';
import { useCharacterStore } from '../../store/character';
import { Button, Chip, ErrorCard, EventRow, Input, Panel, Panel2, Select } from '../../ui';
import { summaryOf } from '../combat/log';

type Action = 'drop' | 'grant' | 'loot';

/** Inventory events only: a mutation's events all come from one section (CA-07 — not the combat log). */
const INVENTORY_EVENT = /^(item|loot):/;

function isSafeInteger(text: string): boolean {
  return text.trim() !== '' && Number.isSafeInteger(Number(text));
}

/** FR-18 / CA-13: rows are the library's inventory in its order; names and kinds are the pack's, verbatim. */
export function InventoryPanel({ view }: { view: CharacterView }): JSX.Element {
  const error = useCharacterStore((s) => s.errors.inventory);
  const lastEvents = useCharacterStore((s) => s.lastEvents);
  const grant = useCharacterStore((s) => s.grant);
  const drop = useCharacterStore((s) => s.drop);
  const loot = useCharacterStore((s) => s.loot);
  const { items, lootTables } = view;
  const [failedAt, setFailedAt] = useState<Action>('drop');
  const [dropAmounts, setDropAmounts] = useState<Record<string, string>>({});
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [grantQty, setGrantQty] = useState('1');
  const [tableId, setTableId] = useState(lootTables[0] ?? '');
  const [seed, setSeed] = useState('');
  const events = lastEvents.filter((e) => INVENTORY_EVENT.test(e.type));
  const defOf = (id: string) => items.find((i) => i.id === id);

  function run(action: Action, call: () => void): void {
    setFailedAt(action);
    call();
  }

  function randomizeSeed(): void {
    // CA-14: a user-initiated pick into the visible field, never passed implicitly.
    setSeed(String(crypto.getRandomValues(new Uint32Array(1))[0]));
  }

  const errorAt = (action: Action) =>
    error &&
    failedAt === action && (
      <div className="char-gap" data-testid="char-inventory-error" role="alert">
        <ErrorCard error={error} />
      </div>
    );

  return (
    <Panel kicker="Inventory" aside={<span className="text-12 dim">items and loot tables come from the pack</span>} data-testid="char-inventory">
      <div className="char-stack">
        {view.state.inventory.map(({ id, qty }) => {
          const def = defOf(id);
          const amount = dropAmounts[id] ?? '1';
          return (
            <Panel2 key={id} pad="none" className="char-item" data-testid={`char-item-${id}`}>
              <div className="char-item-text">
                <span className="display char-item-qty" data-testid={`char-item-qty-${id}`}>
                  ×{qty}
                </span>
                <div className="char-item-name">
                  <p className="reading text-16">
                    {def?.name ?? id}
                    {def?.kind ? <Chip className="char-item-kind">{def.kind}</Chip> : null}
                  </p>
                  <p className="mono row-data">{id}</p>
                </div>
              </div>
              <div className="char-inline">
                <Input
                  className="mono char-num"
                  type="number"
                  step={1}
                  aria-label={`${id} qty to drop`}
                  data-testid={`char-drop-amount-${id}`}
                  value={amount}
                  onChange={(e) => setDropAmounts({ ...dropAmounts, [id]: e.target.value })}
                />
                <Button size="s" data-testid={`char-drop-${id}`} onClick={() => run('drop', () => drop(id, Number(amount)))}>
                  Drop
                </Button>
              </div>
            </Panel2>
          );
        })}
        {view.state.inventory.length === 0 && (
          <Panel2 pad="s" className="char-inv-empty" data-testid="char-inventory-empty">
            <p>Nothing held yet.</p>
          </Panel2>
        )}
      </div>
      {errorAt('drop')}

      <div className="char-gap">
        <p className="kicker char-row-kicker">Grant</p>
        <div className="char-inline">
          <Select
            className="char-grow"
            aria-label="Item to grant"
            data-testid="char-grant-item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.kind === null ? i.id : `${i.id} · ${i.kind}`}
              </option>
            ))}
          </Select>
          <Input
            className="mono char-num"
            type="number"
            step={1}
            aria-label="Qty to grant"
            data-testid="char-grant-qty"
            value={grantQty}
            onChange={(e) => setGrantQty(e.target.value)}
          />
          <Button data-testid="char-grant" disabled={itemId === ''} onClick={() => run('grant', () => grant(itemId, Number(grantQty)))}>
            Grant
          </Button>
        </div>
      </div>
      {errorAt('grant')}

      <div className="char-gap">
        <p className="kicker char-row-kicker">Loot</p>
        {lootTables.length === 0 ? (
          <Panel2 pad="s" className="char-inv-empty" data-testid="char-loot-empty">
            <p>This pack declares no loot tables.</p>
          </Panel2>
        ) : (
          <>
            <div className="char-inline">
              <Select
                className="mono char-grow"
                aria-label="Loot table"
                data-testid="char-loot-table"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
              >
                {lootTables.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </Select>
              <Input
                className="mono char-seed"
                type="number"
                step={1}
                aria-label="Loot seed"
                data-testid="char-loot-seed"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
              <Button data-testid="char-loot-seed-randomize" onClick={randomizeSeed}>
                <span aria-hidden="true">⟳</span> Randomize
              </Button>
              <Button
                variant="primary"
                data-testid="char-loot"
                disabled={tableId === '' || !isSafeInteger(seed)}
                onClick={() => run('loot', () => loot(tableId, Number(seed)))}
              >
                Roll loot
              </Button>
            </div>
            <p className="text-12 dim char-hint">
              The loot seed is explicit — typed, or picked by Randomize before the library is called. Same seed, same
              table, same loot.
            </p>
          </>
        )}
      </div>
      {errorAt('loot')}

      {events.length > 0 && (
        <>
          <p className="kicker char-events-kicker">Last roll · events</p>
          <div className="char-stack char-events">
            {events.map((e, n) => (
              <EventRow
                key={n}
                data-testid={`char-inventory-event-${n}`}
                data-type={e.type}
                variant={e.type.startsWith('loot:') ? 'roll' : 'mutation'}
                kicker={e.type}
                summary={summaryOf(e)}
                why={`why.rule · ${e.why.rule}`}
              />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
