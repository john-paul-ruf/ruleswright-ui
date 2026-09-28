# M06 — engine (`src/renderer/src/engine/`)

**Status:** realized. The ONLY importer of `ruleswright`, `ruleswright/compiler`, `ruleswright/runtime`, `ruleswright/schema` (lint-enforced, Custom Rule 1, self-tested by `tests/lint/boundary.test.ts`; the grep for `ruleswright` imports outside `engine/` was empty after every combat-complete session). Consumed engine: `../Ruleswright` HEAD `dadf461` (installed dist verified by `pnpm check:engine`, combat-complete wave close `c22426a`).

**Imports (mechanical, non-test):** `ruleswright/*` (ext), M01 (`errors.ts` type-only `IpcError`/`IpcErrorCode`; `schema.ts` type `PackIdentity`; `determinism.ts`/`replay.ts` type `WorldMeta` — all type-only, so M06 → M01 carries no runtime value import), intra-module files.

| File | Realized by | Responsibility |
|---|---|---|
| `errors.ts` | v1-shell S01 c3 `5fcf552` | `AppError` (`library` / `host` / `unexpected`), `toAppError(operation, e)`, `fromIpcError(err)`; re-exports `type ErrorCard`. Library cards carried verbatim — never paraphrased (CA-05). |
| `compiler.ts` | v1-shell S01 c3 | `listThemes(): ThemeInfo[]` (D-04 discovery), `forge(themeId, seed, knobs): ForgeResult` (`packJson = JSON.stringify(pack)`, gate through `new Runtime`), `type KnobSpec` (`KnobDecl & {id}`), `KnobDecl`/`ThemeTemplate`/`Pack` re-exported. |
| `schema.ts` | v1-shell S01 c3 | `openPack(packJson): PackGate` (JSON.parse → `new Runtime(parsed)`; Custom Rule 4), `importPackText(text): ImportResult` (canonical bytes + provenance params, D-03/D-05), `packIdentityOf(pack)` (via `packContentHash`); re-exports type `Runtime`. |
| `determinism.ts` | v1-shell S04 `33481cf`, `d310755` | `rerunSameSeed`, `rerunUnavailableReason`. |
| `runtime.ts` | v1-shell S05 `c38946e`; loot-inventory S02 `fb3aebd` | character wrappers + inventory/loot. |
| `combat.ts` | v1-shell S06 `c71e320`; combat-complete S01/S03/S04/S05 | fight start (grid, ally spawns), declare/step/respond/move, spatial + economy pass-throughs, threat assembly. |
| `combat-profile.ts` | v1-shell S06 (B-1 = A) | character → `CharacterCombatant` via the engine's `profileFromCharacter`. |
| `replay.ts` | v1-shell S06 c5 `98a14e3`; combat-complete S01/S04/S06 | record, replay, resume over one shared rebuild. |

## `engine/determinism.ts`
- `type RerunResult = {status:'pass'; bytes; ms} | {status:'fail'; offset; storedLength; rerunLength; storedExcerpt; rerunExcerpt} | {status:'unavailable'; reason} | {status:'error'; error: AppError}`.
- `rerunSameSeed(meta: Pick<WorldMeta,'theme'|'seed'|'knobs'>, storedPackJson): RerunResult` — `generateCampaign({theme: loadTheme(theme), seed, knobs})` → `JSON.stringify` → strict `===` with the stored string (CA-12 of v1-shell). `offset` = first differing UTF-16 index; excerpts ±40 chars; library throws → `toAppError('rerun', e)`.
- `rerunUnavailableReason(meta): string | null` — `'generation parameters unknown (imported pack)'` when any param is null; `'theme not provided by this engine build'` when the theme is not in `listThemes()`. Pure; imported directly by M12 (recorded module edge).

