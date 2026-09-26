/**
 * CAP-01 — the first narrow journey through the real app: Roll forge → sandboxed preload →
 * IPC → main writes userData → restart → list + reopen (pack re-validated) → active world shown.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GenerationError, generateCampaign, listThemeKnobs, loadTheme } from 'ruleswright/compiler';
import { expect, test } from './fixtures';

const theme = loadTheme('dark-fantasy');
const DEFAULT_KNOBS = Object.fromEntries(listThemeKnobs(theme).map((k) => [k.id, k.default]));

function libraryRejection(knobs: Record<string, string | number>): GenerationError {
  try {
    generateCampaign({ theme, seed: 42, knobs });
  } catch (e) {
    if (e instanceof GenerationError) return e;
    throw e;
  }
  throw new Error('expected the library to reject these knobs');
}

test('CAP-01: forge → persist → restart → reopen', async ({ rw }) => {
  const { page } = rw;
  await expect(page.getByTestId('roll-theme-dark-fantasy')).toBeVisible();
  await expect(page.getByTestId('world-row')).toHaveCount(0);

  // Forge through the UI.
  await page.getByTestId('roll-theme-dark-fantasy').click();
  await expect(page.getByTestId('roll-theme-dark-fantasy')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('roll-seed').fill('42');
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await expect(page.getByTestId('world-row')).toHaveCount(1);

  // Disk: pack bytes are exactly the library's canonical serialization (CA-01) and digested (CA-03).
  const worldIds = readdirSync(join(rw.userData, 'worlds'));
  expect(worldIds).toHaveLength(1);
  const worldDir = join(rw.userData, 'worlds', worldIds[0] as string);
  const packBytes = readFileSync(join(worldDir, 'pack.json'));
  const expected = JSON.stringify(generateCampaign({ theme, seed: 42, knobs: DEFAULT_KNOBS }));
  expect(packBytes.equals(Buffer.from(expected, 'utf8'))).toBe(true);
  const worldDoc = JSON.parse(readFileSync(join(worldDir, 'world.json'), 'utf8')) as Record<string, unknown>;
  expect(worldDoc.packSha256).toBe(createHash('sha256').update(packBytes).digest('hex'));
  expect(worldDoc).toMatchObject({ id: worldIds[0], theme: 'dark-fantasy', seed: 42, knobs: DEFAULT_KNOBS });

  // Restart on the same userData: listed, and reopened via lastWorldId (pack re-validated).
  await rw.restart();
  const reopened = rw.page;
  await expect(reopened.getByTestId('world-row')).toHaveCount(1);
  await expect(reopened.getByTestId('world-row')).toContainText('dark-fantasy · 42');
  await expect(reopened.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await expect(reopened.getByTestId('active-world-name')).toHaveText('dark-fantasy · 42');

  // Rejection path: the library's own cards, verbatim; inputs kept; nothing persisted.
  const rejection = libraryRejection({ ...DEFAULT_KNOBS, 'spell-density': 99 });
  const card = rejection.errors[0];
  expect(card?.rule).toBe('E-SCHEMA-01');
  await reopened.getByTestId('roll-theme-dark-fantasy').click();
  await reopened.getByTestId('roll-seed').fill('42');
  await reopened.getByTestId('roll-knob-spell-density').fill('99');
  await reopened.getByTestId('roll-forge').click();
  await expect(reopened.getByTestId('roll-error')).toContainText(card?.message ?? '<missing card>');
  await expect(reopened.getByTestId('roll-error')).toContainText('E-SCHEMA-01');
  await expect(reopened.getByTestId('roll-seed')).toHaveValue('42');
  await expect(reopened.getByTestId('roll-knob-spell-density')).toHaveValue('99');
  await expect(reopened.getByTestId('world-row')).toHaveCount(1);
  expect(readdirSync(join(rw.userData, 'worlds'))).toHaveLength(1);

  // FR-17: only local URLs were requested; CSP meta is in force.
  expect(rw.requests.length).toBeGreaterThan(0);
  const remote = rw.requests.filter((u) => !/^(file|devtools|data):/.test(u));
  expect(remote).toEqual([]);
  const csp = await reopened.evaluate(
    () => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? '',
  );
  expect(csp).toContain("default-src 'self'");
});
