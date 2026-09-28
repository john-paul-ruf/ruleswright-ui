/**
 * CAP-09 (FR-11–13; CA-05, CA-07, CA-08), CAP-06 (FR-11 grid; CA-12, CA-13, CA-15), CAP-01/02 (FR-11/12/16;
 * CA-01..04) and CAP-03 (FR-11 ally spawns; CA-04b, CA-12) through the real built app: fight assembly from the active character plus bestiary spawns, placement,
 * the declare/step/respond loop to `combat-over`, the board and reposition, turn order, initiative, slot ledgers,
 * conditions, action detail, and the provenanced log. Every expected value comes from the same
 * library calls made in the test process on the stored pack bytes, at the positions the UI shows before Begin.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import {
  Runtime,
  createCharacter,
  deserializeCombat,
  profileFromCharacter,
  resolveSlotGrants,
  serializeCombat,
  spawnMonster,
  startCombat,
  type Combat,
  type CombatantProfile,
  type Position,
  type RuntimeEvent,
} from 'ruleswright/runtime';
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

type Positions = Record<string, Position>;

interface Reference {
  fight: Combat;
  events: RuntimeEvent[];
  /** The sides as `startCombat` took them (the reposition seam re-states them). */
  sides: { id: string; profile: CombatantProfile }[][];
}

/**
 * The same fight the app starts: Brynn (profileFromCharacter, id `brynn`) plus `allySpawns` after her vs `wights`
 * spawned barrow-wights, at `positions` (what the placement board showed; absent on a theater-of-mind pack).
 */
function referenceFight(pack: unknown, wights = 2, positions?: Positions, allySpawns: { statblockId: string; instanceId: string }[] = []): Reference {
  const rt = new Runtime(pack as ConstructorParameters<typeof Runtime>[0]);
  const ally = profileFromCharacter(rt, createCharacter(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }), 'brynn');
  const events: RuntimeEvent[] = [];
  rt.events.on((e) => events.push(e));
  const enemies = Array.from({ length: wights }, (_, i) => `barrow-wight-${i + 1}`).map((id) => ({
    id,
    profile: spawnMonster(rt, 'barrow-wight', id),
  }));
  const spawns = allySpawns.map((a) => ({ id: a.instanceId, profile: spawnMonster(rt, a.statblockId, a.instanceId) }));
  const fight = startCombat(rt, { allies: [{ id: 'brynn', ...ally }, ...spawns], enemies, ...(positions ? { positions } : {}) });
  return { fight, events, sides: [[{ id: 'brynn', profile: ally.profile }, ...spawns], enemies] };
}

/** Reposition on the reference: serialize → restore at `positions`, every combatant's live balances re-stated. */
function moveReference(ref: Reference, positions: Positions): void {
  const { fight } = ref;
  const restate = (side: { id: string; profile: CombatantProfile }[]) =>
    side.map(({ id, profile }) => {
      const c = fight.state.combatants[id];
      return { id, profile, balances: { pools: structuredClone(c?.pools ?? {}), boundSlots: structuredClone(c?.boundSlots ?? {}) } };
    });
  const [allies = [], enemies = []] = ref.sides;
  const snap = serializeCombat(fight, { pairsWith: 'brynn' });
  ref.fight = deserializeCombat(fight.runtime, snap, { allies: restate(allies), enemies: restate(enemies), positions });
}

