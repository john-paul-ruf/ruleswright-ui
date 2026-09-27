# M05 — moods (`src/renderer/src/moods/`)

**Status:** realized (SESSION-02 c3 `ae1c762`), exactly as planned. **Imports:** nothing (pure data + one DOM write).

## Public API (realized)
- `moods/map.ts`:
  - `type MoodId = 'fantasy' | 'urban' | 'archive'`
  - `moodForTheme(themeId: string | null | undefined): MoodId` — `dark-fantasy→fantasy`, `zombie-urban→urban`, anything else/null/undefined → `archive` (CA-10). Uses `Object.hasOwn` so `toString`/`__proto__` fall to `archive` (tested).
  - `applyMood(mood: MoodId, doc = document): void` — sets `document.documentElement.dataset.mood`; the ≤300 ms crossfade (instant under reduced motion) is CSS, not JS.

## Change history
- v1-shell plan: created (planned).
- SESSION-02 c3 (`ae1c762`): realized as planned (`moods/map.ts` + 9 unit tests in `tests/moods/map.test.ts`).

<!-- loot-inventory SESSION-03 -->
### loot-inventory SESSION-03 delta — fourth mood `wild`
- **M05 moods** (`src/renderer/src/moods/map.ts`): `MoodId = 'fantasy' | 'urban' | 'wild' | 'archive'`. `MOOD_BY_THEME` adds `wyldwood → wild`. CA-10 mapping now: `dark-fantasy → fantasy`, `zombie-urban → urban`, `wyldwood → wild`, else / null / `__proto__` → `archive`.
