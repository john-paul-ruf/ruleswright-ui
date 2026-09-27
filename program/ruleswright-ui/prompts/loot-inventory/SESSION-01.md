# SESSION-01 — Engine refresh acceptance: `wyldwood` in the picker, gate green

> **Program:** Ruleswright (UI)
> **Feature:** loot-inventory
> **Modules:** M17 (tests only; no `src/` change)
> **Depends on:** —
> **Concurrent with:** SESSION-02, AUTHOR-SPEC-LI, AUTHOR-DESIGN-LI (disjoint files; shares only `e2e:out` with SESSION-02). SESSION-03 runs **after** this session (shared test files)
> **Owns:** `tests/engine/compiler.test.ts`, `tests/store/worlds.test.ts`, `tests/moods/map.test.ts`, `tests/engine/determinism.test.ts`, `e2e/shell.spec.ts`
> **Reads:** `src/renderer/src/engine/compiler.ts`, `src/renderer/src/engine/determinism.ts`, `src/renderer/src/moods/map.ts`, `src/renderer/src/store/worlds.ts`, `src/renderer/src/views/roll/**`, `e2e/fixtures.ts`, `node_modules/ruleswright/dist/compiler.d.ts`, `program/ruleswright-ui/specs/{requirements,design}.md`
> **Resources:** `e2e:out`
> **Checkpoints:** 2

## Module Context
| ID | Module | Read | Why |
|----|--------|------|-----|
| M06 | engine | `engine/compiler.ts` (`listThemes`, `forge`), `engine/determinism.ts` (`rerunSameSeed`) | the code under test; unchanged |
| M05 | moods | `moods/map.ts` (`moodForTheme`) | CA-10: unknown → archive |
| M17 | tests | the 5 owned files, `e2e/fixtures.ts` | assertions to refresh |

## Context
The installed engine (`node_modules/ruleswright/dist`, hard-linked to `../Ruleswright/dist`, built from `8b802b7`) now exports a third theme, `WYLDWOOD`. `listThemes()` finds it through library exports, as FR-2 requires ("not a hardcoded UI-side theme list"). The UI behaves correctly, but two tests pin the old two-theme list, so `pnpm test` is red (176/178; observed 2026-09-27):
- `tests/engine/compiler.test.ts:7`: `expect(themes.map((t) => t.id)).toEqual(['dark-fantasy', 'zombie-urban'])`
- `tests/store/worlds.test.ts:59`: `expect(fresh.getState().themes.map((t) => t.id)).toEqual(['dark-fantasy', 'zombie-urban'])`

This session restores the gate and proves the already-approved behavior for the new theme: picker card, forge, byte-determinism, and archive mood (per `design.md` FR-15: `*unknown* → archive`). **No `src/` change.** The human approved a dedicated wyldwood mood (Q2 (b)). Until SESSION-03 lands it, `archive` is the true behavior, so this session asserts `archive`, and SESSION-03 (serial after this session) flips exactly those assertions.

## Capabilities
- **CAP-01 (contributor + proof):** FR-2 theme discovery covers `wyldwood`. Path: library export `WYLDWOOD` → `listThemes()` → worlds store `themes` → Roll `ThemeCard` `roll-theme-wyldwood` → forge → World opens → `data-mood="archive"` → rerun-same-seed pass.
- Required facts: the theme list comes from `ruleswright/compiler` exports (producer: library, ready). The mood comes from `moodForTheme` (ready, unchanged).

## Contract Agreements
- **CA-11** (theme discovery, from v1-shell, unchanged): `listThemes()` = every exported ThemeTemplate-shaped value with `loadTheme(id) === value`, sorted by id. Re-derive the expectation **from the library**, not a literal list, so the next engine theme doesn't break this gate again:
  `const expected = Object.values(compiler).filter(isTemplate).map(t => t.id).sort()`. Import `* as compiler from 'ruleswright/compiler'` in the test (allowed: `tests/**` has `no-restricted-imports` off). Keep a literal floor too: `expect(ids).toEqual(expect.arrayContaining(['dark-fantasy', 'wyldwood', 'zombie-urban']))`. That catches a discovery regression that happens to drop a theme.
- **CA-10** (mood, unchanged): add `['wyldwood', 'archive']` to the `it.each` table in `tests/moods/map.test.ts`.
- **CA-12** (rerun = bytes): add a wyldwood seed-42 default-knob pass case to `tests/engine/determinism.test.ts`.

## Files to Create/Modify
| File | Action | What Changes |
|---|---|---|
| `tests/engine/compiler.test.ts` | modify | Replace the literal list at line 7 with the library-derived expectation plus the floor. Add a `forge('wyldwood', 42, defaults)` ok case (gated through `new Runtime`, `packJson === JSON.stringify(pack)`) |
| `tests/store/worlds.test.ts` | modify | Line 59: the same library-derived expectation (import `listThemes` from `engine/compiler` as the oracle, or the compiler namespace) |
| `tests/moods/map.test.ts` | modify | add `['wyldwood', 'archive']` |
| `tests/engine/determinism.test.ts` | modify | add a wyldwood · 42 byte-pass case |
| `e2e/shell.spec.ts` | modify | in the "mood follows the open world" test, after the zombie-urban leg: forge `wyldwood` · 7 → `data-mood` = `archive`, `active-world-seed` = `wyldwood · 7`. Assert `roll-theme-wyldwood` is visible. **Add only; change no existing assertion** |

## Implementation

### Checkpoint 0 — premise recheck (no commit)
Run `pnpm check:engine` (expect `engine ok`). Run `grep -c WYLDWOOD node_modules/ruleswright/dist/compiler.d.ts` (expect ≥ 1). Run `pnpm test` (expect exactly the 2 failures above). Read `e2e/shell.spec.ts` for the local `forge(page, theme, seed)` helper. If a premise is false, return `blocked` with the observed value.

### Checkpoint 1 — unit gate green
Edit the four `tests/**` files as above.
**Commit when:** `pnpm typecheck && pnpm lint && pnpm test` exit 0 (expect 18 files, ≥ 181 tests, 0 failed).
Commit: `git add -- <Owns> && git commit -m "loot-inventory SESSION-01: checkpoint 1 — theme list derived from the library; wyldwood mood/rerun unit proofs"`

### Checkpoint 2 — wyldwood e2e leg
Edit `e2e/shell.spec.ts` as above.
**Commit when:** `pnpm e2e` exit 0 (expect 17 passed; the edited test still one test). `test-results/build-identity.json` shows this session's HEAD.
Commit: `… checkpoint 2 — wyldwood forge → archive mood e2e (CAP-01)`

## Verification
- `pnpm verify` (= check:engine, typecheck, lint, test, e2e) exit 0. Hold `e2e:out` for the e2e step (H-1). A GUI session is required (H-2); if no display, report e2e **not run**, never passed.
- Artifact freshness: `pnpm e2e` globalSetup rebuilds `out/` and writes `test-results/build-identity.json`. Quote its head/dirty in the handoff.
- CAP-01/CA-10/CA-11/CA-12 IDs in the handoff.

## State Update
Report: commits, test counts, the build identity, and confirmation that no `src/` file changed (`git diff --stat c38aa8c -- src` empty).
