/**
 * CAP-02 (FR-18): inventory & loot on the Character surface through the real built app — real engine in the
 * renderer, real fs in main, isolated userData, restart on the same dir. Every expected value is recomputed here
 * with the library from the stored pack bytes (CA-13/14/05/06).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCharacter as libCreate, dropItem, grantItem, grantLoot, Runtime, serializeCharacter } from 'ruleswright/runtime';
import type { Page } from '@playwright/test';
import { expect, test, type RulesWrightApp } from './fixtures';

const SHOTS = process.env.RW_SHOTS_DIR;
const BRYNN = { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] };

async function forge(page: Page, themeId: string, seed: string): Promise<void> {
  await page.getByTestId('nav-roll').click();
  await page.getByTestId(`roll-theme-${themeId}`).click();
  await page.getByTestId('roll-seed').fill(seed);
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText(`${themeId} · ${seed}`);
}

async function createCharacter(page: Page, name: string, race?: string, cls?: string, level = '1'): Promise<void> {
  await page.getByTestId('char-name').fill(name);
  if (race !== undefined) await page.getByTestId('char-race').selectOption(race);
  if (cls !== undefined) await page.getByTestId('char-class').selectOption(cls);
  await page.getByTestId('char-level').fill(level);
  await page.getByTestId('char-create').click();
}

/** The world id whose world.json records `theme · seed`. */
function worldIdFor(userData: string, theme: string, seed: number): string {
  const dir = join(userData, 'worlds');
  const id = readdirSync(dir).find((d) => {
    const doc = JSON.parse(readFileSync(join(dir, d, 'world.json'), 'utf8'));
    return doc.seed === seed && doc.theme === theme;
  });
  if (!id) throw new Error(`no ${theme} world with seed ${seed}`);
  return id;
}

/** The library over the stored pack bytes — the only source of expected values. */
function runtimeOf(userData: string, worldId: string): Runtime {
  return new Runtime(JSON.parse(readFileSync(join(userData, 'worlds', worldId, 'pack.json'), 'utf8')));
}

/** The library's rejection card for a call that must fail. */
function rejection(run: () => unknown): { rule: string; message: string } {
  try {
    run();
  } catch (e) {
    const card = (e as { errors: { rule: string; message: string }[] }).errors[0];
    if (card) return card;
  }
  throw new Error('expected the library to reject');
}

/** CA-13: every row the library holds, and no other, with its qty verbatim. */
async function expectRows(page: Page, inventory: readonly { id: string; qty: number }[]): Promise<void> {
  await expect(page.locator('[data-testid^="char-item-qty-"]')).toHaveCount(inventory.length);
  for (const { id, qty } of inventory) await expect(page.getByTestId(`char-item-qty-${id}`)).toHaveText(`×${qty}`);
  const order = await page.locator('[data-testid^="char-item-qty-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(order).toEqual(inventory.map(({ id }) => `char-item-qty-${id}`));
}

/** Layout evidence without an image viewer: no horizontal overflow; the panel sits inside the sheet column after Conditions. */
async function layoutFacts(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="char-inventory"]');
    const sheet = document.querySelector('.char-grid > .char-column');
    const conditions = document.querySelector('[data-testid="char-apply-condition"]')?.closest('.panel');
    const p = panel?.getBoundingClientRect();
    const s = sheet?.getBoundingClientRect();
    const overflowing = [...(panel?.querySelectorAll('*') ?? [])].filter((el) => {
      const r = el.getBoundingClientRect();
      return p !== undefined && r.width > 0 && (r.left < p.left - 1 || r.right > p.right + 1);
    }).length;
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      insideSheet: !!p && !!s && p.left >= s.left - 1 && p.right <= s.right + 1,
      afterConditions: !!conditions && conditions.nextElementSibling === panel,
      overflowing,
    };
  });
}

