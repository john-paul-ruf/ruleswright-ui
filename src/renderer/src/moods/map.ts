/** FR-15 mood mechanism (M05, CA-10): theme id → mood id → `data-mood` on the document root. */

export type MoodId = 'fantasy' | 'urban' | 'archive';

const MOOD_BY_THEME: Readonly<Record<string, MoodId>> = {
  'dark-fantasy': 'fantasy',
  'zombie-urban': 'urban',
};

/** FR-15 / CA-10: bundled themes map to their mood; unknown or null (imported, unknown params) → archive. */
export function moodForTheme(themeId: string | null | undefined): MoodId {
  if (themeId == null || !Object.hasOwn(MOOD_BY_THEME, themeId)) return 'archive';
  return MOOD_BY_THEME[themeId] ?? 'archive';
}

/** FR-15: switch the mood; the ≤300 ms crossfade (instant under reduced motion) is CSS. */
export function applyMood(mood: MoodId, doc: { documentElement: { dataset: DOMStringMap } } = document): void {
  doc.documentElement.dataset.mood = mood;
}
