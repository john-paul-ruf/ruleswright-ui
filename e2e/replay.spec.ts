/**
 * CAP-10 (FR-14b; CA-06 RNG on records, CA-09, CA-12) through the real built app: record a finished fight,
 * show its stored RNG words, replay after a restart, flag a tampered script's first divergent event and persist
 * `outcome: diverged`, and report replay unavailable for a legacy record and for a world with unknown params.
 * CAP-06 / CA-14: a grid fight's placement and reposition are recorded (`start.positions`, one `move`) and replay
 * complete after a restart. CAP-03 / CA-04b: a fight with an ally-side spawn records `start.allySpawns` as the Allies
 * panel showed it and replays complete after a restart. Expected values come from the same library calls in the test process, on the stored
 * bytes, at the positions the placement board showed before Begin.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  Runtime,
  createCharacter,
  deserializeCombat,
  profileFromCharacter,
  restoreCharacter,
  serializeCombat,
  spawnMonster,
  startCombat,
  type CharacterSnapshot,
  type Combat,
  type Position,
  type RuntimeEvent,
} from 'ruleswright/runtime';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const SHOTS = process.env.RW_SHOTS_DIR;

type Entry =
  | { op: 'declare'; actionId: string; targetId?: string }
  | { op: 'respond'; triggerId: string; choice: 'take' | 'decline'; targetId?: string }
  | { op: 'step' };

interface FightFile {
  worldId: string;
  name: string;
  id: string;
  outcome: string;
  combat: { rng: Record<'a' | 'b' | 'c' | 'd', number> };
  start: {
    ally: { id: string; snapshot: CharacterSnapshot };
    enemies: { statblockId: string; instanceId: string }[];
    positions?: Record<string, Position>;
    allySpawns?: { statblockId: string; instanceId: string }[];
  };
  script?: Entry[];
  events: RuntimeEvent[];
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

function worldIdWhere(userData: string, match: (doc: { seed: number | null }) => boolean): string {
  const dir = join(userData, 'worlds');
  const id = readdirSync(dir).find((d) => match(JSON.parse(readFileSync(join(dir, d, 'world.json'), 'utf8'))));
  if (!id) throw new Error('no such world on disk');
  return id;
}

const packFile = (userData: string, worldId: string) => join(userData, 'worlds', worldId, 'pack.json');
const fightFile = (userData: string, worldId: string, name: string) => join(userData, 'fights', worldId, `${name}.json`);
const readFight = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as FightFile;

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

/** One host call; a call the library refuses by throwing changes nothing (the app records only accepted calls). */
function apply(fight: Combat, e: Entry): void {
  try {
    if (e.op === 'declare') fight.declare(e.actionId, e.targetId === undefined ? {} : { targetId: e.targetId });
    else if (e.op === 'respond') fight.respond(e.triggerId, e.choice, e.targetId);
    else fight.step();
  } catch {
    // mirrors the app's replay: a now-failing call shows up as an event difference
  }
}

/** The replay rule in the test process: restore the recorded ally into the stored pack, re-apply `script`. */
function replayInProcess(packJson: string, doc: FightFile): RuntimeEvent[] {
  const rt = new Runtime(JSON.parse(packJson));
  const ally = profileFromCharacter(rt, restoreCharacter(rt, doc.start.ally.snapshot), doc.start.ally.id);
  const events: RuntimeEvent[] = [];
  rt.events.on((e) => events.push(e));
  const enemies = doc.start.enemies.map((e) => ({ id: e.instanceId, profile: spawnMonster(rt, e.statblockId, e.instanceId) }));
  const positions = doc.start.positions;
  const fight = startCombat(rt, { allies: [{ id: doc.start.ally.id, ...ally }], enemies, ...(positions ? { positions } : {}) });
  for (const entry of doc.script ?? []) apply(fight, entry);
  return events;
}

const hex = (w: number) => (w >>> 0).toString(16).padStart(8, '0');

async function createBrynn(page: Page): Promise<void> {
  await page.getByTestId('nav-character').click();
  await page.getByTestId('char-name').fill('Brynn');
  await page.getByTestId('char-race').selectOption('hillfolk');
  await page.getByTestId('char-class').selectOption('warden');
  await page.getByTestId('char-level').fill('1');
  await page.getByTestId('char-create').click();
  await expect(page.getByTestId('char-hp')).toHaveText('27');
}