function expectOnlyLocalRequests(rw: RulesWrightApp): void {
  expect(rw.requests.length).toBeGreaterThan(0);
  expect(rw.requests.filter((u) => !/^(file|devtools|data):/.test(u))).toEqual([]);
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

test('CAP-02: loot, grant, drop, rejections verbatim, snapshot across restart, no-loot-tables world', async ({ rw }) => {
  let page = rw.page;

  // 1. Forge dark-fantasy · 42 → create Brynn → nothing held.
  await forge(page, 'dark-fantasy', '42');
  await page.getByTestId('nav-character').click();
  await createCharacter(page, 'Brynn', 'hillfolk', 'warden');
  await expect(page.getByTestId('char-inventory-empty')).toHaveText('Nothing held yet.');
  const world = worldIdFor(rw.userData, 'dark-fantasy', 42);
  const rt = runtimeOf(rw.userData, world);
  const replay = libCreate(rt, BRYNN);

  // CA-14: nothing implicit — Roll loot needs an integer in the visible field; ⟳ writes one there.
  await expect(page.getByTestId('char-loot-seed')).toHaveValue('');
  await expect(page.getByTestId('char-loot')).toBeDisabled();
  await page.getByTestId('char-loot-seed').fill('4.5');
  await expect(page.getByTestId('char-loot')).toBeDisabled();
  await page.getByTestId('char-loot-seed-randomize').click();
  await expect(page.getByTestId('char-loot-seed')).toHaveValue(/^\d+$/);
  await expect(page.getByTestId('char-loot')).toBeEnabled();
  await expect(page.getByTestId('char-inventory-empty')).toBeVisible();
  await expect(page.getByTestId('char-loot-table').locator('option')).toHaveText(
    Object.keys(rt.pack.tables).filter((id) => id.endsWith('-loot')),
  );

  // 2. Seed 42 on barrow-loot → the library's grant; events with why.rule verbatim.
  await page.getByTestId('char-loot-seed').fill('42');
  await page.getByTestId('char-loot-table').selectOption('barrow-loot');
  await page.getByTestId('char-loot').click();
  const rolled = grantLoot(rt, replay.state, 'barrow-loot', { seed: 42 });
  await expectRows(page, replay.state.inventory);
  await expect(page.getByTestId('char-inventory-empty')).toHaveCount(0);
  const item = rt.pack.content.items?.['grave-ward'];
  await expect(page.getByTestId('char-item-grave-ward')).toContainText(item?.name ?? 'grave-ward');
  if (item?.kind) await expect(page.getByTestId('char-item-grave-ward')).toContainText(item.kind);
  for (const [n, e] of rolled.entries()) {
    const row = page.getByTestId(`char-inventory-event-${n}`);
    await expect(row).toHaveAttribute('data-type', e.type);
    await expect(row).toContainText(`why.rule · ${e.why.rule}`);
  }
  await expect(page.getByTestId(`char-inventory-event-${rolled.length}`)).toHaveCount(0);
  await expect(page.getByTestId('char-inventory-event-0')).toHaveClass(/event-roll/);
  await shot(page, 'inventory-fantasy-looted');

  // 3. Same seed again → stacks.
  await page.getByTestId('char-loot').click();
  grantLoot(rt, replay.state, 'barrow-loot', { seed: 42 });
  await expectRows(page, replay.state.inventory);
  await expect(page.getByTestId('char-item-qty-grave-ward')).toHaveText('×2');

  // 4. Overdraw → the library's insufficient-qty card verbatim, nothing changed; drop 1 → the library's remainder.
  await page.getByTestId('char-drop-amount-grave-ward').fill('5');
  await page.getByTestId('char-drop-grave-ward').click();
  const overdraw = rejection(() => dropItem(rt, replay.state, 'grave-ward', 5));
  expect(overdraw.rule).toBe('insufficient-qty');
  const error = page.getByTestId('char-inventory-error');
  await expect(error).toContainText(overdraw.rule);
  await expect(error).toContainText(overdraw.message);
  await expectRows(page, replay.state.inventory);
  await expect(page.getByTestId('char-drop-amount-grave-ward')).toHaveValue('5');
  await shot(page, 'inventory-fantasy-rejected');
  await page.getByTestId('char-drop-amount-grave-ward').fill('1');
  await page.getByTestId('char-drop-grave-ward').click();
  const dropped = dropItem(rt, replay.state, 'grave-ward', 1);
  await expect(error).toHaveCount(0);
  await expectRows(page, replay.state.inventory);
  await expect(page.getByTestId('char-inventory-event-0')).toHaveAttribute('data-type', dropped.type);
  await expect(page.getByTestId('char-inventory-event-0')).toHaveClass(/event-mutation/);

  // 5. Grant hearth-bread × 2.
  await page.getByTestId('char-grant-item').selectOption('hearth-bread');
  await page.getByTestId('char-grant-qty').fill('2');
  await page.getByTestId('char-grant').click();
  grantItem(rt, replay.state, 'hearth-bread', 2);
  await expectRows(page, replay.state.inventory);

  // 6. (PC-1) barrow-loot seed 4 → the library's unresolvable-ref card verbatim, nothing changed.
  await page.getByTestId('char-loot-seed').fill('4');
  await page.getByTestId('char-loot').click();
  const unresolved = rejection(() => grantLoot(rt, replay.state, 'barrow-loot', { seed: 4 }));
  await expect(error).toContainText(unresolved.rule);
  await expect(error).toContainText(unresolved.message);
  await expectRows(page, replay.state.inventory);

  const wide = await layoutFacts(page);
  expect(wide).toEqual({ overflowX: 0, insideSheet: true, afterConditions: true, overflowing: 0 });

  // 7. Save → the file's inventory is the library's envelope → restart → load → the same rows.
  await page.getByTestId('char-snapshot-name').fill('packed');
  await page.getByTestId('char-snapshot-save').click();
  await expect(page.getByTestId('char-snapshot-pack-packed')).toBeVisible();
  const doc = JSON.parse(readFileSync(join(rw.userData, 'snapshots', world, 'packed.json'), 'utf8'));
  expect(doc.snapshot.state.inventory).toEqual(serializeCharacter(rt, replay.state).state.inventory);
  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await page.getByTestId('nav-character').click();
  await expect(page.getByTestId('empty-state')).toHaveAttribute('data-kind', 'no-character');
  await page.getByTestId('char-snapshot-load-packed').click();
  await expectRows(page, replay.state.inventory);

  // 8. zombie-urban declares no -loot tables → honest empty state; Grant still works.
  await forge(page, 'zombie-urban', '42');
  await page.getByTestId('nav-character').click();
  await createCharacter(page, 'Rook');
  const urban = runtimeOf(rw.userData, worldIdFor(rw.userData, 'zombie-urban', 42));
  await expect(page.getByTestId('char-loot-empty')).toHaveText('This pack declares no loot tables.');
  await expect(page.getByTestId('char-loot')).toHaveCount(0);
  const firstItem = Object.keys(urban.pack.content.items ?? {})[0];
  if (!firstItem) throw new Error('zombie-urban declares no items');
  const rook = libCreate(urban, {
    name: 'Rook',
    race: Object.keys(urban.pack.content.races ?? {})[0] ?? '',
    classes: [{ id: Object.keys(urban.pack.content.classes ?? {})[0] ?? '', level: 1 }],
  });
  await page.getByTestId('char-grant').click();
  grantItem(urban, rook.state, firstItem, 1);
  await expectRows(page, rook.state.inventory);
  await shot(page, 'inventory-urban-no-loot');

  // Below the mock's lg breakpoint the panel still fits its column.
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(() => layoutFacts(page)).toEqual({ overflowX: 0, insideSheet: true, afterConditions: true, overflowing: 0 });
  await shot(page, 'inventory-urban-narrow');

  // 9. FR-17: nothing left the machine.
  expectOnlyLocalRequests(rw);
});