## `engine/runtime.ts`
Imports `ruleswright/runtime` and `./errors`. Every mutator returns `Outcome<T>`; library throws → `toAppError(operation, e)` (CA-05). Operations: `character:create|award-xp|set-level|spend|prepare|cast|rest|apply-condition|remove-condition|tick|grant-item|drop-item|loot`, `snapshot:restore`.
```ts
export type { Character, CharacterState, DerivedStats, RuntimeEvent, CharacterSnapshot, ClassEntry, InventoryEntry } from 'ruleswright/runtime';
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: AppError };
export function create(rt, req: { name; race; classes: ClassEntry[] }): Outcome<Character>;
export function awardXp(rt, c, amount): Outcome<readonly RuntimeEvent[]>;
export function setLevels(rt, c, entries: ClassEntry[]): Outcome<readonly RuntimeEvent[]>;
export function checkBuild(rt, race, entries): readonly ErrorCard[];            // validateBuild
export function spend(rt, c, pool, amount): Outcome<RuntimeEvent>;
export function prepare(rt, c, spellId, slotIndex?): Outcome<RuntimeEvent>;
export function cast(rt, c, spellId, slotIndex?): Outcome<RuntimeEvent>;
export function restNow(rt, c): Outcome<RuntimeEvent>;
export function apply(rt, c, conditionId): Outcome<RuntimeEvent>;
export function remove(rt, c, conditionId): Outcome<RuntimeEvent>;
export function tick(rt, c): Outcome<readonly RuntimeEvent[]>;
export function grant(rt, c, itemId, qty): Outcome<RuntimeEvent>;               // grantItem (FR-18)
export function drop(rt, c, itemId, qty): Outcome<RuntimeEvent>;                // dropItem
export function loot(rt, c, tableId, seed: number): Outcome<readonly RuntimeEvent[]>; // grantLoot, passes exactly {seed} (CA-14 of loot-inventory)
export function lootTableIds(rt): readonly string[];                             // rt.pack.tables ids ending in `-loot`
export interface ItemOption { id; name: string | null; kind: string | null }
export interface CharacterView { state /* structuredClone */; derived; pools; known; restrictedActions; restrictedSpells;
  items: readonly ItemOption[] /* content.items in pack order, verbatim */; lootTables: readonly string[] }  // CA-13 of loot-inventory
export function viewOf(rt, c): CharacterView;
export function serialize(rt, c): CharacterSnapshot;   // serializeCharacter, verbatim (CA-06)
export function restore(rt, snapshot: unknown): Outcome<Character>; // restoreCharacter; foreign pack → E-SNAP-01
```

## `engine/combat.ts`
Imports from `ruleswright/runtime`: `assembleEncounter`, `bestiaryIds`, `deserializeCombat`, `resolveSlotGrants`, `serializeCombat`, `spatialFromPack`, `spawnEncounter`, `spawnMonster`, `startCombat` (+ types); `ruleswright/schema` types `ActionCost`, `Pack`, `SpatialDef`; `./errors`; types from `./runtime`.

**Types.** `SpawnSpec {statblockId, instanceId}` (either side; `EnemySpec` is an alias). `FightStart {ally: {id, snapshot}, enemies, positions?, allySpawns?}`. `ScriptEntry` = declare | respond | step | `{op:'move', positions}`. `AllyCombatant {profile, balances?}`. `Sides {allies, enemies: {id, profile}[]}` — the sides exactly as `startCombat` took them. `LiveFight {fight: Combat, sides}` — a `move` replaces `fight`. `DeclareResult`. `ActionInfo {actionId, cost: ActionCost, tags, triggerOn: string|null, valid: string|null}`. Re-exports `Combat`, `CombatState`, `CombatPhase`, `CombatantProfile`, `CombatantState`, `RuntimeEvent`, `StepOutcome`, `PendingTrigger`, `CombatSnapshot`, `CharacterSnapshot`, `DeclareOptions`, `Encounter`, `Position`, `CombatRestoreRequest`, `ActionCost`, `SpatialDef`.

