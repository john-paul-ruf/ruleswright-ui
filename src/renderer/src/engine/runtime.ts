/**
 * Character wrappers (M06, FR-6–10): every mechanic is one library call on the world's `Runtime`.
 * Library calls mutate `character.state` in place; callers publish `viewOf(...)`, a fresh clone.
 * Failures never throw: they return `{ ok: false, error }` with the library's cards verbatim (CA-05).
 */
import {
  applyCondition,
  castSpell,
  createCharacter,
  knownSpells,
  poolVocabulary,
  prepareSpell,
  removeCondition,
  restoreCharacter,
  restrictedIds,
  rest,
  serializeCharacter,
  spendPool,
  tickConditions,
  validateBuild,
  type Character,
  type CharacterSnapshot,
  type CharacterState,
  type ClassEntry,
  type DerivedStats,
  type Runtime,
  type RuntimeEvent,
} from 'ruleswright/runtime';
import { toAppError, type AppError, type ErrorCard } from './errors';

export type { Character, CharacterState, DerivedStats, RuntimeEvent, CharacterSnapshot, ClassEntry } from 'ruleswright/runtime';

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: AppError };

function attempt<T>(operation: string, run: () => T): Outcome<T> {
  try {
    return { ok: true, value: run() };
  } catch (e) {
    return { ok: false, error: toAppError(operation, e) };
  }
}

/** FR-6: create a character from pack races/classes; illegal builds → `CharacterBuildError` cards. */
export function create(rt: Runtime, req: { name: string; race: string; classes: ClassEntry[] }): Outcome<Character> {
  return attempt('character:create', () => createCharacter(rt, req));
}

/** FR-6: the host awards XP; the library reports `xp:awarded` (+ `level:reached`). */
export function awardXp(rt: Runtime, c: Character, amount: number): Outcome<readonly RuntimeEvent[]> {
  return attempt('character:award-xp', () => rt.awardXp(c, amount));
}

/** FR-6: direct level-set through the library's build validator. */
export function setLevels(rt: Runtime, c: Character, entries: ClassEntry[]): Outcome<readonly RuntimeEvent[]> {
  return attempt('character:set-level', () => rt.levelSet(c, entries));
}

/** FR-6: the library's build validator, for live form feedback (empty = legal). */
export function checkBuild(rt: Runtime, race: string, entries: ClassEntry[]): readonly ErrorCard[] {
  return validateBuild(rt, race, entries);
}

/** FR-8: spend points from a pack-declared pool. */
export function spend(rt: Runtime, c: Character, pool: string, amount: number): Outcome<RuntimeEvent> {
  return attempt('character:spend', () => spendPool(rt, c.state, pool, amount));
}

/** FR-9: bind a known spell into an empty slot. */
export function prepare(rt: Runtime, c: Character, spellId: string, slotIndex?: number): Outcome<RuntimeEvent> {
  return attempt('character:prepare', () => prepareSpell(rt, c.state, spellId, slotIndex));
}

/** FR-8: cast a bound spell, emptying its slot. */
export function cast(rt: Runtime, c: Character, spellId: string, slotIndex?: number): Outcome<RuntimeEvent> {
  return attempt('character:cast', () => castSpell(rt, c.state, spellId, slotIndex));
}

/** FR-8: the host's rest event — the library refills pools and clears slots. */
export function restNow(rt: Runtime, c: Character): Outcome<RuntimeEvent> {
  return attempt('character:rest', () => rest(rt, c.state));
}

/** FR-7: apply a pack-declared condition (duration from the pack). */
export function apply(rt: Runtime, c: Character, conditionId: string): Outcome<RuntimeEvent> {
  return attempt('character:apply-condition', () => applyCondition(rt, c.state, conditionId));
}

/** FR-7: remove every active instance of a condition. */
export function remove(rt: Runtime, c: Character, conditionId: string): Outcome<RuntimeEvent> {
  return attempt('character:remove-condition', () => removeCondition(rt, c.state, conditionId));
}

/** FR-7: one round tick; expiries emit `condition:removed`. */
export function tick(rt: Runtime, c: Character): Outcome<readonly RuntimeEvent[]> {
  return attempt('character:tick', () => tickConditions(rt, c.state));
}

/** What the Character surface renders: a detached clone plus library-derived facts. */
export interface CharacterView {
  state: CharacterState;
  derived: DerivedStats;
  pools: readonly string[];
  known: readonly string[];
  restrictedActions: readonly string[];
  restrictedSpells: readonly string[];
}

/** FR-6–9: a fresh view of the character (the library mutates `c.state` in place). */
export function viewOf(rt: Runtime, c: Character): CharacterView {
  return {
    state: structuredClone(c.state),
    derived: c.derived(),
    pools: poolVocabulary(rt),
    known: knownSpells(rt, c.state),
    restrictedActions: restrictedIds(rt, c.state, 'action'),
    restrictedSpells: restrictedIds(rt, c.state, 'spell'),
  };
}

/** FR-10 / CA-06: the verbatim library envelope `{kind, snapshotVersion, pack, state}`. */
export function serialize(rt: Runtime, c: Character): CharacterSnapshot {
  return serializeCharacter(rt, c.state);
}

/** FR-10 / CA-06: rebuild a character; a foreign pack is refused with E-SNAP-01. */
export function restore(rt: Runtime, snapshot: unknown): Outcome<Character> {
  return attempt('snapshot:restore', () => restoreCharacter(rt, snapshot as CharacterSnapshot));
}
