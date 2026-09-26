# M06 — engine (`src/renderer/src/engine/`)

**Status:** planned. The ONLY importer of `ruleswright`, `ruleswright/compiler`, `ruleswright/runtime`, `ruleswright/schema`.

| File | Session | Public API (planned) |
|---|---|---|
| `errors.ts` | S01 c3 | `AppError` (`library` / `host` / `unexpected`), `toAppError(operation, e)`, `fromIpcError(err)`; re-export `type ErrorCard` |
| `compiler.ts` | S01 c3 | `listThemes(): ThemeInfo[]` (D-04 discovery), `forge(themeId, seed, knobs): ForgeResult` (`packJson = JSON.stringify(pack)`), `type KnobSpec` |
| `schema.ts` | S01 c3 | `openPack(packJson): PackGate` (JSON.parse → `new Runtime(parsed)`), `importPackText(text): ImportResult` (canonical bytes + provenance params, D-03), `packIdentityOf(pack)` |
| `determinism.ts` | S04 | `rerunSameSeed(meta, storedPackJson): RerunResult` (`pass`/`fail` with first differing offset/`unavailable`) |
| `runtime.ts` | S05 | character wrappers: create, derived, progression, pools/spells, conditions, restrictions, serialize/restore |
| `combat.ts` | S06 | start/declare/step/respond wrappers; event subscription |
| `combat-profile.ts` | S06 (blocked B-1) | character → `CombatantProfile` per the B-1 decision |
| `replay.ts` | S06 (blocked B-2) | record script + replay with divergence detection |

## Verified library facts (plan-time probes, engine HEAD 664d24f)
- No theme enumerator; `loadTheme(name)` switches on `dark-fantasy|zombie-urban`; `DARK_FANTASY`/`ZOMBIE_URBAN` exported.
- `generateCampaign` throws `GenerationError{errors: ErrorCard[]}` (unknown knob → E-SCHEMA-01 card); `KnobRejection` is a type only, never thrown.
- `new Runtime(bad)` throws `PackLoadError{errors}`; `createCharacter` throws `CharacterBuildError{errors}`; pool/spell/condition failures throw `RuntimeRuleError{errors}`.
- `Combat.declare()` does **not** throw on rejection: it returns/emits a `declare:rejected` event (`payload {kind, resource, message}`, `why.rule`).
- `CharacterSnapshot = {kind, snapshotVersion, pack:{id,schemaVersion,contentHash}, state}` — **no RNG words** (B-3). RNG words exist in `CombatState.rng` / `CombatSnapshot.rng`.
- `restoreCharacter` on another world's runtime throws `RuntimeRuleError` E-SNAP-01.
- Combat dice default to `new Rng(0)`; `Rng` is not exported.

## Change history
- v1-shell plan: created (planned).


<!-- v1-shell SESSION-E1 -->
## Upstream engine API delta — v1-shell SESSION-E1 (consumed by engine/combat-profile.ts, SESSION-06)

#### SESSION-E1 — engine (`../Ruleswright`) public-API delta (engine commits a5c20ea, 6a5bc0a, f0bf58e)

- **engine M01 schema:** `ClassDef.actions?: KebabId[]` (pack v1.2, `src/schema/artifacts.ts`). `validatePack`/`checkClasses`
  accepts `actions`: non-array → `E-SCHEMA-01` at `content.classes.<id>.actions`; non-kebab entry or duplicate →
  `E-SCHEMA-01` at `…actions[i]` (uniqueItems); unresolved id → `E-REF-01` at `…actions[i]` with a nearest-id hint. Empty
  or absent list is valid. `schemaVersion` stays 1.
- **engine M04 compiler:** both bundled themes declare class actions (D-23). `stages/classes.ts` unchanged: it
  already `structuredClone`s class defs verbatim. Pack bytes changed: dark-fantasy·42 15,863 B → 16,056 B
  (`packContentHash` a5b8b1b2 → 5dc003f3); zombie-urban·42 9,154 B → 9,352 B (d92d1050 → e84a0aed).
- **engine M03 runtime (new file `src/runtime/character-profile.ts`), exported from `ruleswright/runtime` and via
  `export *` from the root `ruleswright` barrel (`src/index.ts` unchanged):**
  ```ts
  export interface CharacterCombatant { readonly profile: CombatantProfile; readonly balances: EconomyBalances }
  export function profileFromCharacter(runtime: Runtime, character: Character, id?: string): CharacterCombatant;
  ```
  Imports M03-internal only (`evalPackFormula` from `combat/resolve`, `RuntimeRuleError`/`ruleCard`) + M01 types.
  Throws `RuntimeRuleError` with rule `no-combat-actions` (artifactId = first class id, jsonPath `content.classes`)
  when the class action union is empty. Active conditions are not carried (v1 limit).
- **Known engine gap (not changed; outside lease):** `Combat` never transitions to `phase: 'combat-over'`. The
  `StepOutcome` variant exists, but no combatant-defeated or side-defeated rule sets it.


<!-- v1-shell SESSION-04 -->
## Realized — v1-shell SESSION-04

