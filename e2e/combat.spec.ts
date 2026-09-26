/**
 * CAP-09 (FR-11–13; CA-05, CA-07, CA-08) through the real built app: fight assembly from the active character
 * plus bestiary spawns, the declare/step/respond loop to `combat-over`, and the provenanced log. Every
 * expected value comes from the same library calls made in the test process on the stored pack bytes.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Runtime, createCharacter, profileFromCharacter, spawnMonster, startCombat, type Combat, type RuntimeEvent } from 'ruleswright/runtime';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const SHOTS = process.env.RW_SHOTS_DIR;

type Entry =
  | { op: 'declare'; actionId: string; targetId?: string }
  | { op: 'respond'; triggerId: string; choice: 'decline' }
  | { op: 'step' };

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

function packOf(userData: string): unknown {
  const dir = join(userData, 'worlds');
  const [id] = readdirSync(dir);
  if (!id) throw new Error('no world on disk');
  return JSON.parse(readFileSync(join(dir, id, 'pack.json'), 'utf8'));
}

/** The same fight the app starts: Brynn (profileFromCharacter, id `brynn`) vs two spawned wights. */
function referenceFight(pack: unknown): { fight: Combat; events: RuntimeEvent[] } {
  const rt = new Runtime(pack as ConstructorParameters<typeof Runtime>[0]);
  const ally = profileFromCharacter(rt, createCharacter(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }), 'brynn');
  const events: RuntimeEvent[] = [];
  rt.events.on((e) => events.push(e));
  const enemies = ['barrow-wight-1', 'barrow-wight-2'].map((id) => ({ id, profile: spawnMonster(rt, 'barrow-wight', id) }));
  return { fight: startCombat(rt, { allies: [{ id: 'brynn', ...ally }], enemies }), events };
}

/** Policy: decline the first open offer; else declare the active's k-th action at its first standing foe; else step. */
function nextEntry(fight: Combat, tried: number): Entry {
  const { combatants, order, active, phase } = fight.state;
  const offer = fight.pendingTriggers[0];
  if (offer) return { op: 'respond', triggerId: offer.triggerId, choice: 'decline' };
  const side = (id: string) => combatants[id]?.side;
  const targetId = order.find((o) => side(o) !== side(active) && (combatants[o]?.hp.current ?? 0) > 0);
  const actionId = combatants[active]?.actions[tried];
  if (phase === 'awaiting-declare' && actionId !== undefined) return { op: 'declare', actionId, targetId };
  return { op: 'step' };
}

/** One host call on the reference fight; returns only this call's events (the library returns the round's). */
function apply(ref: { fight: Combat; events: RuntimeEvent[] }, e: Entry): RuntimeEvent[] {
  const from = ref.events.length;
  if (e.op === 'declare') ref.fight.declare(e.actionId, e.targetId === undefined ? {} : { targetId: e.targetId });
  else if (e.op === 'respond') ref.fight.respond(e.triggerId, e.choice);
  else ref.fight.step();
  return ref.events.slice(from);
}

async function perform(page: Page, e: Entry): Promise<void> {
  if (e.op === 'declare') {
    await page.getByTestId('combat-declare-select').selectOption(e.actionId);
    await page.getByTestId('combat-target-select').selectOption(e.targetId ?? '');
    await page.getByTestId('combat-declare').click();
  } else if (e.op === 'respond') {
    await page.getByTestId('combat-trigger-decline-0').click();
  } else {
    await page.getByTestId('combat-step').click();
  }
}

async function controlFacts(page: Page) {
  return {
    phase: await page.getByTestId('combat-phase').textContent(),
    round: await page.getByTestId('combat-round').textContent(),
    active: await page.getByTestId('combat-active').textContent(),
    combatants: await page.locator('[data-testid^="combat-combatant-"]').allTextContents(),
  };
}

/** Layout evidence without an image viewer: no horizontal overflow; log and control column disjoint. */
async function layoutFacts(page: Page) {
  return page.evaluate(() => {
    const log = document.querySelector('[data-testid="combat-log"]')?.getBoundingClientRect();
    const column = document.querySelector('.combat-column')?.getBoundingClientRect();
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columnRightOfLog: !!log && !!column && column.left >= log.right - 1,
      columnBelowLog: !!log && !!column && column.top >= log.bottom - 1,
    };
  });
}

