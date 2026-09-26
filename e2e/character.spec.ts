/**
 * CAP-07 (character lifecycle, FR-6–9) and CAP-08 / CA-06 (snapshots, FR-10) through the real built app:
 * real engine in the renderer, real fs in main, isolated userData, restart on the same dir.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Runtime, serializeCharacter } from 'ruleswright/runtime';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const SHOTS = process.env.RW_SHOTS_DIR;

async function forge(page: Page, themeId: string, seed: string): Promise<void> {
  await page.getByTestId('nav-roll').click();
  await page.getByTestId(`roll-theme-${themeId}`).click();
  await page.getByTestId('roll-seed').fill(seed);
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText(`${themeId} · ${seed}`);
}

async function createCharacter(page: Page, name: string, race: string, cls: string, level: string): Promise<void> {
  await page.getByTestId('char-name').fill(name);
  await page.getByTestId('char-race').selectOption(race);
  await page.getByTestId('char-class').selectOption(cls);
  await page.getByTestId('char-level').fill(level);
  await page.getByTestId('char-create').click();
}

/** The world id whose world.json records `theme · seed` (userData layout from database.md). */
function worldIdFor(userData: string, seed: number): string {
  const dir = join(userData, 'worlds');
  const id = readdirSync(dir).find((d) => JSON.parse(readFileSync(join(dir, d, 'world.json'), 'utf8')).seed === seed);
  if (!id) throw new Error(`no world with seed ${seed}`);
  return id;
}

/** Layout evidence without an image viewer: no horizontal overflow, the two columns are disjoint. */
async function layoutFacts(page: Page) {
  return page.evaluate(() => {
    const [sheet, side] = [...document.querySelectorAll('.char-grid > .char-column')].map((e) => e.getBoundingClientRect());
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sideBelowSheet: !!sheet && !!side && side.top >= sheet.bottom - 1,
      sideRightOfSheet: !!sheet && !!side && side.left >= sheet.right - 1,
    };
  });
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

test('CAP-07 + CAP-08: create, play, snapshot, restart, restore, cross-world E-SNAP-01', async ({ rw }) => {
  let page = rw.page;

  // 1. Forge dark-fantasy · 42 → Character → create Brynn → derived hp 27 / ac 12.
  await forge(page, 'dark-fantasy', '42');
  await page.getByTestId('nav-character').click();
  await expect(page.getByTestId('empty-state')).toHaveAttribute('data-kind', 'no-character');
  await createCharacter(page, 'Brynn', 'hillfolk', 'warden', '1');
  await expect(page.getByTestId('char-hp')).toHaveText('27');
  await expect(page.getByTestId('char-ac')).toHaveText('12');
  await expect(page.getByTestId('empty-state')).toHaveCount(0);
  await expect(page.getByTestId('char-pool-ember')).toHaveText('18 / 18 at rest');
  expect(await layoutFacts(page)).toMatchObject({ overflowX: 0, sideRightOfSheet: true });
  await shot(page, 'character-fantasy-wide');

  // Replacing the character asks first; cancelling keeps Brynn and returns focus to the trigger.
  await page.getByTestId('char-name').fill('Other');
  await page.getByTestId('char-create').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Replace Brynn?');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('char-create')).toBeFocused();
  await expect(page.getByTestId('char-name-display')).toHaveText('Brynn');
  await page.getByTestId('char-name').fill('');

  // 2. Casting before preparing → the library's not-prepared card verbatim; prepare → cast → slot empties.
  await page.getByTestId('char-cast-ward-sigil').click();
  const notPrepared = page.getByTestId('error-card');
  await expect(notPrepared).toContainText('not-prepared');
  await expect(notPrepared).toContainText('"ward-sigil" is not bound in any level-1 slot — an empty slot cannot cast (FR-8).');
  await expect(page.getByTestId('char-slot-1-0')).toHaveText('empty');
  await page.getByTestId('char-prepare-ward-sigil').click();
  await expect(page.getByTestId('error-card')).toHaveCount(0);
  await expect(page.getByTestId('char-slot-1-0')).toHaveText('ward-sigil');
  await page.getByTestId('char-cast-ward-sigil').click();
  await expect(page.getByTestId('char-slot-1-0')).toHaveText('empty');
  await expect(page.getByTestId('error-card')).toHaveCount(0);

  // 3. Sapped restricts strike; explicit ticks expire it.
  await page.getByTestId('char-condition-select').selectOption('sapped');
  await page.getByTestId('char-apply-condition').click();
  await expect(page.getByTestId('char-condition-sapped')).toHaveText('3 ticks left');
  await expect(page.getByTestId('char-restricted-actions')).toContainText('strike');
  await shot(page, 'character-fantasy-sapped');
  for (let i = 0; i < 10 && (await page.getByTestId('char-condition-sapped').count()) > 0; i++) {
    await page.getByTestId('char-tick').click();
  }
  await expect(page.getByTestId('char-condition-sapped')).toHaveCount(0);
  await expect(page.getByTestId('char-restricted-actions')).toHaveText('—');

  // 4. Award 2500 XP → level 2, hp 28.
  await page.getByTestId('char-xp-amount').fill('2500');
  await page.getByTestId('char-award-xp').click();
  await expect(page.getByTestId('char-class-warden')).toHaveText('Warden 2');
  await expect(page.getByTestId('char-hp')).toHaveText('28');

  // 5. Save `pre-combat` → the file is the verbatim serializeCharacter envelope keyed by its own pack block.
  await page.getByTestId('char-snapshot-name').fill('pre-combat');
  await page.getByTestId('char-snapshot-save').click();
  const packLine = page.getByTestId('char-snapshot-pack-pre-combat');
  await expect(packLine).toBeVisible();
  const world42 = worldIdFor(rw.userData, 42);
  const doc = JSON.parse(readFileSync(join(rw.userData, 'snapshots', world42, 'pre-combat.json'), 'utf8'));
  const rt = new Runtime(JSON.parse(readFileSync(join(rw.userData, 'worlds', world42, 'pack.json'), 'utf8')));
  const replay = rt.createCharacter({ name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] });
  replay.prepare('ward-sigil');
  replay.cast('ward-sigil');
  replay.applyCondition('sapped');
  while (replay.state.conditions.length > 0) replay.tick();
  rt.awardXp(replay, 2500);
  const expected = serializeCharacter(rt, replay.state);
  expect(doc.snapshot).toEqual(expected);
  expect(doc.snapshot.kind).toBe('character');
  expect(doc.snapshot.pack.contentHash).toMatch(/^[0-9a-f]{8}$/);
  expect(doc.packIdentity).toEqual(doc.snapshot.pack);
  const { id, schemaVersion, contentHash } = doc.packIdentity;
  await expect(packLine).toHaveText(`pack ${id} · schema ${schemaVersion} · ${contentHash}`);
  await shot(page, 'character-fantasy-snapshot');

  // 6. Restart → the world reopens, the character is gone (session-scoped, D-07) → restore → level 2, hp 28.
  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await page.getByTestId('nav-character').click();
  await expect(page.getByTestId('empty-state')).toHaveAttribute('data-kind', 'no-character');
  await page.getByTestId('char-snapshot-load-pre-combat').click();
  await expect(page.getByTestId('char-class-warden')).toHaveText('Warden 2');
  await expect(page.getByTestId('char-hp')).toHaveText('28');

  // 7. The snapshot handed to world dark-fantasy · 43 → E-SNAP-01 card, no character.
  await forge(page, 'dark-fantasy', '43');
  const world43 = worldIdFor(rw.userData, 43);
  mkdirSync(join(rw.userData, 'snapshots', world43), { recursive: true });
  // Storage requires the envelope's worldId to match its directory; the snapshot body stays verbatim.
  writeFileSync(join(rw.userData, 'snapshots', world43, 'pre-combat.json'), JSON.stringify({ ...doc, worldId: world43 }, null, 2));
  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 43');
  await page.getByTestId('nav-character').click();
  await page.getByTestId('char-snapshot-load-pre-combat').click();
  const refused = page.getByTestId('error-card');
  await expect(refused).toContainText('E-SNAP-01');
  await expect(refused).toContainText('snapshot:restore · RuntimeRuleError');
  await expect(page.getByTestId('char-hp')).toHaveCount(0);
  await expect(page.getByTestId('empty-state')).toHaveAttribute('data-kind', 'no-character');
  await shot(page, 'character-fantasy-esnap');
});