### M06 engine — `determinism.ts` realized (SESSION-04 c1 `33481cf`, c2 `d310755`)
- `type RerunResult = {status:'pass'; bytes; ms} | {status:'fail'; offset; storedLength; rerunLength; storedExcerpt; rerunExcerpt} | {status:'unavailable'; reason} | {status:'error'; error: AppError}`.
- `rerunSameSeed(meta: Pick<WorldMeta,'theme'|'seed'|'knobs'>, storedPackJson: string): RerunResult` — `generateCampaign({theme: loadTheme(theme), seed, knobs})` → `JSON.stringify` → strict `===` with the stored string (CA-12). `bytes` = UTF-8 byte length; `offset` = first differing UTF-16 index (or the shorter length); excerpts = `slice(offset−40, offset+40)` of each; library throws → `toAppError('rerun', e)`.
- `rerunUnavailableReason(meta): string | null` — `'generation parameters unknown (imported pack)'` when any param is null; `'theme not provided by this engine build'` when the theme is not in `listThemes()`.
- Imports: `ruleswright/compiler` (`generateCampaign`, `loadTheme`), `./compiler` (`listThemes`), `./errors`.


<!-- v1-shell SESSION-05 -->
## Realized — v1-shell SESSION-05

### M06 engine — `runtime.ts` realized (`c38946e`)
Imports `ruleswright/runtime` (functions + types) and `./errors`. Every mutator returns `Outcome<T>`; library throws → `toAppError(operation, e)` (CA-05). Operations: `character:create|award-xp|set-level|spend|prepare|cast|rest|apply-condition|remove-condition|tick`, `snapshot:restore`.
```ts
export type { Character, CharacterState, DerivedStats, RuntimeEvent, CharacterSnapshot, ClassEntry } from 'ruleswright/runtime';
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: AppError };
export function create(rt: Runtime, req: { name: string; race: string; classes: ClassEntry[] }): Outcome<Character>;
export function awardXp(rt: Runtime, c: Character, amount: number): Outcome<readonly RuntimeEvent[]>;   // rt.awardXp(facade)
export function setLevels(rt: Runtime, c: Character, entries: ClassEntry[]): Outcome<readonly RuntimeEvent[]>; // rt.levelSet(facade)
export function checkBuild(rt: Runtime, race: string, entries: ClassEntry[]): readonly ErrorCard[];      // validateBuild
export function spend(rt, c, pool: string, amount: number): Outcome<RuntimeEvent>;                      // spendPool(rt, c.state, …)
export function prepare(rt, c, spellId: string, slotIndex?: number): Outcome<RuntimeEvent>;
export function cast(rt, c, spellId: string, slotIndex?: number): Outcome<RuntimeEvent>;
export function restNow(rt, c): Outcome<RuntimeEvent>;
export function apply(rt, c, conditionId: string): Outcome<RuntimeEvent>;
export function remove(rt, c, conditionId: string): Outcome<RuntimeEvent>;
export function tick(rt, c): Outcome<readonly RuntimeEvent[]>;
export interface CharacterView { state: CharacterState /* structuredClone */; derived: DerivedStats; pools: readonly string[];
  known: readonly string[]; restrictedActions: readonly string[]; restrictedSpells: readonly string[] }
export function viewOf(rt: Runtime, c: Character): CharacterView;
export function serialize(rt: Runtime, c: Character): CharacterSnapshot;   // serializeCharacter, verbatim (CA-06)
export function restore(rt: Runtime, snapshot: unknown): Outcome<Character>; // restoreCharacter; foreign pack → E-SNAP-01
```


<!-- v1-shell SESSION-E1-r2 -->
## Realized — v1-shell SESSION-E1-r2

### SESSION-E1 lease r2 — engine end-of-combat rule (engine `01dcf77`)

Engine M03 (runtime/combat), `../Ruleswright/src/runtime/combat/combat.ts` + `src/runtime/snapshots.ts`:

- **End rule `combat.sideDefeated` (D-26, engine-universal, not pack data):** after every resolution (declared or taken reactive action), if every combatant of one non-empty side has `hp.current ≤ 0`, then `state.phase = 'combat-over'`, open `pendingTriggers` lapse (cleared), and one event is emitted:
  `{ type: 'combat:ended', payload: { winner: 'allies' | 'enemies', defeated: 'allies' | 'enemies' }, why: { rule: 'combat.sideDefeated', rolls: [] } }` (no actor/target; `at` = the resolving turn's clock). It comes right after the final `action:resolved`.
- `step()` at `combat-over` returns `{ kind: 'combat-over' }` (existing variant). `declare()` throws `combat is over` (existing guard). `respond()` finds no pending offer and throws its existing "no pending trigger" error.
- **Downed combatants (hp ≤ 0):** turn advancement (`endTurn`, and `step()` when the active combatant is already down) passes over them, so no `turn:began` is emitted and no declare is demanded. When the rest of the order is all down, the round completes and the next round starts at the first standing combatant. They are offered no triggers.
- **Snapshots:** the combat envelope is unchanged (DB contract `snapshots.schema.json` has no phase field). `deserializeCombat` derives `phase` from the frozen hp: `combat-over` when the end rule holds, else `awaiting-declare` as before. `new Combat(runtime, fight.serialize())` carries `phase` verbatim.
- **Public types:** no public TypeScript declaration changed (`StepOutcome`, `CombatState`, `CombatPhase`, `CombatSnapshot`, `RuntimeEvent` are all as before). The new surface is the `combat:ended` event type string and its payload. The internal helpers `isDowned` and `defeatedSide` are exported from `combat.ts` but not from the `ruleswright/runtime` barrel.
