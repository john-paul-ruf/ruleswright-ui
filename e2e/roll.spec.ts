/**
 * CAP-02 (world management) and CAP-03 (import) through the real built app: Roll UI → sandboxed
 * preload → IPC → main handlers → fs under an isolated userData, real engine in the renderer.
 * Disk assertions read userData directly; expected library values are computed in-process.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { createCharacter, PackLoadError, Runtime, serializeCharacter } from 'ruleswright/runtime';
import { expect, test, type RulesWrightApp } from './fixtures';

async function forge(page: Page, themeId: string, seed: number): Promise<void> {
  await page.getByTestId('nav-roll').click();
  await page.getByTestId(`roll-theme-${themeId}`).click();
  await page.getByTestId('roll-seed').fill(String(seed));
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText(`${themeId} · ${seed}`);
  // Design flow 1: a successful forge opens the World surface.
  await expect(page.getByTestId('nav-world')).toHaveAttribute('aria-current', 'page');
  await page.getByTestId('nav-roll').click();
}

async function paste(page: Page, text: string): Promise<void> {
  await page.getByTestId('nav-roll').click();
  await page.getByTestId('import-paste').fill(text);
  await page.getByTestId('import-paste-submit').click();
}

type WorldJson = Record<string, unknown> & { id: string; name: string };

function worldDocs(rw: RulesWrightApp): WorldJson[] {
  const dir = join(rw.userData, 'worlds');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((id) => JSON.parse(readFileSync(join(dir, id, 'world.json'), 'utf8')) as WorldJson);
}

function worldIdNamed(rw: RulesWrightApp, name: string): string {
  const doc = worldDocs(rw).find((w) => w.name === name);
  if (!doc) throw new Error(`no world named ${name}`);
  return doc.id;
}

const row = (page: Page, text: string) => page.getByTestId('world-row').filter({ hasText: text });

test('CAP-02: rename persists, delete cascades with named counts, last-opened survives restart', async ({ rw }) => {
  let page = rw.page;
  await forge(page, 'dark-fantasy', 11);
  await forge(page, 'zombie-urban', 12);
  await expect(page.getByTestId('world-row')).toHaveCount(2);

  // Rename inline: Esc cancels, Enter commits.
  const first = row(page, 'dark-fantasy · 11');
  await first.getByTestId('world-rename').click();
  const nameInput = first.getByRole('textbox');
  await expect(nameInput).toBeFocused();
  await nameInput.fill('never saved');
  await nameInput.press('Escape');
  await expect(first.getByTestId('world-rename')).toBeFocused();
  await first.getByTestId('world-rename').click();
  await first.getByRole('textbox').fill('x'.repeat(81));
  await first.getByRole('textbox').press('Enter');
  await expect(first.getByTestId('error-card')).toContainText('invalid-input');
  await first.getByRole('textbox').fill('Barrow Test');
  await first.getByRole('textbox').press('Enter');
  await expect(row(page, 'Barrow Test')).toHaveCount(1);
  const barrowId = worldIdNamed(rw, 'Barrow Test');

  // Restart: the rename is durable and the last-opened world (zombie-urban · 12) reopens first.
  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('world-row')).toHaveCount(2);
  await expect(row(page, 'Barrow Test')).toContainText('dark-fantasy · 11');
  await expect(page.getByTestId('active-world-seed')).toHaveText('zombie-urban · 12');
  await expect(page.getByTestId('world-row').first()).toContainText('last opened');
  await expect(page.getByTestId('world-row').first()).toContainText('zombie-urban · 12');
  expect(JSON.parse(readFileSync(join(rw.userData, 'worlds', barrowId, 'world.json'), 'utf8')).name).toBe('Barrow Test');

  // A real snapshot on disk for Barrow Test: body is the library's serializeCharacter output.
  const packJson = readFileSync(join(rw.userData, 'worlds', barrowId, 'pack.json'), 'utf8');
  const runtime = new Runtime(JSON.parse(packJson));
  const character = createCharacter(runtime, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] });
  const snapshot = serializeCharacter(runtime, character.state);
  mkdirSync(join(rw.userData, 'snapshots', barrowId), { recursive: true });
  const snapshotDoc = {
    formatVersion: 1,
    id: randomUUID(),
    worldId: barrowId,
    name: 'pre',
    createdAt: new Date().toISOString(),
    packIdentity: snapshot.pack,
    snapshot,
  };
  writeFileSync(join(rw.userData, 'snapshots', barrowId, 'pre.json'), JSON.stringify(snapshotDoc));

  // Open Barrow Test (it becomes lastWorldId), then delete it: cancel first, then confirm.
  await row(page, 'Barrow Test').getByTestId('world-open').click();
  await expect(page.getByTestId('active-world-name')).toHaveText('Barrow Test');
  await row(page, 'Barrow Test').getByTestId('world-delete').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Delete Barrow Test?');
  await expect(dialog).toContainText('1 snapshot');
  await expect(dialog).toContainText('0 fight records');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(existsSync(join(rw.userData, 'worlds', barrowId))).toBe(true);

  await row(page, 'Barrow Test').getByTestId('world-delete').click();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('world-row')).toHaveCount(1);
  await expect(page.getByTestId('active-world-name')).toHaveCount(0);
  expect(existsSync(join(rw.userData, 'worlds', barrowId))).toBe(false);
  expect(existsSync(join(rw.userData, 'snapshots', barrowId))).toBe(false);
  expect(JSON.parse(readFileSync(join(rw.userData, 'settings.json'), 'utf8')).lastWorldId).toBeNull();

  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('world-row')).toHaveCount(1);
  await expect(page.getByTestId('world-row')).toContainText('zombie-urban · 12');
  await expect(page.getByTestId('active-world-name')).toHaveCount(0);
});

test('CAP-03: paste import — rejection verbatim, provenance params, canonical bytes, unknown params', async ({ rw }) => {
  const { page } = rw;

  // Rejected: the library's first card verbatim; the paste stays; nothing is written.
  const invalid = '{"schemaVersion":1}';
  let rejection: PackLoadError | undefined;
  try {
    new Runtime(JSON.parse(invalid));
  } catch (e) {
    if (e instanceof PackLoadError) rejection = e;
  }
  const card = rejection?.errors[0];
  expect(card?.rule).toBe('E-SCHEMA-01');
  await paste(page, invalid);
  const errorCard = page.getByTestId('error-card');
  await expect(errorCard).toHaveCount(1);
  await expect(errorCard).toContainText('E-SCHEMA-01');
  await expect(errorCard).toContainText(card?.message ?? '<missing card>');
  await expect(page.getByTestId('import-paste')).toHaveValue(invalid);
  await expect(page.getByTestId('world-row')).toHaveCount(0);
  expect(worldDocs(rw)).toEqual([]);

  // Pretty-printed zombie-urban·5: params from provenance, stored canonical, urban mood.
  const zombie = generateCampaign({ theme: loadTheme('zombie-urban'), seed: 5 });
  await paste(page, JSON.stringify(zombie, null, 2));
  await expect(page.getByTestId('active-world-seed')).toHaveText('zombie-urban · 5');
  await expect(page.getByTestId('nav-world')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'urban');
  await page.getByTestId('nav-roll').click();
  await expect(page.getByTestId('error-card')).toHaveCount(0);
  await expect(page.getByTestId('import-paste')).toHaveValue('');
  await expect(row(page, 'zombie-urban · 5')).toHaveCount(1);
  const zombieId = worldIdNamed(rw, 'zombie-urban · 5');
  const zombieBytes = readFileSync(join(rw.userData, 'worlds', zombieId, 'pack.json'));
  expect(zombieBytes.equals(Buffer.from(JSON.stringify(zombie), 'utf8'))).toBe(true);
  expect(worldDocs(rw)[0]).toMatchObject({ theme: 'zombie-urban', seed: 5, knobs: zombie.manifest.provenance?.knobs ?? {} });

  // dark-fantasy·3 without provenance: all params null, named by the manifest title, archive mood.
  const fantasy = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 3 });
  const { provenance: _dropped, ...manifest } = fantasy.manifest;
  await paste(page, JSON.stringify({ ...fantasy, manifest }));
  await expect(page.getByTestId('active-world-seed')).toHaveText('imported · seed unknown');
  await expect(page.getByTestId('active-world-name')).toHaveText(manifest.title);
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'archive');
  const imported = worldDocs(rw).find((w) => w.id !== zombieId);
  expect(imported).toMatchObject({ name: manifest.title, theme: null, seed: null, knobs: null });
  await page.getByTestId('nav-roll').click();
  await expect(page.getByTestId('world-row')).toHaveCount(2);
  await expect(page.getByTestId('world-row').first()).toContainText('imported · seed unknown');
});

test('CAP-03: file import through the native dialog; cancel changes nothing', async ({ rw }) => {
  const { page } = rw;
  const file = join(rw.userData, 'incoming-pack.json');
  const pack = generateCampaign({ theme: loadTheme('zombie-urban'), seed: 8 });
  writeFileSync(file, JSON.stringify(pack, null, 2));

  await rw.stubOpenDialog(null);
  await page.getByTestId('import-file').click();
  await expect(page.getByTestId('error-card')).toHaveCount(0);
  await expect(page.getByTestId('world-row')).toHaveCount(0);
  await expect(page.getByTestId('nav-roll')).toHaveAttribute('aria-current', 'page');
  expect(worldDocs(rw)).toEqual([]);

  await rw.stubOpenDialog(file);
  await page.getByTestId('import-file').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText('zombie-urban · 8');
  await page.getByTestId('nav-roll').click();
  await expect(page.getByTestId('world-row')).toHaveCount(1);
  const [doc] = worldDocs(rw);
  const bytes = readFileSync(join(rw.userData, 'worlds', doc?.id ?? '-', 'pack.json'));
  expect(bytes.equals(Buffer.from(JSON.stringify(pack), 'utf8'))).toBe(true);
});

test('CAP-02: a corrupt world is flagged with its card, never deleted; skipped documents are listed', async ({ rw }) => {
  let page = rw.page;
  await forge(page, 'dark-fantasy', 21);
  await forge(page, 'zombie-urban', 22);
  const badId = worldIdNamed(rw, 'dark-fantasy · 21');
  const badPack = join(rw.userData, 'worlds', badId, 'pack.json');
  writeFileSync(badPack, '{"schemaVersion":1}');
  mkdirSync(join(rw.userData, 'worlds', 'not-a-world'));

  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('active-world-seed')).toHaveText('zombie-urban · 22');
  await expect(page.getByTestId('world-corrupt')).toHaveCount(0);
  const skipped = page.getByRole('list', { name: 'Skipped documents' });
  await expect(skipped).toContainText('worlds/not-a-world');
  await expect(skipped).toContainText('skipped');

  const bad = row(page, 'dark-fantasy · 21');
  await bad.getByTestId('world-open').click();
  await expect(bad.getByTestId('world-corrupt')).toBeVisible();
  await expect(bad.getByTestId('error-card')).toContainText('PackLoadError');
  await expect(bad.getByTestId('error-card')).toContainText('E-SCHEMA-01');
  await expect(page.getByTestId('error-card')).toHaveCount(1);
  await expect(row(page, 'zombie-urban · 22').getByTestId('world-corrupt')).toHaveCount(0);
  // The failed open changed nothing: the previous world stays open and the file is kept.
  await expect(page.getByTestId('active-world-seed')).toHaveText('zombie-urban · 22');
  expect(readFileSync(badPack, 'utf8')).toBe('{"schemaVersion":1}');
  await expect(page.getByTestId('world-row')).toHaveCount(2);
});