test('CAP-07: zombie-urban shows its pools and an honest empty spell state; the build validator reports live', async ({ rw }) => {
  const { page } = rw;
  await forge(page, 'zombie-urban', '42');
  await page.getByTestId('nav-character').click();
  await expect(page.locator('html')).toHaveAttribute('data-mood', 'urban');

  // Live validateBuild feedback: an out-of-range level shows the library's cards before creating.
  await page.getByTestId('char-level').fill('99');
  await expect(page.getByTestId('error-card')).toContainText('missing-progression');
  await page.getByTestId('char-level').fill('1');
  await expect(page.getByTestId('error-card')).toHaveCount(0);

  await createCharacter(page, 'Rook', 'mile-born', 'scavenger', '1');
  await expect(page.getByTestId('char-spells-empty')).toContainText('No known spells');
  await expect(page.locator('[data-testid^="char-cast-"]')).toHaveCount(0);
  await expect(page.getByTestId('char-pool-adrenaline')).toHaveText('18 / 18 at rest');
  await expect(page.getByTestId('char-pool-stamina')).toHaveText('18 / 18 at rest');

  // Pools drain and reject through the library; rest refills.
  await page.getByTestId('char-spend-amount-stamina').fill('5');
  await page.getByTestId('char-spend-stamina').click();
  await expect(page.getByTestId('char-pool-stamina')).toHaveText('13 / 18 at rest');
  await page.getByTestId('char-spend-amount-stamina').fill('9999');
  await page.getByTestId('char-spend-stamina').click();
  await expect(page.getByTestId('error-card')).toContainText('insufficient-points');
  await expect(page.getByTestId('char-pool-stamina')).toHaveText('13 / 18 at rest');
  await page.getByTestId('char-rest').click();
  await expect(page.getByTestId('char-pool-stamina')).toHaveText('18 / 18 at rest');

  expect(await layoutFacts(page)).toMatchObject({ overflowX: 0, sideRightOfSheet: true });
  await shot(page, 'character-urban-wide');

  // Below the mock's lg breakpoint the side column stacks under the sheet.
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(() => layoutFacts(page)).toMatchObject({ overflowX: 0, sideBelowSheet: true });
  await shot(page, 'character-urban-narrow');
});
