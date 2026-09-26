/**
 * CAP-05 (browse the world), CAP-06 (rerun same seed, CA-12 incl. tamper) and CAP-03 export UI,
 * through the real built app on an isolated userData dir with the real engine and real fs.
 * Every expected value is computed here from the installed library; nothing is pinned.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateCampaign, listThemeKnobs, loadTheme } from 'ruleswright/compiler';
import type { Page } from '@playwright/test';
import { expect, test, type RulesWrightApp } from './fixtures';

function forgedPack(themeId: string, seed: number) {
  const theme = loadTheme(themeId);
  const knobs = Object.fromEntries(listThemeKnobs(theme).map((k) => [k.id, k.default]));
  return generateCampaign({ theme, seed, knobs });
}

async function forge(page: Page, themeId: string, seed: number): Promise<void> {
  await page.getByTestId('nav-roll').click();
  await page.getByTestId(`roll-theme-${themeId}`).click();
  await page.getByTestId('roll-seed').fill(String(seed));
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText(`${themeId} · ${seed}`);
}

function onlyWorldDir(rw: RulesWrightApp): string {
  const ids = readdirSync(join(rw.userData, 'worlds'));
  expect(ids).toHaveLength(1);
  return join(rw.userData, 'worlds', ids[0] as string);
}

/** Every file under `dir`, name → bytes (hex digest), for a no-durable-change check. */
function digestTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    out[file] = createHash('sha256').update(readFileSync(file)).digest('hex');
  }
  return out;
}

/** Layout evidence without an image viewer: columns disjoint, nothing overflows the window or its panel. */
async function expectCleanLayout(page: Page, shot: string): Promise<void> {
  await page.screenshot({ path: test.info().outputPath(shot), fullPage: true });
  const geometry = await page.evaluate(() => {
    const box = (sel: string) => document.querySelector(sel)?.getBoundingClientRect() ?? null;
    const detail = document.querySelector('[data-testid="world-detail"]');
    const detailBox = detail?.getBoundingClientRect();
    const escaping = detail
      ? [...detail.querySelectorAll('*')]
          .filter((el) => !el.closest('.world-grid-scroll'))
          .filter((el) => el.getBoundingClientRect().right > (detailBox?.right ?? 0) + 0.5)
          .map((el) => el.className || el.tagName)
      : [];
    const actions = [...document.querySelectorAll('.worldplate .btn')].map((b) => b.getBoundingClientRect());
    const world = document.querySelector('.world')?.getBoundingClientRect();
    const outsideWorld = world
      ? [...document.querySelectorAll('.world *')]
          .filter((el) => !el.closest('.json-view, .world-grid-scroll'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > world.right + 0.5 || r.left < world.left - 0.5);
          })
          .map((el) => el.className || el.tagName)
      : ['<no .world>'];
    const stack = ['.worldplate', '.world-strip', '.world-body'].map((sel) => box(sel));
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      viewport: window.innerWidth,
      subnav: box('.world-subnav'),
      rows: box('.world-rows'),
      detail: detailBox ?? null,
      escaping,
      actions: actions.map((r) => ({ left: r.left, right: r.right, height: r.height })),
      outsideWorld,
      stack: stack.map((r) => (r ? { top: r.top, bottom: r.bottom } : null)),
    };
  });
  expect(geometry.pageOverflow).toBeLessThanOrEqual(0);
  expect(geometry.outsideWorld).toEqual([]);
  const [plate, strip, body] = geometry.stack;
  expect(plate && strip && body).toBeTruthy();
  expect(plate!.bottom).toBeLessThanOrEqual(strip!.top);
  expect(strip!.bottom).toBeLessThanOrEqual(body!.top);
  for (const a of geometry.actions) {
    expect(a.left).toBeGreaterThanOrEqual(0);
    expect(a.right).toBeLessThanOrEqual(geometry.viewport);
    expect(a.height).toBeGreaterThanOrEqual(32);
  }
  if (geometry.subnav && geometry.rows && geometry.detail) {
    expect(geometry.subnav.right).toBeLessThanOrEqual(geometry.rows.left);
    expect(geometry.rows.right).toBeLessThanOrEqual(geometry.detail.left);
    expect(geometry.escaping).toEqual([]);
  }
}