test('CAP-09: assemble Brynn vs 2 wights, declare/step/decline to combat-over, every event verbatim', async ({ rw }) => {
  const page = rw.page;

  // Forge dark-fantasy · 42 and create Brynn (hillfolk · warden 1).
  await page.getByTestId('nav-roll').click();
  await page.getByTestId('roll-theme-dark-fantasy').click();
  await page.getByTestId('roll-seed').fill('42');
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await page.getByTestId('nav-fight').click();
  await expect(page.getByTestId('empty-state')).toHaveAttribute('data-kind', 'no-character');
  await page.getByTestId('nav-character').click();
  await page.getByTestId('char-name').fill('Brynn');
  await page.getByTestId('char-race').selectOption('hillfolk');
  await page.getByTestId('char-class').selectOption('warden');
  await page.getByTestId('char-level').fill('1');
  await page.getByTestId('char-create').click();
  await expect(page.getByTestId('char-hp')).toHaveText('27');

  // Fight assembly: the ally is the character; enemies are bestiary spawns.
  await page.getByTestId('nav-fight').click();
  await expect(page.getByTestId('fight-ally')).toContainText('hillfolk · warden 1 · hp 27 · ac 12');
  await expect(page.getByTestId('fight-spatial')).toHaveText('theater-of-mind · seed 42');
  await expect(page.getByTestId('fight-begin')).toBeDisabled();
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  await page.getByTestId('fight-add-enemy-submit').click();
  await page.getByTestId('fight-add-enemy-submit').click();
  await page.getByTestId('fight-add-enemy-submit').click();
  await page.getByTestId('fight-enemy-remove-barrow-wight-3').click();
  await expect(page.locator('[data-testid^="fight-enemy-barrow-wight-"]')).toHaveCount(2);
  await shot(page, 'fight-assembly-fantasy-wide');
  await page.getByTestId('fight-begin').click();

  // Initial state renders immediately (FR-11); the first row is combat:start with its rolls verbatim.
  const ref = referenceFight(packOf(rw.userData));
  const start = ref.events[0];
  if (!start) throw new Error('no combat:start in the reference fight');
  await expect(page.getByTestId('combat-phase')).toHaveText('awaiting-declare');
  await expect(page.getByTestId('combat-round')).toHaveText(`round ${ref.fight.state.round}`);
  await expect(page.getByTestId('combat-active')).toHaveText(`active: ${ref.fight.state.active}`);
  const rows = page.getByTestId('combat-event');
  await expect(rows).toHaveCount(ref.events.length);
  await expect(rows.first()).toHaveAttribute('data-type', 'combat:start');
  await expect(rows.first().locator('.event-rolls')).toHaveText(start.why.rolls.join(' · '));
  await expect(rows.first().locator('.event-why')).toHaveText(`why.rule · ${start.why.rule}`);

  // Drive the loop through the UI with the reference policy, one call at a time, rows in lockstep.
  // On Brynn's first turn (two opponents stand, no offer open) probe the UI-reachable rejections (CA-05).
  const run = async (entry: Entry): Promise<readonly RuntimeEvent[]> => {
    const out = apply(ref, entry);
    await perform(page, entry);
    await expect(rows).toHaveCount(ref.events.length);
    return out;
  };
  const rejectedBy = async (entry: Entry, kind: string): Promise<void> => {
    const before = await controlFacts(page);
    const rejection = (await run(entry)).find((e) => e.type === 'declare:rejected');
    if (!rejection) throw new Error(`the reference fight accepted ${JSON.stringify(entry)}`);
    expect(rejection.payload.kind).toBe(kind);
    const card = page.getByTestId('combat-rejection');
    await expect(card).toContainText(String(rejection.payload.message));
    await expect(card).toContainText(rejection.why.rule);
    expect(await controlFacts(page)).toEqual(before);
  };
  let tried = 0;
  let steps = 0;
  let probed = false;
  let sawOffer = false;
  while (ref.fight.state.phase !== 'combat-over' && steps < 500) {
    const { active, phase, combatants } = ref.fight.state;
    if (!probed && active === 'brynn' && phase === 'awaiting-declare' && ref.fight.pendingTriggers.length === 0) {
      probed = true;
      const actionId = combatants.brynn?.actions[0] as string;
      await rejectedBy({ op: 'declare', actionId }, 'no-target');
      await shot(page, 'combat-rejection-fantasy-wide');
      const aimed = nextEntry(ref.fight, 0);
      expect((await run(aimed)).some((e) => e.type === 'declare:rejected')).toBe(false);
      await expect(page.getByTestId('combat-rejection')).toHaveCount(0);
      // Offers opened by the strike lock Declare (DF-1); declining them keeps the turn, so the slot stays spent.
      for (let offer = ref.fight.pendingTriggers[0]; offer; offer = ref.fight.pendingTriggers[0]) {
        await run({ op: 'respond', triggerId: offer.triggerId, choice: 'decline' });
      }
      await rejectedBy(aimed, 'slot-exhausted');
      continue;
    }
    const entry = nextEntry(ref.fight, tried);
    const offer = ref.fight.pendingTriggers[0];
    if (offer && !sawOffer) {
      sawOffer = true;
      await expect(page.getByTestId('combat-offers')).toBeVisible();
      await expect(page.getByTestId('combat-trigger-0')).toContainText(`${offer.actorId} · ${offer.actionId}`);
      await expect(page.getByTestId('combat-trigger-0')).toContainText(`on ${offer.matchingEvent}`);
      await expect(page.getByTestId('combat-declare')).toBeDisabled();
      await expect(page.getByTestId('combat-step')).toBeDisabled();
      await shot(page, 'combat-offers-fantasy-wide');
    }
    const out = await run(entry);
    if (entry.op === 'step') {
      steps += 1;
      tried = 0;
    } else if (entry.op === 'declare') tried = out.some((e) => e.type === 'declare:rejected') ? tried + 1 : 0;
  }
  expect(probed).toBe(true);
  expect(ref.fight.state.phase).toBe('combat-over');
  expect(sawOffer).toBe(true);

  // Combat end is announced from the library's combat:ended event; controls are disabled; the log stays.
  const ended = ref.events.find((e) => e.type === 'combat:ended');
  if (!ended) throw new Error('no combat:ended in the reference fight');
  const banner = page.getByTestId('combat-over');
  await expect(banner).toContainText(`winner ${String(ended.payload.winner)} · defeated ${String(ended.payload.defeated)}`);
  await expect(banner).toContainText(`combat:ended · why.rule ${ended.why.rule}`);
  await expect(page.getByTestId('combat-phase')).toHaveText('combat-over');
  await expect(page.getByTestId('combat-declare')).toBeDisabled();
  await expect(page.getByTestId('combat-step')).toBeDisabled();

  // Every row: type, rolls and why.rule verbatim, in order; nothing dropped.
  await expect(rows).toHaveCount(ref.events.length);
  expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-type')))).toEqual(ref.events.map((e) => e.type));
  expect(await page.locator('[data-testid="combat-event"] .event-why').allTextContents()).toEqual(
    ref.events.map((e) => `why.rule · ${e.why.rule}`),
  );
  expect(await page.locator('[data-testid="combat-event"] .event-rolls').allTextContents()).toEqual(
    ref.events.filter((e) => e.why.rolls.length > 0).map((e) => e.why.rolls.join(' · ')),
  );
  expect(await layoutFacts(page)).toMatchObject({ overflowX: 0, columnRightOfLog: true });
  await shot(page, 'combat-over-fantasy-wide');

  // The round filter keeps exactly that round's rows (negative control: fewer than the whole log).
  const inRound1 = ref.events.filter((e) => e.at.round === 1);
  await page.getByTestId('combat-filter-round').selectOption('1');
  await expect(rows).toHaveCount(inRound1.length);
  expect(inRound1.length).toBeLessThan(ref.events.length);
  expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-round')))).toEqual(inRound1.map(() => '1'));
  await page.getByTestId('combat-filter-type').selectOption('attack:rolled');
  await expect(rows).toHaveCount(inRound1.filter((e) => e.type === 'attack:rolled').length);
  await page.getByTestId('combat-filter-round').selectOption('all');
  await page.getByTestId('combat-filter-type').selectOption('all');
  await expect(rows).toHaveCount(ref.events.length);

  // Narrow layout class: the control column stacks under the log with no horizontal overflow.
  await page.setViewportSize({ width: 900, height: 800 });
  expect(await layoutFacts(page)).toMatchObject({ overflowX: 0, columnBelowLog: true });
  await shot(page, 'combat-over-fantasy-narrow');
  await page.getByTestId('combat-back').click();
  await expect(page.getByTestId('fight-surface')).toBeVisible();
  await shot(page, 'fight-assembly-fantasy-narrow');
});
