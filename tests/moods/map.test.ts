/** CA-10: mood follows the world's theme; anything else is archive. */
import { describe, expect, it } from 'vitest';
import { applyMood, moodForTheme } from '../../src/renderer/src/moods/map';

describe('moodForTheme (CA-10)', () => {
  it.each([
    ['dark-fantasy', 'fantasy'],
    ['zombie-urban', 'urban'],
    ['wyldwood', 'wild'],
    [null, 'archive'],
    [undefined, 'archive'],
    ['unknown', 'archive'],
    ['', 'archive'],
    ['toString', 'archive'],
    ['__proto__', 'archive'],
  ] as const)('%s → %s', (theme, mood) => {
    expect(moodForTheme(theme)).toBe(mood);
  });
});

describe('applyMood', () => {
  it('sets data-mood on the document root', () => {
    const doc = { documentElement: { dataset: {} as DOMStringMap } };
    applyMood('urban', doc);
    expect(doc.documentElement.dataset.mood).toBe('urban');
    applyMood('archive', doc);
    expect(doc.documentElement.dataset.mood).toBe('archive');
  });
});