test('CAP-05 browse + CAP-06 pass + CAP-03 export: forged dark-fantasy · 42', async ({ rw }) => {
  const { page } = rw;
  const pack = forgedPack('dark-fantasy', 42);
  await forge(page, 'dark-fantasy', 42);
  await page.getByTestId('nav-world').click();

  // Subnav counts equal the pack's own section sizes.
  const counts: Record<string, number> = {
    classes: Object.keys(pack.content.classes ?? {}).length,
    spells: Object.keys(pack.content.spells ?? {}).length,
    bestiary: Object.keys(pack.bestiary).length,
    tables: Object.keys(pack.tables).length,
  };
  for (const [section, count] of Object.entries(counts)) {
    await expect(page.getByTestId(`world-nav-${section}`).locator('.world-subnav-count')).toHaveText(String(count));
  }
  // Every other section is reachable as raw JSON.
  for (const section of ['races', 'skills', 'feats', 'conditions', 'actions', 'formulas', 'economy', 'stats', 'manifest']) {
    await expect(page.getByTestId(`world-nav-${section}`)).toBeVisible();
  }
  await page.getByTestId('world-nav-formulas').click();
  expect(JSON.parse((await page.getByTestId('world-raw').textContent()) ?? '')).toEqual(pack.formulas);

  // Classes: open Warden, then its raw JSON.
  await page.getByTestId('world-nav-classes').click();
  await page.getByTestId('world-entry-warden').click();
  const detail = page.getByTestId('world-detail');
  await expect(detail).toContainText('Warden');
  await expect(detail).toContainText(pack.progression.warden?.hd ?? '<no hd>');
  await expectCleanLayout(page, 'world-fantasy-classes.png');
  await page.getByTestId('world-raw-toggle').click();
  expect(JSON.parse((await page.getByTestId('world-raw').textContent()) ?? '')).toEqual(pack.content.classes?.warden);

  // Spells: the effect DSL is shown verbatim.
  const [spellId, spell] = Object.entries(pack.content.spells ?? {})[0] ?? [];
  await page.getByTestId('world-nav-spells').click();
  await page.getByTestId(`world-entry-${spellId}`).click();
  await expect(detail).toContainText(spell?.effect ?? '<no effect>');
  await expectCleanLayout(page, 'world-fantasy-spells-raw.png');

  // CAP-06 pass: byte-identical to the stored bytes.
  const bytes = Buffer.byteLength(JSON.stringify(pack), 'utf8');
  await page.getByTestId('rerun-same-seed').click();
  await expect(page.getByTestId('ok-card')).toContainText('byte-identical');
  await expect(page.getByTestId('ok-card')).toContainText(`${bytes} bytes`);

  // CAP-03 export: the exported file is exactly the stored pack.json.
  const out = mkdtempSync(join(tmpdir(), 'ruleswright-export-'));
  try {
    const target = join(out, 'export.json');
    await rw.stubSaveDialog(target);
    await page.getByTestId('export-pack').click();
    await expect(page.getByTestId('world-export-status')).toContainText('exported');
    const stored = readFileSync(join(onlyWorldDir(rw), 'pack.json'));
    expect(readFileSync(target).equals(stored)).toBe(true);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('CAP-06 tamper: a valid but re-titled pack fails the byte compare with an offset pointer', async ({ rw }) => {
  const pack = forgedPack('dark-fantasy', 42);
  await forge(rw.page, 'dark-fantasy', 42);
  const packFile = join(onlyWorldDir(rw), 'pack.json');

  await rw.app.close();
  const stored = JSON.stringify(pack);
  const tampered = JSON.stringify({ ...pack, manifest: { ...pack.manifest, title: 'Tampered' } });
  writeFileSync(packFile, tampered);
  await rw.restart();

  const { page } = rw;
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await page.getByTestId('nav-world').click();
  await expect(page.getByTestId('world-detail')).toBeVisible();
  const before = digestTree(rw.userData);
  await page.getByTestId('rerun-same-seed').click();

  let offset = 0;
  while (tampered[offset] === stored[offset]) offset += 1;
  const strip = page.getByTestId('world-determinism');
  await expect(strip).toHaveAttribute('data-state', 'fail');
  await expect(page.getByTestId('world-determinism-pointer')).toContainText(`first difference at char ${offset}`);
  await expect(page.getByTestId('world-determinism-pointer')).toContainText('Tampered');
  await expect(page.getByTestId('ok-card')).toHaveCount(0);
  expect(digestTree(rw.userData)).toEqual(before);
  await expectCleanLayout(page, 'world-fantasy-fail.png');
});

test('CAP-06 unavailable: a world with unknown params (seeded on disk) never fakes a rerun', async ({ rw }) => {
  const pack = forgedPack('zombie-urban', 7);
  const { provenance: _provenance, ...manifest } = pack.manifest;
  const packJson = JSON.stringify({ ...pack, manifest });
  const id = randomUUID();
  const dir = join(rw.userData, 'worlds', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pack.json'), packJson);
  const now = new Date().toISOString();
  const worldDoc = {
    formatVersion: 1,
    id,
    name: 'unknown params',
    theme: null,
    seed: null,
    knobs: null,
    schemaVersion: pack.manifest.schemaVersion,
    packSha256: createHash('sha256').update(packJson, 'utf8').digest('hex'),
    createdAt: now,
    updatedAt: now,
  };
  writeFileSync(join(dir, 'world.json'), JSON.stringify(worldDoc));
  await rw.restart();

  const { page } = rw;
  await expect(page.getByTestId('world-row')).toHaveCount(1);
  await page.getByTestId('world-open').click();
  await expect(page.getByTestId('active-world-name')).toHaveText('unknown params');
  await page.getByTestId('nav-world').click();
  await expect(page.getByTestId('rerun-same-seed')).toBeDisabled();
  const strip = page.getByTestId('world-determinism');
  await expect(strip).toHaveAttribute('data-state', 'unavailable');
  await expect(strip).toContainText('unavailable');
  await expect(strip).toContainText('generation parameters unknown');
  await expect(page.getByTestId('ok-card')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'archive');
  await page.getByTestId('world-entry-scavenger').click();
  await expect(page.getByTestId('world-detail')).toContainText(pack.content.classes?.scavenger?.name ?? '<none>');
  await expectCleanLayout(page, 'world-archive-unavailable.png');
});

test('layout: urban mood, wide window, bestiary and tables', async ({ rw }) => {
  const { page } = rw;
  const pack = forgedPack('zombie-urban', 42);
  await forge(page, 'zombie-urban', 42);
  await page.getByTestId('nav-world').click();
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'urban');
  const [statId, stat] = Object.entries(pack.bestiary)[0] ?? [];
  await page.getByTestId('world-nav-bestiary').click();
  await page.getByTestId(`world-entry-${statId}`).click();
  for (const action of stat?.actions ?? []) await expect(page.getByTestId('world-detail')).toContainText(action);
  await expectCleanLayout(page, 'world-urban-bestiary-1280.png');
  await page.getByTestId('world-nav-tables').click();
  await expectCleanLayout(page, 'world-urban-tables-1280.png');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByTestId('world-nav-classes').click();
  await expectCleanLayout(page, 'world-urban-classes-1600.png');
});
