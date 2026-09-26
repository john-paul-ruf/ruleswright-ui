/**
 * The ally combatant (B-1 = A, D-18, CA-08): the engine's `profileFromCharacter` turns the active
 * character into a `CombatantProfile` + its economy balances. The UI does no profile math.
 */
import { profileFromCharacter, type Character, type CharacterCombatant, type Runtime } from 'ruleswright/runtime';
import { toAppError } from './errors';
import type { Outcome } from './runtime';

export type { CharacterCombatant, EconomyBalances } from 'ruleswright/runtime';

/** FR-11: the ally side's profile (actions = the union of the character's classes' pack actions). */
export function allyProfile(rt: Runtime, character: Character, id?: string): Outcome<CharacterCombatant> {
  try {
    return { ok: true, value: profileFromCharacter(rt, character, id) };
  } catch (e) {
    return { ok: false, error: toAppError('fight:ally-profile', e) };
  }
}
