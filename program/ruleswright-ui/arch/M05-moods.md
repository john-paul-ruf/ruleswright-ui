# M05 — moods (`src/renderer/src/moods/`)

**Status:** realized (v1-shell S02 c3 `ae1c762`; `wild` loot-inventory S03 c1 `5b5b84b`). **Imports:** nothing (pure data + one DOM write).

## Public API (realized)
- `moods/map.ts`:
  - `type MoodId = 'fantasy' | 'urban' | 'wild' | 'archive'`
  - `moodForTheme(themeId: string | null | undefined): MoodId` — CA-10 mapping via `MOOD_BY_THEME`: `dark-fantasy → fantasy`, `zombie-urban → urban`, `wyldwood → wild`, anything else / null / undefined → `archive`. Uses `Object.hasOwn`, so `toString`/`__proto__` fall to `archive` (tested).
  - `applyMood(mood: MoodId, doc = document): void` — sets `document.documentElement.dataset.mood`; the ≤300 ms crossfade (instant under reduced motion) is CSS, not JS.
- Consumers of the mood set: M08 `MoodLike` (structural copy), M11 `MOOD_GLYPH` (`✦ fantasy, ▲ urban, ✻ wild, ◆ archive`), M10 shell mood effect.

## Change history
- v1-shell S02 c3 (`ae1c762`): realized (`tests/moods/map.test.ts`).
- loot-inventory S03 c1 (`5b5b84b`): fourth mood `wild`, `wyldwood → wild`.