**Functions.**
- `listSpawnable(rt)`, `spawnProfile(rt, statblockId, instanceId): Outcome<CombatantProfile>`.
- `begin(rt, ally, enemies, positions?, allySpawns = []): Outcome<LiveFight>` — allies passed to `startCombat` are `[character, ...allySpawns.map(spawnMonster)]` (CA-04b), enemies spawned the same way; `positions` go to `startCombat` verbatim (CA-12). On a grid pack with no positions the library's `E-SPAT-01` refusal comes back as `kind 'library'`, operation `fight:begin`. CA-05: before any `spawnMonster`/`startCombat` call, an id used twice across ally, ally spawns and enemies is refused with `{kind:'unexpected', operation:'fight:begin', message:'combatant id "<id>" is used twice — ids must be unique across both sides'}` (mitigates engine gap EG-1).
- `reposition(live, positions): Outcome<Combat>` (CA-13) — runs `serializeCombat` → `deserializeCombat`, re-stating `live.sides` with the **live** `{pools, boundSlots}` from `fight.state.combatants[id]` (CX-D11). Preconditions, in this order, each an `unexpected` `combat:move` naming the condition: (1) the pack is spatial, (2) no open offer, (3) phase `awaiting-declare` (CX-D10). A library throw → `toAppError('combat:move')`. Emits zero events; success replaces `live.fight`.
- `declare(fight, actionId, targetId?): Outcome<DeclareResult>` (events captured by a per-call sink; a rejection is an event, never a throw), `step(fight)`, `respond(fight, triggerId, choice, targetId?)`.
- `perform(live, entry): Outcome<unknown>` — dispatches one `ScriptEntry`; `move` → `reposition`.
- `subscribe(rt, sink): () => void`.
- Spatial pass-throughs: `spatialLabel(pack)` (`'grid'` when `spatialFromPack(pack).enabled`, else `'theater-of-mind'`; every generated pack on `dadf461` is grid), `spatialOf(pack): SpatialDef | null` (verbatim `pack.spatial`), `distance(rt, a, b)` (`rt.spatial.distance`, CA-15).
- Economy pass-throughs: `slotGrants(rt)` = `resolveSlotGrants(rt.pack).slots` verbatim (CA-02); `actionInfo(pack, actionId)` = own-property lookup of `pack.actions[actionId]` with `tags ?? []`, `trigger?.on ?? null`, `valid ?? null`, no `effect` (CA-03); unknown or prototype keys → null.
- `assemble(rt, budget, seed): Outcome<{encounter: Encounter, spawns: SpawnSpec[]}>` over `assembleEncounter(rt, {budget, seed})` + `spawnEncounter`. CA-07: `spawns[i].instanceId` = the returned `profile.id`, `statblockId` = `encounter.groups` expanded in order; a count mismatch → `unexpected` `fight:assemble` (not exercised by any test — verification debt, see Final Report); a library throw (e.g. empty bestiary) → `toAppError('fight:assemble', e)`.

## `engine/combat-profile.ts`
Imports `ruleswright/runtime` `profileFromCharacter`. `allyProfile(rt, character, id?): Outcome<CharacterCombatant>` — passes the library result straight through; the UI does no profile math. Library throws `no-combat-actions` when the class action union is empty. Re-exports types `CharacterCombatant`, `EconomyBalances`.

## `engine/replay.ts`
Imports `ruleswright/runtime` `serializeCombat`; `./combat` (`begin`, `perform`, `subscribe`), `./combat-profile`, `./determinism` (`rerunSameSeed`), `./errors`, `./runtime` (`restore`), `./schema` (`openPack`).
- Types: `Declaration {combatantId, action, options}`, `Recording {start, script, events, combat, declarations}`, `ReplayResult` (`complete` | `diverged` stage `pack` | `diverged` stage `events` + `index`/`expected`/`actual` | `unavailable` | `error`), `ResumeResult` (`resumed {live, events, hpAtStart}` | `diverged {index, expected?, actual?}` | `unavailable` | `error`).
- `recordingOf(fight, start, script, events, declarations): Recording` — `combat` = `serializeCombat(fight, {pairsWith: start.ally.id})`.
- Private `rebuild(operation, storedPackJson, {start, script})`: `openPack` → restore the ally → `allyProfile` → subscribe → `begin(…, start.positions, start.allySpawns ?? [])` → capture `hpAtStart` → `perform` each script entry. Shared by replay and resume (combat-complete S06).
- `replay(meta, storedPackJson, rec)` — re-roll (`rerunSameSeed`) first: pack divergence is reported before any combat; else rebuild and compare events index by index.
- `resume(storedPackJson, rec)` — the rebuild on the stored pack bytes with **no** re-roll (imported worlds resume too). The rebuilt fight is handed over only when every event equals `rec.events` (CX-D6, human-approved Q3 = a). Known limit: a tampered **trailing** `move` emits no events and is not refused — open product question B-CX-7.
- Missing `script`/`start`/`events` → `unavailable` with the shared reason `record has no replay script (recorded before B-2)`; a spatial record without `start.positions` → `error` with the library's `E-SPAT-01` cards; a record whose ids collide → `begin`'s CA-05 refusal as `error`.

