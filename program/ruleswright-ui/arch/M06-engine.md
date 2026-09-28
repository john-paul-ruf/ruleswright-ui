# M06 — engine (`src/renderer/src/engine/`)

**Status:** realized. The ONLY importer of `ruleswright`, `ruleswright/compiler`, `ruleswright/runtime`, `ruleswright/schema` (lint-enforced, Custom Rule 1, self-tested by `tests/lint/boundary.test.ts`).

| File | Session | Realized |
|---|---|---|
| `errors.ts` | S01 c3 | `AppError` (`library` / `host` / `unexpected`), `toAppError(operation, e)`, `fromIpcError(err)`; re-exports `type ErrorCard`. Library cards carried verbatim — never paraphrased (CA-05). |
| `compiler.ts` | S01 c3 | `listThemes(): ThemeInfo[]` (D-04 discovery), `forge(themeId, seed, knobs): ForgeResult` (`packJson = JSON.stringify(pack)`, gate through `new Runtime`), `type KnobSpec` (the library's `KnobDeclWithId`, which it does not export, joined as `KnobDecl & {id}`), `KnobDecl`/`ThemeTemplate`/`Pack` types re-exported. |
| `schema.ts` | S01 c3 | `openPack(packJson): PackGate` (JSON.parse → `new Runtime(parsed)`; bare `validatePack` is not a gate — Custom Rule 4), `importPackText(text): ImportResult` (canonical bytes + provenance params, D-03/D-05), `packIdentityOf(pack): PackIdentity` (via `packContentHash`). |
| `determinism.ts` | S04 | `rerunSameSeed` + `rerunUnavailableReason` — see below. |
| `runtime.ts` | S05 | character wrappers: create, derived, progression, pools/spells, conditions, restrictions, serialize/restore — see below. |
| `combat.ts` | S06 | start/declare/step/respond wrappers + event subscription. |
| `combat-profile.ts` | S06 (B-1 = A, D-18) | character → `CharacterCombatant` via the engine's `profileFromCharacter`. |
| `replay.ts` | S06 (B-2, D-19) | record script + replay with divergence detection. |

## `engine/determinism.ts` (SESSION-04 c1 `33481cf`, c2 `d310755`)
- `type RerunResult = {status:'pass'; bytes; ms} | {status:'fail'; offset; storedLength; rerunLength; storedExcerpt; rerunExcerpt} | {status:'unavailable'; reason} | {status:'error'; error: AppError}`.
- `rerunSameSeed(meta: Pick<WorldMeta,'theme'|'seed'|'knobs'>, storedPackJson: string): RerunResult` — `generateCampaign({theme: loadTheme(theme), seed, knobs})` → `JSON.stringify` → strict `===` with the stored string (CA-12). `bytes` = UTF-8 byte length; `offset` = first differing UTF-16 index (or the shorter length); excerpts = `slice(offset−40, offset+40)` of each; library throws → `toAppError('rerun', e)`.
- `rerunUnavailableReason(meta): string | null` — `'generation parameters unknown (imported pack)'` when any param is null; `'theme not provided by this engine build'` when the theme is not in `listThemes()`.
- Imports: `ruleswright/compiler` (`generateCampaign`, `loadTheme`), `./compiler` (`listThemes`), `./errors`.

## `engine/runtime.ts` (SESSION-05 c1 `c38946e`)
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

## `engine/combat.ts` (SESSION-06 c1 `c71e320`)
Imports `ruleswright/runtime` (`bestiaryIds`, `spatialFromPack`, `spawnMonster`, `startCombat`); `ruleswright/schema` type `Pack`; `./errors`; types from `./runtime`.
- `listSpawnable(rt)`, `spawnProfile(rt, statblockId, instanceId): Outcome<CombatantProfile>`,
  `begin(rt, ally: {profile, balances?}, enemies: EnemySpec[]): Outcome<Combat>` (ally id = `profile.id`),
  `declare(fight, actionId, targetId?): Outcome<{events, rejection}>` (events captured by a per-call sink — the library returns the whole round; a rejection is an event, never a throw),
  `step(fight): Outcome<StepOutcome>`, `respond(fight, triggerId, choice, targetId?): Outcome<RuntimeEvent[]>` (own events),
  `perform(fight, entry: ScriptEntry)`, `subscribe(rt, sink): () => void`, `spatialLabel(pack): 'theater-of-mind' | 'grid'`.
  Types: `EnemySpec`, `FightStart`, `ScriptEntry`, `AllyCombatant`, `DeclareResult` + re-exports (Combat, CombatState, CombatPhase, CombatantProfile, CombatantState, RuntimeEvent, StepOutcome, PendingTrigger, CombatSnapshot, CharacterSnapshot, DeclareOptions).

## `engine/combat-profile.ts` (SESSION-06 c1, CA-08, B-1 = A)
Imports `ruleswright/runtime` `profileFromCharacter`. `allyProfile(rt, character, id?): Outcome<CharacterCombatant>` — wraps the export and passes its result straight through; the UI does no profile math. Throws `no-combat-actions` when the class action union is empty.

## `engine/replay.ts` (SESSION-06 c5 `98a14e3`)
Imports `ruleswright/runtime` `serializeCombat`; `./combat` (`begin`, `perform`, `subscribe`), `./combat-profile` (`allyProfile`), `./determinism` (`rerunSameSeed`), `./errors`, `./runtime` (`restore`), `./schema` (`openPack`).
- `recordingOf(fight, start, script, events, declarations): Recording` — `declarations` are the script's declare calls with the combatant active when each was issued; `combat` is `serializeCombat(fight, {pairsWith: start.ally.id})`.
- `replay(meta, storedPackJson, rec): {result: ReplayResult, events}` — re-roll (`rerunSameSeed`) → pack divergence reported before any combat, else open the stored pack, restore the ally, re-apply the script and compare events index by index. Null params or a record without `script` → unavailable, never guessed. Types `Recording`, `ReplayResult`, `Declaration`.

## Verified library facts (plan-time probes; still true of installed dist `01dcf77`)
- No theme enumerator; `loadTheme(name)` switches on `dark-fantasy|zombie-urban`; `DARK_FANTASY`/`ZOMBIE_URBAN` exported.
- `generateCampaign` throws `GenerationError{errors: ErrorCard[]}` (unknown knob → E-SCHEMA-01 card); `KnobRejection` is a type only, never thrown alone.
- `new Runtime(bad)` throws `PackLoadError{errors}` (uses the unexported `packDslChecker`, `runtime.ts:73`); `createCharacter` throws `CharacterBuildError{errors}`; pool/spell/condition failures throw `RuntimeRuleError{errors}`.
- `Combat.declare()` does **not** throw on rejection: it returns/emits a `declare:rejected` event (`payload {kind, resource, message}`, `why.rule`).
- `CharacterSnapshot = {kind, snapshotVersion, pack:{id,schemaVersion,contentHash}, state}` — **no RNG words** (B-3). RNG words exist in `CombatState.rng` / `CombatSnapshot.rng`.
- `restoreCharacter` on another world's runtime throws `RuntimeRuleError` E-SNAP-01.
- Combat dice default to `new Rng(0)`; `Rng` is not exported.

## Change history
- v1-shell plan: created (planned, per-file table above).
- SESSION-01 c3 (`5fcf552`): `errors.ts`, `compiler.ts`, `schema.ts` realized.
- SESSION-04 c1/c2 (`33481cf`, `d310755`): `determinism.ts` realized.
- SESSION-05 c1 (`c38946e`): `runtime.ts` realized (every probe fact reproduced against the installed library).
- SESSION-E1 (engine `a5c20ea`, `6a5bc0a`, `f0bf58e`, `01dcf77`): upstream engine public-API delta consumed by `combat-profile.ts` — see below.
- SESSION-06 c1–c5: `combat.ts`, `combat-profile.ts`, `replay.ts` realized; `begin` takes `{profile, balances?}`, `declare` returns an `Outcome`, `allyProfile` optional `id`, `recordingOf(fight, start, script, events, declarations)`.

## Upstream engine API delta — SESSION-E1 (engine commits a5c20ea, 6a5bc0a, f0bf58e)
- **engine M01 schema:** `ClassDef.actions?: KebabId[]` (pack v1.2, `src/schema/artifacts.ts:85`). `validatePack`/`checkClasses` accepts `actions`: non-array → `E-SCHEMA-01` at `content.classes.<id>.actions`; non-kebab entry or duplicate → `E-SCHEMA-01` at `…actions[i]` (uniqueItems); unresolved id → `E-REF-01` at `…actions[i]` with a nearest-id hint. Empty or absent list is valid. `schemaVersion` stays 1.
- **engine M04 compiler:** both bundled themes declare class actions (D-23). `stages/classes.ts` unchanged: it already `structuredClone`s class defs verbatim. Pack bytes changed: dark-fantasy·42 15,863 B → 16,056 B (`packContentHash` a5b8b1b2 → 5dc003f3); zombie-urban·42 9,154 B → 9,352 B (d92d1050 → e84a0aed).
- **engine M03 runtime (new file `src/runtime/character-profile.ts`), exported from `ruleswright/runtime` and via `export *` from the root barrel (`src/index.ts` unchanged):**
  ```ts
  export interface CharacterCombatant { readonly profile: CombatantProfile; readonly balances: EconomyBalances }
  export function profileFromCharacter(runtime: Runtime, character: Character, id?: string): CharacterCombatant;
  ```
  Imports M03-internal only (`evalPackFormula` from `combat/resolve`, `RuntimeRuleError`/`ruleCard`) + M01 types. Throws `RuntimeRuleError` with rule `no-combat-actions` (artifactId = first class id, jsonPath `content.classes`) when the class action union is empty. Active conditions are not carried (v1 limit).
- **Upstream end-of-combat rule (SESSION-E1 r2, engine `01dcf77`, D-26):** `Combat.resolve()` runs `endIfSideDefeated()` after every declared or reactive resolution — when every combatant of one non-empty side is at `hp.current ≤ 0`, it sets `phase: 'combat-over'`, clears open offers (`pendingTriggers` cleared), and emits one `combat:ended` event with payload `{winner: 'allies'|'enemies', defeated}` and `why.rule 'combat.sideDefeated'` (no actor/target; `at` = the resolving turn's clock). Downed combatants are skipped in turn order (`advanceFrom`) and are offered no triggers (`surfaceOffers` refuses them). `step()` at `combat-over` returns `{kind:'combat-over'}`; `declare()` throws its existing `combat is over` guard; `respond()` throws its existing "no pending trigger" error. The combat envelope is unchanged (`snapshots.schema.json` has no phase field): `deserializeCombat` derives `phase` from the frozen hp — `combat-over` when `defeatedSide(combatants)` holds, else `awaiting-declare` as before. **No public TypeScript declaration changed** (`StepOutcome`, `CombatState`, `CombatPhase`, `CombatSnapshot`, `RuntimeEvent` all as before); the new public surface is the event type string `combat:ended` and its payload. Internal helpers `isDowned`/`defeatedSide` are exported from `combat.ts` but not from the barrel. Known engine gaps left unchanged (outside lease, carried to the engine program): combat snapshots can hold negative hp vs schema `minimum: 0` (harmless on the restore path, observed by S06); one-sided (empty-side) fights never end; conditions are not carried into combat.

## Change history (upstream deltas)
- Arch fragment `.program/signal/SESSION-E1.arch.md` integrated at `2d11736` (upstream API delta).
- Arch fragment integrated at `f076529` (upstream end-of-combat rule, engine `01dcf77`).

<!-- loot-inventory SESSION-02 -->
### loot-inventory SESSION-02 delta — M06 engine
— `engine/runtime.ts`
- New value imports from `ruleswright/runtime`: `grantItem`, `dropItem`, `grantLoot`.
- New exports:
  - `grant(rt, c, itemId, qty): Outcome<RuntimeEvent>` — operation `character:grant-item`.
  - `drop(rt, c, itemId, qty): Outcome<RuntimeEvent>` — operation `character:drop-item`.
  - `loot(rt, c, tableId, seed: number): Outcome<readonly RuntimeEvent[]>` — operation `character:loot`; passes exactly `{ seed }` (CA-14).
  - `lootTableIds(rt): readonly string[]` — `rt.pack.tables` ids ending in `-loot`.
  - `interface ItemOption { id; name: string | null; kind: string | null }`.
  - `type InventoryEntry` re-exported from `ruleswright/runtime`.
- `CharacterView` gains `items: readonly ItemOption[]` (`pack.content.items` in pack order, verbatim, `null` when absent) and `lootTables: readonly string[]`; both filled in `viewOf` (CA-13).


<!-- combat-complete SESSION-01 --> M06
### combat-complete SESSION-01 delta — M06 engine — `src/renderer/src/engine/combat.ts`, `replay.ts`
- Type re-exports: `Position`, `CombatRestoreRequest` (runtime) and `SpatialDef` (schema).
- `FightStart.positions?: Record<string, Position>`; `ScriptEntry` gains `{op:'move'; positions}`.
- `interface Sides { allies, enemies: {id, profile}[] }` holds the sides exactly as `startCombat` took them.
- `interface LiveFight { fight: Combat; sides: Sides }`: a `move` replaces `fight` in place.
- `begin(rt, ally, enemies, positions?) → Outcome<LiveFight>` (was `Outcome<Combat>`). Positions go to `startCombat` verbatim. On a grid pack with no positions it returns the library's `E-SPAT-01` refusal (`kind 'library'`, operation `fight:begin`).
- `reposition(live, positions) → Outcome<Combat>` (CA-13) runs through `serializeCombat` → `deserializeCombat`. The begin-time sides are re-stated with live `{pools, boundSlots}` copied from `fight.state.combatants[id]`.
  - Preconditions are checked in this order. Each failure returns `{kind:'unexpected', operation:'combat:move'}`, naming the condition:
    1. the pack is spatial;
    2. no open offer;
    3. phase is `awaiting-declare`.
  - A library throw becomes `toAppError('combat:move')`. Success replaces `live.fight`. It emits zero events.
- `perform(live: LiveFight, entry) → Outcome<unknown>` (was `perform(fight: Combat, …)`); `move` → `reposition`.
- `spatialOf(pack) → SpatialDef | null` (verbatim `pack.spatial`).
- `distance(rt, a, b) → number` (`rt.spatial.distance`).
- `spatialLabel(pack)` is now typed (no cast); every generated pack is `'grid'`.
- `replay.ts`: begins with `rec.start.positions` and re-applies the script through `perform(live, …)`. The result shape is unchanged. A spatial record without `start.positions` gives `{status:'error'}` with the library's `E-SPAT-01` cards.