/** The placement the board shows before Begin, read from its rows (never assumed). */
async function placed(page: Page): Promise<Record<string, Position>> {
  const all = await page.locator('[data-testid^="fight-place-"][data-x]').evaluateAll((els) =>
    els.map((el) => [el.getAttribute('data-testid')?.slice('fight-place-'.length) ?? '', { x: Number(el.getAttribute('data-x')), y: Number(el.getAttribute('data-y')) }] as const),
  );
  return Object.fromEntries(all);
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

test('CAP-10: record, RNG words, restart + replay complete, tamper → diverged + outcome, legacy and unknown-params unavailable', async ({ rw }) => {
  let page = rw.page;

  // Forge dark-fantasy · 42, create Brynn, begin against two wights.
  await page.getByTestId('nav-roll').click();
  await page.getByTestId('roll-theme-dark-fantasy').click();
  await page.getByTestId('roll-seed').fill('42');
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await createBrynn(page);
  await page.getByTestId('nav-fight').click();
  await expect(page.getByTestId('fight-records')).toContainText('No recorded fights in this world yet.');
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  await page.getByTestId('fight-add-enemy-submit').click();
  await page.getByTestId('fight-add-enemy-submit').click();
  const positions = await placed(page);
  await page.getByTestId('fight-begin').click();
  await expect(page.getByTestId('combat-phase')).toHaveText('awaiting-declare');

  // Drive to combat-over with the reference policy (the reference fight runs on the stored pack bytes).
  const worldId = worldIdWhere(rw.userData, (w) => w.seed === 42);
  const packJson = readFileSync(packFile(rw.userData, worldId), 'utf8');
  const rt = new Runtime(JSON.parse(packJson));
  const ally = profileFromCharacter(rt, createCharacter(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }), 'brynn');
  const refEvents: RuntimeEvent[] = [];
  rt.events.on((e) => refEvents.push(e));
  const enemies = ['barrow-wight-1', 'barrow-wight-2'].map((id) => ({ id, profile: spawnMonster(rt, 'barrow-wight', id) }));
  const ref = startCombat(rt, { allies: [{ id: 'brynn', ...ally }], enemies, positions });
  const rows = page.getByTestId('combat-event');
  const script: Entry[] = [];
  let tried = 0;
  for (let calls = 0; ref.state.phase !== 'combat-over'; calls += 1) {
    if (calls > 1500) throw new Error('reference fight never ended');
    const entry = nextEntry(ref, tried);
    const from = refEvents.length;
    apply(ref, entry);
    script.push(entry);
    if (entry.op === 'declare') tried = refEvents.slice(from).some((e) => e.type === 'declare:rejected') ? tried + 1 : 0;
    else if (entry.op === 'step') tried = 0;
    await perform(page, entry);
    await expect(rows).toHaveCount(refEvents.length);
  }
  await expect(page.getByTestId('combat-over')).toBeVisible();

  // 1. Record → the file holds start, script, events; events.length equals the rendered log count.
  await page.getByTestId('combat-over-record').click();
  await expect(page.getByTestId('combat-record-name')).toBeFocused();
  await page.getByTestId('combat-record-name').fill('barrow-watch-1');
  await page.getByTestId('combat-record').click();
  await expect(page.getByTestId('fight-record-barrow-watch-1')).toBeVisible();
  const file = fightFile(rw.userData, worldId, 'barrow-watch-1');
  const doc = readFight(file);
  expect(doc.start).toMatchObject({ ally: { id: 'brynn', snapshot: { kind: 'character' } }, enemies: [
    { statblockId: 'barrow-wight', instanceId: 'barrow-wight-1' },
    { statblockId: 'barrow-wight', instanceId: 'barrow-wight-2' },
  ] });
  expect(doc.script).toEqual(script);
  expect(doc.events.length).toBe(await rows.count());
  expect(JSON.stringify(doc.events)).toBe(JSON.stringify(refEvents));
  expect(doc.outcome).toBe('complete');

  // 2. The record row shows the file's combat.rng as four 8-digit hex words (B-3).
  const { a, b, c, d } = doc.combat.rng;
  await expect(page.getByTestId('fight-record-rng-barrow-watch-1')).toHaveText(`rng a:${hex(a)} b:${hex(b)} c:${hex(c)} d:${hex(d)}`);
  await shot(page, 'combat-recorded-fantasy-wide');

  // 3. Restart → (Brynn again: characters are session-scoped) → Fight → Replay → complete.
  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await createBrynn(page);
  await page.getByTestId('nav-fight').click();
  await expect(page.getByTestId('fight-record-rng-barrow-watch-1')).toHaveText(`rng a:${hex(a)} b:${hex(b)} c:${hex(c)} d:${hex(d)}`);
  await page.getByTestId('fight-replay-barrow-watch-1').click();
  await expect(page.getByTestId('fight-replay-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('fight-replay-event')).toHaveCount(doc.events.length);
  await expect(page.getByTestId('fight-replay-divergence')).toHaveCount(0);
  await shot(page, 'fight-replay-complete-fantasy-wide');

  // 4. Swap two script entries on disk → diverged at the first differing event (computed in-process), row flagged,
  //    and the file's outcome becomes `diverged` with every other field unchanged.
  const [s0, s1, ...rest] = doc.script ?? [];
  if (!s0 || !s1) throw new Error('short script');
  const tampered = { ...doc, script: [s1, s0, ...rest] };
  writeFileSync(file, JSON.stringify(tampered));
  const replayed = replayInProcess(packJson, tampered);
  const index = doc.events.findIndex((e, i) => JSON.stringify(e) !== JSON.stringify(replayed[i]));
  expect(index).toBeGreaterThan(0);
  await page.getByTestId('fight-replay-barrow-watch-1').click();
  const status = page.getByTestId('fight-replay-status');
  await expect(status).toHaveAttribute('data-status', 'diverged');
  await expect(status).toContainText(`diverged at event ${index}`);
  const flagged = page.getByTestId('fight-replay-divergence');
  await expect(flagged).toHaveCount(1);
  expect(await flagged.evaluate((el) => [...(el.parentElement?.children ?? [])].indexOf(el))).toBe(index);
  await expect(flagged).toHaveClass(/combat-flagged/);
  await expect(page.getByTestId('fight-record-barrow-watch-1')).toContainText('diverged');
  expect(readFight(file)).toEqual({ ...tampered, outcome: 'diverged' });
  await shot(page, 'fight-replay-diverged-fantasy-wide');

  // 5. A record without `script` (legacy) → replay unavailable, never guessed.
  const { script: _dropped, ...legacy } = doc;
  writeFileSync(fightFile(rw.userData, worldId, 'no-script'), JSON.stringify({ ...legacy, id: randomUUID(), name: 'no-script' }));
  await page.getByTestId('nav-world').click();
  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-replay-no-script').click();
  await expect(page.getByTestId('fight-replay-status')).toHaveAttribute('data-status', 'unavailable');
  await expect(page.getByTestId('fight-replay-status')).toContainText('no replay script');

  // 6. An imported world with null params → replay unavailable (its record carries a full script).
  const { provenance: _p, ...manifest } = JSON.parse(packJson).manifest;
  await page.getByTestId('nav-roll').click();
  await page.getByTestId('import-paste').fill(JSON.stringify({ ...JSON.parse(packJson), manifest }));
  await page.getByTestId('import-paste-submit').click();
  await expect(page.getByTestId('active-world-seed')).not.toHaveText('dark-fantasy · 42');
  const imported = worldIdWhere(rw.userData, (w) => w.seed === null);
  mkdirSync(join(rw.userData, 'fights', imported), { recursive: true });
  writeFileSync(fightFile(rw.userData, imported, 'imported'), JSON.stringify({ ...doc, worldId: imported, id: randomUUID(), name: 'imported' }));
  await createBrynn(page);
  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-replay-imported').click();
  await expect(page.getByTestId('fight-replay-status')).toHaveAttribute('data-status', 'unavailable');
  await expect(page.getByTestId('fight-replay-status')).toContainText('generation parameters unknown');
  await shot(page, 'fight-replay-unavailable-archive-wide');
});

test('CAP-06 / CA-14: a grid fight with its placement and one reposition is recorded, then replays complete after a restart', async ({ rw }) => {
  let page = rw.page;
  await page.getByTestId('nav-roll').click();
  await page.getByTestId('roll-theme-dark-fantasy').click();
  await page.getByTestId('roll-seed').fill('42');
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await createBrynn(page);

  // Placement: one barrow-wight 5 squares from Brynn.
  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  await page.getByTestId('fight-add-enemy-submit').click();
  const home = (await placed(page)).brynn;
  if (!home) throw new Error('no placement row for brynn');
  await page.getByTestId('fight-place-barrow-wight-1-x').fill(String(home.x + 5));
  await expect(page.getByTestId('fight-place-barrow-wight-1')).toHaveAttribute('data-x', String(home.x + 5));
  const positions = await placed(page);
  await page.getByTestId('fight-begin').click();
  await expect(page.getByTestId('combat-phase')).toHaveText('awaiting-declare');

  const worldId = worldIdWhere(rw.userData, (w) => w.seed === 42);
  const rt = new Runtime(JSON.parse(readFileSync(packFile(rw.userData, worldId), 'utf8')));
  const ally = profileFromCharacter(rt, createCharacter(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }), 'brynn');
  const refEvents: RuntimeEvent[] = [];
  rt.events.on((e) => refEvents.push(e));
  const enemies = [{ id: 'barrow-wight-1', profile: spawnMonster(rt, 'barrow-wight', 'barrow-wight-1') }];
  let ref = startCombat(rt, { allies: [{ id: 'brynn', ...ally }], enemies, positions });
  const rows = page.getByTestId('combat-event');
  const script: unknown[] = [];
  const run = async (entry: Entry): Promise<void> => {
    apply(ref, entry);
    script.push(entry);
    await perform(page, entry);
    await expect(rows).toHaveCount(refEvents.length);
  };

  // Out of reach: the library refuses; then the host repositions Brynn next to the wight (keyboard) and applies.
  await run({ op: 'declare', actionId: 'cut-down' });
  await expect(page.getByTestId('combat-rejection')).toBeVisible();
  await page.getByTestId('combat-move').click();
  await page.getByTestId('combat-token-brynn').focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await page.getByTestId('combat-move-apply').click();
  const moved = { ...positions, brynn: { x: home.x + 4, y: home.y } };
  const balances = (id: string) => {
    const c = ref.state.combatants[id];
    return { pools: structuredClone(c?.pools ?? {}), boundSlots: structuredClone(c?.boundSlots ?? {}) };
  };
  ref = deserializeCombat(rt, serializeCombat(ref, { pairsWith: 'brynn' }), {
    allies: [{ id: 'brynn', profile: ally.profile, balances: balances('brynn') }],
    enemies: enemies.map((e) => ({ ...e, balances: balances(e.id) })),
    positions: moved,
  });
  script.push({ op: 'move', positions: moved });
  await expect(page.getByTestId('combat-token-brynn')).toHaveAttribute('data-x', String(home.x + 4));
  await expect(rows).toHaveCount(refEvents.length);

  let tried = 0;
  for (let calls = 0; ref.state.phase !== 'combat-over'; calls += 1) {
    if (calls > 500) throw new Error('the grid fight never ended');
    const entry = nextEntry(ref, tried);
    const from = refEvents.length;
    await run(entry);
    if (entry.op === 'declare') tried = refEvents.slice(from).some((e) => e.type === 'declare:rejected') ? tried + 1 : 0;
    else if (entry.op === 'step') tried = 0;
  }
  await expect(page.getByTestId('combat-over')).toBeVisible();

  // Record: the stored FightDoc carries the placement and exactly the one move the UI made.
  await page.getByTestId('combat-record-name').fill('grid-journey');
  await page.getByTestId('combat-record').click();
  await expect(page.getByTestId('fight-record-grid-journey')).toBeVisible();
  const doc = JSON.parse(readFileSync(fightFile(rw.userData, worldId, 'grid-journey'), 'utf8')) as Omit<FightFile, 'script'> & { script: { op: string }[] };
  expect(doc.start.positions).toEqual(positions);
  expect(doc.script.filter((e) => e.op === 'move')).toEqual([{ op: 'move', positions: moved }]);
  expect(doc.script).toEqual(script);
  expect(JSON.stringify(doc.events)).toBe(JSON.stringify(refEvents));
  expect(doc.outcome).toBe('complete');

  // Restart → Brynn again (session-scoped) → Fight → Replay: complete, every event.
  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await createBrynn(page);
  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-replay-grid-journey').click();
  await expect(page.getByTestId('fight-replay-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('fight-replay-event')).toHaveCount(doc.events.length);
  await expect(page.getByTestId('fight-replay-divergence')).toHaveCount(0);
  await shot(page, 'fight-replay-grid-complete-fantasy-wide');
});

test('CAP-03 / CA-04b: a fight with an ally spawn records start.allySpawns as shown, then replays complete after a restart', async ({ rw }) => {
  let page = rw.page;
  await page.getByTestId('nav-roll').click();
  await page.getByTestId('roll-theme-dark-fantasy').click();
  await page.getByTestId('roll-seed').fill('42');
  await page.getByTestId('roll-forge').click();
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await createBrynn(page);

  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-add-ally').selectOption('hill-spider');
  await page.getByTestId('fight-add-ally-submit').click();
  await page.getByTestId('fight-add-enemy').selectOption('barrow-wight');
  await page.getByTestId('fight-add-enemy-submit').click();
  // What the Allies panel shows: each spawn row's statblock name and its instance id.
  const shown = await page.locator('[data-testid^="fight-ally-spawn-"].combatant').evaluateAll((els) =>
    els.map((el) => ({
      statblockId: el.querySelector('.row-title')?.textContent ?? '',
      instanceId: el.getAttribute('data-testid')?.slice('fight-ally-spawn-'.length) ?? '',
    })),
  );
  expect(shown).toEqual([{ statblockId: 'hill-spider', instanceId: 'hill-spider-1' }]);
  const positions = await placed(page);
  await page.getByTestId('fight-begin').click();
  await expect(page.getByTestId('combat-phase')).toHaveText('awaiting-declare');

  const worldId = worldIdWhere(rw.userData, (w) => w.seed === 42);
  const rt = new Runtime(JSON.parse(readFileSync(packFile(rw.userData, worldId), 'utf8')));
  const ally = profileFromCharacter(rt, createCharacter(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] }), 'brynn');
  const refEvents: RuntimeEvent[] = [];
  rt.events.on((e) => refEvents.push(e));
  const spawn = (s: { statblockId: string; instanceId: string }) => ({ id: s.instanceId, profile: spawnMonster(rt, s.statblockId, s.instanceId) });
  const ref = startCombat(rt, {
    allies: [{ id: 'brynn', ...ally }, ...shown.map(spawn)],
    enemies: [spawn({ statblockId: 'barrow-wight', instanceId: 'barrow-wight-1' })],
    positions,
  });
  const rows = page.getByTestId('combat-event');
  const script: Entry[] = [];
  let tried = 0;
  for (let calls = 0; ref.state.phase !== 'combat-over'; calls += 1) {
    if (calls > 1500) throw new Error('the fight never ended');
    const entry = nextEntry(ref, tried);
    const from = refEvents.length;
    apply(ref, entry);
    script.push(entry);
    if (entry.op === 'declare') tried = refEvents.slice(from).some((e) => e.type === 'declare:rejected') ? tried + 1 : 0;
    else if (entry.op === 'step') tried = 0;
    await perform(page, entry);
    await expect(rows).toHaveCount(refEvents.length);
  }
  await expect(page.getByTestId('combat-over')).toBeVisible();

  await page.getByTestId('combat-record-name').fill('spider-journey');
  await page.getByTestId('combat-record').click();
  await expect(page.getByTestId('fight-record-spider-journey')).toBeVisible();
  const doc = readFight(fightFile(rw.userData, worldId, 'spider-journey'));
  expect(doc.start.allySpawns).toEqual(shown);
  expect(doc.start.positions).toEqual(positions);
  expect(doc.script).toEqual(script);
  expect(JSON.stringify(doc.events)).toBe(JSON.stringify(refEvents));
  expect(doc.outcome).toBe('complete');

  await rw.restart();
  page = rw.page;
  await expect(page.getByTestId('active-world-seed')).toHaveText('dark-fantasy · 42');
  await createBrynn(page);
  await page.getByTestId('nav-fight').click();
  await page.getByTestId('fight-replay-spider-journey').click();
  await expect(page.getByTestId('fight-replay-status')).toHaveAttribute('data-status', 'complete');
  await expect(page.getByTestId('fight-replay-event')).toHaveCount(doc.events.length);
  await expect(page.getByTestId('fight-replay-divergence')).toHaveCount(0);
  await shot(page, 'fight-replay-ally-spawn-complete-fantasy-wide');
});
