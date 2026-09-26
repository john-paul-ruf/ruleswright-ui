/**
 * CAP-04 — shell, navigation, empty states, mood (CA-10), error surfacing (CA-05), offline (FR-17),
 * through the real built app on an isolated userData dir with the real engine.
 */
import { GenerationError, generateCampaign, listThemeKnobs, loadTheme } from 'ruleswright/compiler';
import { expect, test, type RulesWrightApp } from './fixtures';
import type { Page } from '@playwright/test';

const NO_WORLD = ['No world yet', 'Roll one, or import a pack.'];
const NO_CHARACTER = ['No character in this world yet', 'Create one.'];

async function forge(page: Page, themeId: string, seed: string): Promise<void> {
  await page.getByTestId('nav-roll').click();
  await page.getByTestId(`roll-theme-${themeId}`).click();
  await page.getByTestId('roll-seed').fill(seed);
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText(`${themeId} · ${seed}`);
}

const cssVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

function expectOnlyLocalRequests(rw: RulesWrightApp): void {
  expect(rw.requests.length).toBeGreaterThan(0);
  expect(rw.requests.filter((u) => !/^(file|devtools|data):/.test(u))).toEqual([]);
}

test('CAP-04: no world — archive mood, empty states route back, keyboard focus, reduced motion', async ({ rw }) => {
  const { page } = rw;
  await expect(page.getByTestId('nav-roll')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'archive');
  await expect(page.getByTestId('active-world-name')).toHaveCount(0);

  // Keyboard: the first Tab stop from the document is the Roll nav, with a visible focus ring.
  await expect(page.locator('body')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('nav-roll')).toBeFocused();
  const outline = await page.getByTestId('nav-roll').evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).toBe('1px');
  expect(outline.color).toBe('rgb(200, 168, 106)'); // archive --accent #c8a86a

  for (const surface of ['world', 'character', 'fight']) {
    await page.getByTestId(`nav-${surface}`).click();
    await expect(page.getByTestId(`nav-${surface}`)).toHaveAttribute('aria-current', 'page');
    const empty = page.getByTestId('empty-state');
    await expect(empty).toBeVisible();
    for (const text of NO_WORLD) await expect(empty).toContainText(text);
    await empty.getByRole('button', { name: 'Go to Roll →' }).click();
    await expect(page.getByTestId('roll-forge')).toBeVisible();
    await expect(page.getByTestId('nav-roll')).toHaveAttribute('aria-current', 'page');
  }

  // Motion: the mood crossfade runs by default and is instant under reduced motion.
  const duration = () => page.evaluate(() => getComputedStyle(document.documentElement).transitionDuration);
  expect(await duration()).not.toBe('0s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await duration()).toBe('0s');

  expectOnlyLocalRequests(rw);
});

test('CAP-04: mood follows the open world, bundled fonts, error card, world empty states', async ({ rw }) => {
  const { page } = rw;

  // dark-fantasy → fantasy (CA-10), with the fantasy accent and the bundled Cinzel face.
  await forge(page, 'dark-fantasy', '7');
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'fantasy');
  expect(await cssVar(page, '--accent')).toBe('#d8a94e');
  await expect(page.getByTestId('active-world-name')).toHaveText('dark-fantasy · 7');
  const cinzel = await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = [...document.fonts].some((f) => f.family === 'Cinzel' && f.weight === '600' && f.status === 'loaded');
    return { check: document.fonts.check('600 16px Cinzel'), loaded };
  });
  expect(cinzel).toEqual({ check: true, loaded: true });

  // zombie-urban → urban.
  await forge(page, 'zombie-urban', '7');
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'urban');
  expect(await cssVar(page, '--accent')).toBe('#e56432');
  await expect(page.getByTestId('active-world-seed')).toHaveText('zombie-urban · 7');

  // Opening the other world switches the mood back.
  await page.getByTestId('world-row').filter({ hasText: 'dark-fantasy · 7' }).getByTestId('world-open').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 7');
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'fantasy');

  // With a world open, Character and Fight show the no-character state; its CTA routes to Character.
  for (const surface of ['character', 'fight']) {
    await page.getByTestId(`nav-${surface}`).click();
    const empty = page.getByTestId('empty-state');
    for (const text of NO_CHARACTER) await expect(empty).toContainText(text);
  }
  await page.getByTestId('empty-state').getByRole('button', { name: 'Go to Character →' }).click();
  await expect(page.getByTestId('nav-character')).toHaveAttribute('aria-current', 'page');
  // The world name and params stay visible on every surface.
  await expect(page.getByTestId('active-world-name')).toHaveText('dark-fantasy · 7');

  // CA-05: a library rejection renders through ErrorCard with the card verbatim.
  const theme = loadTheme('dark-fantasy');
  const knobs = { ...Object.fromEntries(listThemeKnobs(theme).map((k) => [k.id, k.default])), 'spell-density': 99 };
  let rejection: GenerationError | undefined;
  try {
    generateCampaign({ theme, seed: 7, knobs });
  } catch (e) {
    if (e instanceof GenerationError) rejection = e;
  }
  const card = rejection?.errors[0];
  expect(card).toBeDefined();
  await page.getByTestId('nav-roll').click();
  await page.getByTestId('roll-theme-dark-fantasy').click();
  await page.getByTestId('roll-seed').fill('7');
  await page.getByTestId('roll-knob-spell-density').fill('99');
  await page.getByTestId('roll-forge').click();
  const errorCard = page.getByTestId('roll-error').getByTestId('error-card');
  await expect(errorCard).toHaveAttribute('data-kind', 'library');
  await expect(errorCard).toContainText(`forge · ${rejection?.name ?? '<missing>'}`);
  await expect(errorCard).toContainText(card?.rule ?? '<missing>');
  await expect(errorCard).toContainText(card?.jsonPath ?? '<missing>');
  await expect(errorCard).toContainText(card?.message ?? '<missing>');
  if (card?.hint !== undefined) await expect(errorCard).toContainText(card.hint);

  expectOnlyLocalRequests(rw);
});