## Verified library facts (probes and session proofs)
- Theme discovery, `loadTheme`, `GenerationError`/`PackLoadError`/`CharacterBuildError`/`RuntimeRuleError` shapes; `Combat.declare()` returns/emits `declare:rejected` rather than throwing; `CharacterSnapshot` holds no RNG words (RNG words live in `CombatState.rng` / `CombatSnapshot.rng`); `restoreCharacter` across worlds → E-SNAP-01 (v1-shell probes, reconfirmed by later sessions).
- End of combat (engine `01dcf77`, D-26): `combat:ended` `{winner, defeated}` with `why.rule 'combat.sideDefeated'` after every resolution; downed combatants skipped and offered no triggers; `step()` at `combat-over` returns `{kind:'combat-over'}`; `deserializeCombat` derives `phase` from frozen hp. `isDowned`/`defeatedSide` are not exported (EG-2).
- Grid (engine `dadf461`, combat-complete probes probe-grid/probe-grid2, S01 c0): `startCombat` without positions on a spatial pack → `E-SPAT-01` per combatant; reach/validity rejections arrive as `declare:rejected` kinds `valid`/`spatial`; serialize → restore keeps rng, pools and phase and emits 0 events; restore after a declare grants a second action (hence CX-D10).
- Observed by sessions (Coders corrected plan premises against the real engine): the barrow wight acts first in dark-fantasy·42; turn slots refill on the first Step of a turn, not at turn handover (shown, not changed); a threat-budget group of count 1 spawns with the bare statblock id, count > 1 as `<id>-<n>`; `startCombat`/restore accepts a `positions` key naming no combatant (EG-8).
- Engine gaps owned by `../Ruleswright` (UI shows what the library holds): EG-1 duplicate ids merged (mitigated by CA-05), EG-2 downed not exported, EG-3 combat conditions never tick / character conditions not carried, EG-4 reach overrides keyed by combatant vs statblock id, EG-5 no movement verb, EG-6 `serializeCombat` keeps one open offer per combatant, EG-7 bursts not declarable, EG-8 positions for absent combatants accepted.

## Upstream engine API history
- SESSION-E1 (engine `a5c20ea`, `6a5bc0a`, `f0bf58e`): `ClassDef.actions?` (pack v1.2), both themes declare class actions, `profileFromCharacter` exported (arch `2d11736`).
- SESSION-E1 r2 (engine `01dcf77`): end-of-combat rule above (arch `f076529`).
- loot-inventory (engine `f792f49`, dist `8b802b7`): `grantItem`/`dropItem`/`grantLoot`, `InventoryEntry`, `wyldwood` theme.
- combat-complete (engine `dadf461`): spatial model (`startCombat` `positions`, `Position`, `SpatialDef`, `rt.spatial.distance`), `resolveSlotGrants`, `assembleEncounter`/`spawnEncounter`/`Encounter`. Pre-`dadf461` worlds fail rerun honestly and their records replay pack-diverged (LI-D4 class).

## Change history
- v1-shell: S01 c3 errors/compiler/schema; S04 determinism; S05 runtime; S06 c1–c5 combat, combat-profile, replay.
- loot-inventory S02 c1 (`fb3aebd`): inventory wrappers (arch delta `a8b78cb`).
- combat-complete S01 c1–c2 (`afdd9dc`, `bb1af82`): `LiveFight`/`Sides`, `begin → Outcome<LiveFight>`, `reposition`, `perform(live, …)`, `spatialOf`, `distance`; replay with positions/moves (arch `268a2f1`).
- combat-complete S03 c1 (`229cd74`): `slotGrants`, `actionInfo` (arch `e033c16`).
- combat-complete S04 c1 (`497ab84`): `SpawnSpec`, `begin(…, allySpawns)`, CA-05 refusal; replay spawns `allySpawns` (arch `79fe4fc`).
- combat-complete S05 c1 (`650668d`): `assemble` (arch `a19a902`).
- combat-complete S06 c1 (`1951f76`): `resume`/`ResumeResult`, shared `rebuild` (arch `acfc1fa`).
