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