/** The placement the board shows before Begin, read from its rows (never assumed). */
async function placed(page: Page): Promise<Positions> {
  const rows = page.locator('[data-testid^="fight-place-"][data-x]');
  const all = await rows.evaluateAll((els) =>
    els.map((el) => [el.getAttribute('data-testid')?.slice('fight-place-'.length) ?? '', { x: Number(el.getAttribute('data-x')), y: Number(el.getAttribute('data-y')) }] as const),
  );
  return Object.fromEntries(all);
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
function apply(ref: Reference, e: Entry): RuntimeEvent[] {
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

/** Forge dark-fantasy · 42 and create Brynn (hillfolk · warden 1); Fight shows no-character before that. */
async function forgeWithBrynn(page: Page): Promise<void> {
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
}

/** Fight → add `n` barrow-wights → Begin; returns the placement the board showed. */
async function beginAgainstWights(page: Page, n: number): Promise<Positions> {
  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  for (let i = 0; i < n; i += 1) await page.getByTestId('fight-add-enemy-submit').click();
  const positions = await placed(page);
  await page.getByTestId('fight-begin').click();
  await expect(page.getByTestId('combat-phase')).toHaveText('awaiting-declare');
  return positions;
}

/** Keyboard only: Tab until the control with `testId` has focus (bounded). */
async function tabTo(page: Page, testId: string): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    if ((await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid)) === testId) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached ${testId}`);
}

/** Keyboard only: choose an option of a focused select by typing its label (type-ahead, no popup). */
async function typeInto(page: Page, testId: string, label: string, value: string): Promise<void> {
  await tabTo(page, testId);
  await page.keyboard.type(label);
  await expect(page.getByTestId(testId)).toHaveValue(value);
}

test('CAP-09: assemble Brynn vs 2 wights, declare/step/decline to combat-over, every event verbatim', async ({ rw }) => {
  const page = rw.page;

  await forgeWithBrynn(page);

  // Fight assembly: the ally is the character; enemies are bestiary spawns.
  await page.getByTestId('nav-fight').click();
  await expect(page.getByTestId('fight-ally')).toContainText('hillfolk · warden 1 · hp 27 · ac 12');
  await expect(page.getByTestId('fight-spatial')).toHaveText('grid · seed 42');
  await expect(page.getByTestId('fight-begin')).toBeDisabled();
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  await page.getByTestId('fight-add-enemy-submit').click();
  await page.getByTestId('fight-add-enemy-submit').click();
  await page.getByTestId('fight-add-enemy-submit').click();
  await page.getByTestId('fight-enemy-remove-barrow-wight-3').click();
  await expect(page.locator('[data-testid^="fight-enemy-barrow-wight-"]')).toHaveCount(2);
  await shot(page, 'fight-assembly-fantasy-wide');
  const positions = await placed(page);
  await page.getByTestId('fight-begin').click();

  // Initial state renders immediately (FR-11); the first row is combat:start with its rolls verbatim.
  const ref = referenceFight(packOf(rw.userData), 2, positions);
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

test('keyboard only: one full round by Tab, Enter and select type-ahead, rows in lockstep with the library', async ({ rw }) => {
  const page = rw.page;
  await forgeWithBrynn(page);
  const positions = await beginAgainstWights(page, 2);
  const ref = referenceFight(packOf(rw.userData), 2, positions);
  const rows = page.getByTestId('combat-event');
  await expect(rows).toHaveCount(ref.events.length);

  let tried = 0;
  for (let calls = 0; !ref.events.some((e) => e.type === 'round:completed'); calls += 1) {
    if (calls > 200) throw new Error('round 1 never completed');
    const entry = nextEntry(ref.fight, tried);
    const out = apply(ref, entry);
    if (entry.op === 'declare') {
      await typeInto(page, 'combat-declare-select', entry.actionId, entry.actionId);
      await typeInto(page, 'combat-target-select', entry.targetId ?? 'no target', entry.targetId ?? '');
      await tabTo(page, 'combat-declare');
      tried = out.some((e) => e.type === 'declare:rejected') ? tried + 1 : 0;
    } else if (entry.op === 'respond') {
      await tabTo(page, 'combat-trigger-decline-0');
    } else {
      await tabTo(page, 'combat-step');
      tried = 0;
    }
    await page.keyboard.press('Enter');
    await expect(rows).toHaveCount(ref.events.length);
  }
  expect(await page.evaluate(() => document.activeElement?.matches(':focus-visible'))).toBe(true);
  await expect(page.getByTestId('combat-round')).toHaveText(`round ${ref.fight.state.round}`);
  expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-type')))).toEqual(ref.events.map((e) => e.type));
  await shot(page, 'combat-keyboard-round-fantasy-wide');
});

/** Where the log's scroller is, and whether its newest row is inside the visible box. */
async function scrollFacts(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.combat-scroll') as HTMLElement;
    const all = el.querySelectorAll('[data-testid="combat-event"]');
    const newest = all[all.length - 1]?.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return {
      atTop: el.scrollTop === 0,
      atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 2,
      newestVisible: !!newest && newest.top >= box.top - 1 && newest.bottom <= box.bottom + 1,
    };
  });
}

test('a 500-event log keeps every row, follows the newest row at the bottom, and never yanks a reader who scrolled up', async ({ rw }) => {
  const page = rw.page;
  await forgeWithBrynn(page);
  const positions = await beginAgainstWights(page, 4);
  const ref = referenceFight(packOf(rw.userData), 4, positions);
  const rows = page.getByTestId('combat-event');

  // Seed a long log: Step while awaiting a declare re-emits `turn:began` without advancing (a real library event).
  await page.getByTestId('combat-step').focus();
  while (ref.events.length < 500) {
    ref.fight.step();
    await page.keyboard.press('Enter');
  }
  await expect(rows).toHaveCount(ref.events.length);
  expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-type')))).toEqual(ref.events.map((e) => e.type));
  expect(await scrollFacts(page)).toEqual({ atTop: false, atBottom: true, newestVisible: true });
  await shot(page, 'combat-500-bottom-fantasy-wide');

  // Scrolled to the top, a new event lands without moving the reader.
  const log = page.locator('.combat-scroll');
  await log.hover();
  await page.mouse.wheel(0, -1_000_000);
  await expect.poll(async () => (await scrollFacts(page)).atTop).toBe(true);
  expect((await scrollFacts(page)).newestVisible).toBe(false);
  ref.fight.step();
  await page.getByTestId('combat-step').press('Enter');
  await expect(rows).toHaveCount(ref.events.length);
  expect(await scrollFacts(page)).toMatchObject({ atTop: true, newestVisible: false });
  await shot(page, 'combat-500-top-fantasy-wide');

  // Back at the bottom, the newest row is visible and new rows are followed again.
  await log.hover();
  await page.mouse.wheel(0, 1_000_000);
  await expect.poll(async () => (await scrollFacts(page)).atBottom).toBe(true);
  expect((await scrollFacts(page)).newestVisible).toBe(true);
  const started = Date.now();
  ref.fight.step();
  await page.getByTestId('combat-step').press('Enter');
  await expect(rows).toHaveCount(ref.events.length);
  const ms = Date.now() - started;
  expect(await scrollFacts(page)).toMatchObject({ atBottom: true, newestVisible: true });
  expect(ms).toBeLessThan(1000);
  expect(ref.events.length).toBeGreaterThan(500);
});

/** The positions every board token shows, by combatant id. */
async function tokens(page: Page): Promise<Positions> {
  const all = await page.locator('[data-testid^="combat-token-"]').evaluateAll((els) =>
    els.map((el) => [el.getAttribute('data-testid')?.slice('combat-token-'.length) ?? '', { x: Number(el.getAttribute('data-x')), y: Number(el.getAttribute('data-y')) }] as const),
  );
  return Object.fromEntries(all);
}

/** The library's positions (`state.combatants[id].position`), by combatant id. */
const positionsOf = (fight: Combat): Positions =>
  Object.fromEntries(Object.values(fight.state.combatants).flatMap((c) => (c.position ? [[c.id, { x: c.position.x, y: c.position.y }]] : [])));

test('CAP-06: grid fight — placement, board, validity and reach rejections, reposition with no events, lockstep to combat-over', async ({ rw }) => {
  const page = rw.page;
  await forgeWithBrynn(page);

  // Placement: Brynn vs one barrow-wight, the wight moved 5 squares away through its x input.
  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  await page.getByTestId('fight-add-enemy-submit').click();
  await expect(page.getByTestId('fight-placement')).toBeVisible();
  const home = await placed(page);
  const wight = home['barrow-wight-1'];
  if (!wight || !home.brynn) throw new Error('placement rows missing');
  await page.getByTestId('fight-place-barrow-wight-1-x').fill(String(home.brynn.x + 5));
  await expect(page.getByTestId('fight-place-barrow-wight-1')).toHaveAttribute('data-x', String(home.brynn.x + 5));
  const positions = await placed(page);
  expect(positions['barrow-wight-1']).toEqual({ x: home.brynn.x + 5, y: wight.y });
  await shot(page, 'fight-placement-fantasy-wide');
  await page.getByTestId('fight-begin').click();
  await expect(page.getByTestId('combat-phase')).toHaveText('awaiting-declare');

  // Board: tokens at the library's positions; the pack's spatial section verbatim; distances are the library's.
  const pack = packOf(rw.userData) as { spatial: unknown };
  const ref = referenceFight(pack, 1, positions);
  const rows = page.getByTestId('combat-event');
  await expect(rows).toHaveCount(ref.events.length);
  expect(await tokens(page)).toEqual(positionsOf(ref.fight));
  await expect(page.getByTestId('combat-spatial-def')).toContainText(JSON.stringify(pack.spatial));
  const distances = async () => {
    const from = ref.fight.state.combatants[ref.fight.state.active]?.position;
    if (!from) throw new Error('active has no position');
    for (const c of Object.values(ref.fight.state.combatants)) {
      if (c.id === ref.fight.state.active || !c.position) continue;
      await expect(page.getByTestId(`combat-distance-${c.id}`)).toHaveText(String(ref.fight.runtime.spatial.distance(from, c.position)));
    }
  };
  await distances();

  const run = async (entry: Entry): Promise<readonly RuntimeEvent[]> => {
    const out = apply(ref, entry);
    await perform(page, entry);
    await expect(rows).toHaveCount(ref.events.length);
    return out;
  };

  // Far apart: the active combatant's declares are refused by the library — validity and reach — verbatim.
  const active = ref.fight.state.active;
  const kinds: string[] = [];
  for (const actionId of ref.fight.state.combatants[active]?.actions ?? []) {
    const rejection = (await run({ op: 'declare', actionId })).find((e) => e.type === 'declare:rejected');
    if (!rejection) throw new Error(`the reference fight accepted ${actionId} at distance 5`);
    kinds.push(String(rejection.payload.kind));
    const card = page.getByTestId('combat-rejection');
    await expect(card).toContainText(`declare:rejected · ${String(rejection.payload.kind)}`);
    await expect(card).toContainText(String(rejection.payload.message));
    await expect(card).toContainText(rejection.why.rule);
  }
  expect(kinds).toEqual(expect.arrayContaining(['valid', 'spatial']));
  await shot(page, 'combat-grid-rejection-fantasy-wide');

  // Reposition (keyboard): Brynn next to the wight; the complete map goes to the library; no event is emitted.
  const eventsBefore = ref.events.length;
  await expect(page.getByTestId('combat-move')).toBeEnabled();
  await page.getByTestId('combat-move').click();
  await expect(page.getByTestId('combat-move-banner')).toContainText('host repositioning — the engine has no movement rule');
  await page.getByTestId('combat-token-brynn').focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('combat-token-brynn')).toBeFocused();
  await shot(page, 'combat-grid-reposition-fantasy-wide');
  await page.getByTestId('combat-move-apply').click();
  await expect(page.getByTestId('combat-move')).toBeFocused();
  const moved = { ...positionsOf(ref.fight), brynn: { x: home.brynn.x + 4, y: home.brynn.y } };
  moveReference(ref, moved);
  expect(ref.events.length).toBe(eventsBefore);
  await expect(page.getByTestId('combat-token-brynn')).toHaveAttribute('data-x', String(home.brynn.x + 4));
  expect(await tokens(page)).toEqual(positionsOf(ref.fight));
  await expect(rows).toHaveCount(eventsBefore);
  await expect(page.getByTestId('error-card')).toHaveCount(0);
  await distances();

  // Declare again: accepted, the log continues in lockstep; after a declare the reposition control is disabled.
  const hit = await run({ op: 'declare', actionId: 'cut-down' });
  expect(hit.some((e) => e.type === 'declare:rejected')).toBe(false);
  await expect(page.getByTestId('combat-move')).toBeDisabled();
  await expect(page.getByTestId('combat-move-unavailable')).toHaveText('Reposition is unavailable after a declare / while offers are open.');

  let tried = 0;
  for (let calls = 0; ref.fight.state.phase !== 'combat-over'; calls += 1) {
    if (calls > 500) throw new Error('the grid fight never ended');
    const entry = nextEntry(ref.fight, tried);
    const out = await run(entry);
    if (entry.op === 'step') tried = 0;
    else if (entry.op === 'declare') tried = out.some((e) => e.type === 'declare:rejected') ? tried + 1 : 0;
  }
  await expect(page.getByTestId('combat-over')).toBeVisible();
  await expect(page.getByTestId('combat-move')).toBeDisabled();
  expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-type')))).toEqual(ref.events.map((e) => e.type));
  expect(await tokens(page)).toEqual(positionsOf(ref.fight));
  expect(await layoutFacts(page)).toMatchObject({ overflowX: 0, columnRightOfLog: true });
  await shot(page, 'combat-grid-over-fantasy-wide');
});

test('theater-of-mind: an imported pack without `spatial` has no placement, no board, and Begin needs no positions', async ({ rw }) => {
  const page = rw.page;
  const { spatial: _spatial, ...theater } = JSON.parse(JSON.stringify(generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42, knobs: {} })));
  await page.getByTestId('nav-roll').click();
  await page.getByTestId('import-paste').fill(JSON.stringify(theater));
  await page.getByTestId('import-paste-submit').click();
  await expect(page.getByTestId('active-world-name')).toBeVisible();
  await page.getByTestId('nav-character').click();
  await page.getByTestId('char-name').fill('Brynn');
  await page.getByTestId('char-race').selectOption('hillfolk');
  await page.getByTestId('char-class').selectOption('warden');
  await page.getByTestId('char-level').fill('1');
  await page.getByTestId('char-create').click();
  await expect(page.getByTestId('char-hp')).toHaveText('27');

  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  await page.getByTestId('fight-add-enemy-submit').click();
  await expect(page.getByTestId('fight-spatial')).toContainText('theater-of-mind');
  await expect(page.getByTestId('fight-placement')).toHaveCount(0);
  await page.getByTestId('fight-begin').click();
  await expect(page.getByTestId('combat-phase')).toHaveText('awaiting-declare');
  await expect(page.locator('.combat-head')).toContainText('theater-of-mind');
  await expect(page.getByTestId('combat-spatial-caption')).toHaveText('this pack declares no spatial model');
  await expect(page.getByTestId('combat-board')).toHaveCount(0);
  const ref = referenceFight(packOf(rw.userData), 1);
  await expect(page.getByTestId('combat-event')).toHaveCount(ref.events.length);
  await shot(page, 'combat-theater-fantasy-wide');
});

/** The Turn order rows as shown: `[id, data-active]` in panel order. */
async function orderRows(page: Page): Promise<string[][]> {
  return page
    .locator('[data-testid^="combat-order-"][data-active]')
    .evaluateAll((els) => els.map((el) => [el.getAttribute('data-testid')?.slice('combat-order-'.length) ?? '', el.getAttribute('data-active') ?? '']));
}

/** CA-02/CA-04 + turn position: every combatant's detail and the order panel equal the reference fight's state. */
async function economyMatches(page: Page, ref: Reference, grants: Readonly<Record<string, number>>): Promise<void> {
  const { state } = ref.fight;
  await expect(page.getByTestId('combat-order-position')).toHaveText(`round ${state.round} · turn ${state.turn + 1} of ${state.order.length}`);
  expect(await orderRows(page)).toEqual(state.order.map((id) => [id, String(id === state.active)]));
  for (const c of Object.values(state.combatants)) {
    await expect(page.getByTestId(`combat-ledger-${c.id}`).locator('.chip')).toHaveText(
      Object.entries(grants).map(([name, grant]) => `${name} ${c.slots.remaining[name]}/${grant}`),
    );
    const pools = Object.entries(c.pools);
    await expect(page.getByTestId(`combat-pools-${c.id}`)).toHaveText(pools.length > 0 ? pools.map(([id, n]) => `${id} ${n}`).join(' · ') : 'no pools');
    const bound = Object.entries(c.boundSlots);
    if (bound.length > 0) await expect(page.getByTestId(`combat-bound-${c.id}`)).toHaveText(bound.map(([l, n]) => `L${l} ×${n}`).join(' · '));
    else await expect(page.getByTestId(`combat-bound-${c.id}`)).toHaveCount(0);
    const conditions = page.getByTestId(`combat-conditions-${c.id}`);
    if (c.conditions.length === 0) await expect(conditions).toHaveText('no conditions');
    for (const k of c.conditions) await expect(conditions).toContainText(`${k.conditionId} · ${k.duration}`);
  }
}

test('CAP-01/02: turn order, initiative, slot ledgers, conditions and action detail, in lockstep with the library', async ({ rw }) => {
  const page = rw.page;
  await forgeWithBrynn(page);
  const positions = await beginAgainstWights(page, 2);
  const pack = packOf(rw.userData) as {
    spatial: { model: string; reach: { default: number } };
    actions: Record<string, { cost: unknown }>;
    content: { conditions: Record<string, { restricts?: string[] }> };
  };
  const ref = referenceFight(pack, 2, positions);
  const grants = resolveSlotGrants(ref.fight.runtime.pack).slots;
  const rows = page.getByTestId('combat-event');
  await expect(rows).toHaveCount(ref.events.length);
  await expect(page.getByTestId('combat-spatial-caption')).toHaveText(`model ${pack.spatial.model} · reach.default ${pack.spatial.reach.default}`);

  // 1. After Begin: the order is the library's, the active row is state.active, the initiative block is combat:start verbatim.
  const start = ref.events[0];
  if (start?.type !== 'combat:start') throw new Error('no combat:start in the reference fight');
  expect(await orderRows(page)).toEqual(ref.fight.state.order.map((id) => [id, String(id === ref.fight.state.active)]));
  const initiative = page.getByTestId('combat-initiative');
  for (const roll of start.why.rolls) await expect(initiative).toContainText(roll);
  await expect(initiative).toContainText((start.payload.initiative as string[]).join(' · '));
  await expect(initiative).toContainText(start.why.rule);
  await economyMatches(page, ref, grants);
  await shot(page, 'combat-turn-order-fantasy-wide');

  // 2. Every host call in lockstep: the log, then each combatant's ledger/pools/bound/conditions and the turn position.
  const run = async (entry: Entry): Promise<readonly RuntimeEvent[]> => {
    const out = apply(ref, entry);
    await perform(page, entry);
    await expect(rows).toHaveCount(ref.events.length);
    await economyMatches(page, ref, grants);
    return out;
  };
  const quiet = () => ref.fight.state.phase === 'awaiting-declare' && ref.fight.pendingTriggers.length === 0;
  let tried = 0;
  for (let calls = 0; !(ref.fight.state.active === 'brynn' && quiet()); calls += 1) {
    if (calls > 100 || ref.fight.state.phase === 'combat-over') throw new Error("Brynn's turn was never reached");
    const entry = nextEntry(ref.fight, tried);
    const out = await run(entry);
    if (entry.op === 'step') tried = 0;
    else if (entry.op === 'declare') tried = out.some((e) => e.type === 'declare:rejected') ? tried + 1 : 0;
  }

  // 3. Brynn's turn, adjacent to barrow-wight-1 (the placement shown; the library's distance is its reach.default).
  const brynnAt = ref.fight.state.combatants.brynn?.position;
  const wightAt = ref.fight.state.combatants['barrow-wight-1']?.position;
  if (!brynnAt || !wightAt) throw new Error('positions missing');
  expect(ref.fight.runtime.spatial.distance(brynnAt, wightAt)).toBe(pack.spatial.reach.default);
  await page.getByTestId('combat-declare-select').selectOption('cut-down');
  const detail = page.getByTestId('combat-action-detail');
  await expect(detail).toContainText('Action · cut-down');
  await expect(detail).toContainText(JSON.stringify(pack.actions['cut-down']?.cost));
  await expect(detail).toContainText('"main":1');
  await expect(detail).toContainText('hasTarget(adjacent)');
  const cutDown: Entry = { op: 'declare', actionId: 'cut-down', targetId: 'barrow-wight-1' };
  expect((await run(cutDown)).some((e) => e.type === 'declare:rejected')).toBe(false);
  await expect(page.getByTestId('combat-ledger-brynn')).toContainText(`main 0/${grants.main}`);
  for (let offer = ref.fight.pendingTriggers[0]; offer; offer = ref.fight.pendingTriggers[0]) {
    await run({ op: 'respond', triggerId: offer.triggerId, choice: 'decline' });
  }
  const ledgerBefore = await page.getByTestId('combat-ledger-brynn').textContent();
  const rejection = (await run(cutDown)).find((e) => e.type === 'declare:rejected');
  if (!rejection) throw new Error('the reference fight accepted a second cut-down');
  expect(rejection.payload.kind).toBe('slot-exhausted');
  const card = page.getByTestId('combat-rejection');
  await expect(card).toContainText(`declare:rejected · ${String(rejection.payload.kind)}`);
  await expect(card).toContainText(String(rejection.payload.message));
  await expect(card).toContainText(String(rejection.payload.resource));
  await expect(card).toContainText(rejection.why.rule);
  expect(await page.getByTestId('combat-ledger-brynn').textContent()).toBe(ledgerBefore);
  await shot(page, 'combat-economy-fantasy-wide');

  // Answer offers and end the turn until the next declare point (a declare here would change what is compared).
  const toNextTurn = async () => {
    do {
      const entry = nextEntry(ref.fight, 0);
      await run(entry.op === 'declare' ? { op: 'step' } : entry);
    } while (!quiet());
  };

  // CA-04: barrow-wight-1's grave-gaze puts a pack condition on Brynn, shown with the pack's `restricts` verbatim.
  await toNextTurn();
  expect(ref.fight.state.active).toBe('barrow-wight-1');
  // Turn start is the library's: the first Step at awaiting-declare replenishes the ledger and emits turn:began.
  await run({ op: 'step' });
  const began = ref.events.at(-1);
  expect(began?.type).toBe('turn:began');
  expect(began?.payload.slots).toEqual(ref.fight.state.combatants['barrow-wight-1']?.slots.remaining);
  await expect(page.getByTestId('combat-ledger-barrow-wight-1')).toContainText(`main ${grants.main}/${grants.main}`);
  expect((await run({ op: 'declare', actionId: 'grave-gaze', targetId: 'brynn' })).some((e) => e.type === 'declare:rejected')).toBe(false);
  const held = ref.fight.state.combatants.brynn?.conditions ?? [];
  expect(held.length).toBeGreaterThan(0);
  for (const { conditionId } of held) {
    const restricts = pack.content.conditions[conditionId]?.restricts ?? [];
    if (restricts.length > 0) await expect(page.getByTestId('combat-conditions-brynn')).toContainText(`restricts ${restricts.join(' · ')}`);
  }

  // 4. One reposition (SESSION-02 control) at the next quiet declare point: order panel, ledgers and conditions unchanged.
  await toNextTurn();
  const facts = async () => ({
    order: await page.getByTestId('combat-order').textContent(),
    ledgers: await page.locator('[data-testid^="combat-ledger-"]').allTextContents(),
    conditions: await page.locator('[data-testid^="combat-conditions-"]').allTextContents(),
  });
  const before = await facts();
  const eventsBefore = ref.events.length;
  await page.getByTestId('combat-move').click();
  await page.getByTestId('combat-token-brynn').focus();
  await page.keyboard.press('ArrowDown');
  await page.getByTestId('combat-move-apply').click();
  moveReference(ref, { ...positionsOf(ref.fight), brynn: { x: brynnAt.x, y: brynnAt.y + 1 } });
  await expect(page.getByTestId('combat-token-brynn')).toHaveAttribute('data-y', String(brynnAt.y + 1));
  expect(await tokens(page)).toEqual(positionsOf(ref.fight));
  expect(ref.events.length).toBe(eventsBefore);
  await expect(rows).toHaveCount(eventsBefore);
  expect(await facts()).toEqual(before);
  await economyMatches(page, ref, grants);
  for (const roll of start.why.rolls) await expect(initiative).toContainText(roll);
  expect(await layoutFacts(page)).toMatchObject({ overflowX: 0, columnRightOfLog: true });
  await page.setViewportSize({ width: 900, height: 800 });
  expect(await layoutFacts(page)).toMatchObject({ overflowX: 0, columnBelowLog: true });
  await shot(page, 'combat-economy-fantasy-narrow');
});

test('CAP-03: Brynn + a hill-spider ally spawn vs one barrow-wight — roster, placement, order, allies side, lockstep to combat-over', async ({ rw }) => {
  const page = rw.page;
  await forgeWithBrynn(page);

  // Fight assembly: the spawn row sits on the ally side after the character; one wight on the enemy side.
  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-add-ally').selectOption('hill-spider');
  await page.getByTestId('fight-add-ally-submit').click();
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  await page.getByTestId('fight-add-enemy-submit').click();
  const spider = page.getByTestId('fight-ally-spawn-hill-spider-1');
  await expect(spider.locator('.row-title')).toHaveText('hill-spider');
  await expect(spider.locator('.row-data')).toHaveText('spawnMonster · hill-spider-1 · ally side');
  await expect(page.getByTestId('fight-ally')).toContainText('hillfolk · warden 1 · hp 27 · ac 12');
  expect(await page.locator('[data-testid="fight-ally"], [data-testid^="fight-ally-spawn-"].combatant').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))).toEqual([
    'fight-ally',
    'fight-ally-spawn-hill-spider-1',
  ]);
  // CA-12: the default layout puts the spawn in the allies column after the character.
  const positions = await placed(page);
  expect(Object.keys(positions)).toEqual(['brynn', 'hill-spider-1', 'barrow-wight-1']);
  await expect(page.getByTestId('fight-token-hill-spider-1')).toHaveText('A2');
  await shot(page, 'fight-ally-spawn-fantasy-wide');
  await page.getByTestId('fight-begin').click();
  await expect(page.getByTestId('combat-phase')).toHaveText('awaiting-declare');

  const ref = referenceFight(packOf(rw.userData), 1, positions, [{ statblockId: 'hill-spider', instanceId: 'hill-spider-1' }]);
  expect(ref.fight.state.combatants['hill-spider-1']?.side).toBe('allies');
  const rows = page.getByTestId('combat-event');
  await expect(rows).toHaveCount(ref.events.length);
  expect(await orderRows(page)).toEqual(ref.fight.state.order.map((id) => [id, String(id === ref.fight.state.active)]));
  await expect(page.getByTestId('combat-order-hill-spider-1')).toContainText('allies');
  await expect(page.getByTestId('combat-combatant-hill-spider-1')).toContainText('allies · hp');
  expect(await tokens(page)).toEqual(positionsOf(ref.fight));

  // Lockstep: the app and the reference issue the same calls; the log grows by exactly the reference's events.
  let tried = 0;
  let spiderActed = false;
  for (let calls = 0; ref.fight.state.phase !== 'combat-over'; calls += 1) {
    if (calls > 1500) throw new Error('the fight never ended');
    const entry = nextEntry(ref.fight, tried);
    spiderActed ||= entry.op === 'declare' && ref.fight.state.active === 'hill-spider-1';
    const out = apply(ref, entry);
    await perform(page, entry);
    await expect(rows).toHaveCount(ref.events.length);
    if (entry.op === 'declare') tried = out.some((e) => e.type === 'declare:rejected') ? tried + 1 : 0;
    else if (entry.op === 'step') tried = 0;
  }
  expect(spiderActed).toBe(true);
  expect(await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-type')))).toEqual(ref.events.map((e) => e.type));
  const ended = ref.events.find((e) => e.type === 'combat:ended');
  if (!ended) throw new Error('no combat:ended in the reference fight');
  await expect(page.getByTestId('combat-over')).toContainText(`winner ${String(ended.payload.winner)} · defeated ${String(ended.payload.defeated)}`);
  await shot(page, 'combat-ally-spawn-over-fantasy-wide');
});
