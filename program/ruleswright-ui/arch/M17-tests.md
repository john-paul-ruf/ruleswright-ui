# M17 — tests (`tests/`, `e2e/`)

**Status:** realized (v1-shell S01 harness `ca1d972`/`b9f3518`; surface specs land with their owning sessions). Each session owns only its own spec files; shared harness files are v1-shell S01's. Tests and e2e are exempt from the engine import restriction: they compute expected values with the real library (reference fights, `assembleEncounter`, `serializeCombat`).

## Harness (realized)
- `tests/support/in-process-bridge.ts` — `createInProcessBridge(root, dialogs?): RuleswrightApi` built from the **real** `createIpcHandlers({storage: createStorage(root), dialogs: fake})` (skips only the Electron transport); payloads/results structured-cloned like IPC. Exports `createFakeDialogs()` / `FakeDialogs`. `tests/support/tmp.ts` temp-dir helpers. Store "restart legs" use it over a temp dir.
- `tests/support/eslint.d.ts` — minimal ambient types for `eslint@8`.
- `e2e/fixtures.ts` — `mkdtemp` userData → `_electron.launch({args: [out/main/index.js], env: {…, RULESWRIGHT_USER_DATA: dir}})` with `ELECTRON_RENDERER_URL` stripped (the built renderer is always exercised; H-2 needs a GUI session); `firstWindow()`, request recorder (FR-17), `restart()` (close + relaunch on the same dir), `stubSaveDialog` / `stubOpenDialog`; fixture `rw`; cleanup `rmSync`.
- `e2e/global-setup.ts` — runs `pnpm build` (fresh `out/`) and writes `test-results/build-identity.json` `{head, dirty, porcelainSha256, builtAt}`; `dirty: true` whenever uncommitted files exist.
- `tests/lint/boundary.test.ts` — ESLint API self-test of Custom Rules 1 & 3.
- `tests/scripts/check-engine.test.ts` — self-test of `scripts/check-engine.mjs` (M18).
- `tests/styles/contrast.test.ts` — the AA contrast gate over all four moods (M04).

## Files (as of combat-complete `c22426a`)
- Unit (18 files): `tests/engine/{errors,compiler,schema,determinism,runtime,combat,replay}.test.ts`, `tests/store/{worlds,worlds-manage,determinism,character,combat}.test.ts`, `tests/main/{storage,ipc}.test.ts`, `tests/moods/map.test.ts`, `tests/styles/contrast.test.ts`, `tests/lint/boundary.test.ts`, `tests/scripts/check-engine.test.ts`.
- e2e (8 specs): `journey`, `shell`, `roll`, `world`, `character`, `inventory`, `combat`, `replay` (`e2e/*.spec.ts`).

## Proof owners by feature
- **v1-shell:** S01 harness + journey (CAP-01); S02 styles/moods + shell; S03 worlds-manage + roll; S04 determinism + world; S05 runtime/character + character.spec; S06 combat/replay units, storage/ipc B-2, `combat.spec` + `replay.spec` (`RW_SHOTS_DIR` screenshot opt-in).
- **loot-inventory:** S01 engine-refresh acceptance (compiler/determinism/runtime/worlds tests, `wyldwood` in `shell.spec`); S02 inventory cases in `runtime.test`/`character.test` + `e2e/inventory.spec.ts` (loot, stacking, grant/drop, rejection cards, disk deep-equal, restart + restore, no-loot world); S03 `wild` in `moods/map.test` and the contrast gate (`MOODS` gains `wild`, `designTable()` reads the 5th column, 12 non-empty tokens per mood) + `shell.spec` wyldwood mood/rerun.
- **combat-complete** (unit red window 18 failed / 1 typecheck error at start, closed by S01 c3; e2e red window combat/replay 4/4 failed, closed by S02 c3):
  - S01: `tests/main/{storage,ipc}.test.ts` ('CX placement and moves'; `ipc.test.ts` refusal-text assertion via lease r2), `tests/engine/{combat,replay}.test.ts` (positions, reposition preconditions, move replay complete / tampered diverged / missing positions → E-SPAT-01), `tests/store/combat.test.ts` (placement, restart leg through the real main handlers).
  - S02: `e2e/combat.spec.ts` "CAP-06: grid fight …" and "theater-of-mind: …" (a generated pack with `spatial` deleted, pasted through Import — CX-D13); `e2e/replay.spec.ts` "CAP-06 / CA-14: … recorded, then replays complete after a restart". **Convention:** reference fights read positions from `fight-place-<id>` before Begin.
  - S03: engine 'slot grants and action detail (CA-02, CA-03)'; store 'initiative provenance (CAP-01, CA-01)'; e2e 'CAP-01/02: turn order, initiative, slot ledgers, conditions and action detail, in lockstep with the library'; the theater test also asserts the caption.
  - S04: `referenceFight(pack, wights, positions?, allySpawns = [])`; e2e 'CAP-03 …' (lockstep to combat-over) and replay 'CAP-03 / CA-04b …' (`FightFile.start.allySpawns?`); CA-05 and CA-06 legacy units.
  - S05: engine 'threat-budget assembly (CAP-04, CA-07, CA-08)' (5), store 'threat-budget assembly (CAP-04, CA-05, CA-07, CA-08)' (5, incl. restart leg), e2e 'CAP-04: …' (budget 3 · seed 7 summary = Node `assembleEncounter`). The CA-07 length-mismatch guard is not exercised (needs a library mock; verification debt).
  - S06: engine 'resume (FR-14, CA-09, CA-10)' (+7), store 'resume (CAP-05, CA-09..11)' (+3), e2e replay 'CAP-05 / CA-09..11 …' (+1: mid-fight grid record with a reposition → restart → Resume at the recorded point → one call → record → replay complete; tampered move refused at the divergence index).
  - Every packaged proof had an uncommitted negative control confirmed to fail.

## Final gates
| Feature close | Commit | check:engine | typecheck / lint | unit | e2e | identity |
|---|---|---|---|---|---|---|
| v1-shell | `98a14e3` | ok | 0 / 0 | 178 (18 files) | 17/17 | dirty false |
| loot-inventory | `0452776` | ok | 0 / 0 | 199/199 (18 files) | 18/18 | dirty false |
| combat-complete | `c22426a` | ok (`ruleswright@0.1.0`, engine `dadf461`) | 0 / 0 | 254/254 | 26/26 | dirty false |

## Change history
- v1-shell S01–S06: harness and surface specs (arch `43f660c`, `17d435e`, later deltas).
- loot-inventory S01–S03: inventory + wild mood proofs (arch `a8b78cb`, `e14f2e4`).
- combat-complete S01–S06: grid, economy, ally spawns, threat assembly, resume proofs (arch `268a2f1`, `c02ec42`, `e033c16`, `79fe4fc`, `a19a902`, `acfc1fa`).
