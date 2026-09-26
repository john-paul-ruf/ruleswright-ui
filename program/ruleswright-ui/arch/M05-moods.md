# M05 — moods (`src/renderer/src/moods/`)

**Status:** planned (SESSION-02). **Imports:** nothing.

## Public API
- `type MoodId = 'fantasy' | 'urban' | 'archive'`
- `moodForTheme(themeId: string | null | undefined): MoodId` — `dark-fantasy→fantasy`, `zombie-urban→urban`, anything else/null → `archive` (CA-10).
- `applyMood(mood: MoodId, doc = document): void` — sets `document.documentElement.dataset.mood`; crossfade is CSS (≤300 ms; instant under reduced motion).

## Change history
- v1-shell plan: created (planned).
