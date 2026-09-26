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
