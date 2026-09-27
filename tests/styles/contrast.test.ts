/**
 * Token gate (M04, FR-15, Custom Rule 6): every mood defines design.md's color tokens verbatim,
 * the AA pairs hold in every mood, and no ui/shell component hardcodes a hex color.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const TOKENS = readFileSync(join(ROOT, 'src/renderer/src/styles/tokens.css'), 'utf8');
const DESIGN = readFileSync(join(ROOT, 'program/ruleswright-ui/specs/design.md'), 'utf8');
const MOODS = ['fantasy', 'urban', 'archive', 'wild'] as const;
type Mood = (typeof MOODS)[number];

/** design.md "Mood values" table: token → value per mood, backticks stripped. */
function designTable(): Record<Mood, Record<string, string>> {
  const out: Record<Mood, Record<string, string>> = { fantasy: {}, urban: {}, archive: {}, wild: {} };
  const section = DESIGN.slice(DESIGN.indexOf('**Mood values:**'));
  for (const line of section.split('\n').slice(1)) {
    const cells = line.split('|').map((c) => c.trim().replace(/`/g, ''));
    const [, token, fantasy, urban, archive, wild] = cells;
    if (token === undefined || !/^--[a-z]/.test(token)) {
      if (Object.keys(out.fantasy).length > 0) break;
      continue;
    }
    out.fantasy[token] = fantasy ?? '';
    out.urban[token] = urban ?? '';
    out.archive[token] = archive ?? '';
    out.wild[token] = wild ?? '';
  }
  return out;
}

/** Declarations of the `[data-mood='<mood>']` block in tokens.css. */
function moodTokens(css: string, mood: Mood): Record<string, string> {
  const block = [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)].find(([, selector]) =>
    (selector ?? '').includes(`[data-mood='${mood}']`),
  );
  if (!block) throw new Error(`no [data-mood='${mood}'] block`);
  const decls: Record<string, string> = {};
  for (const [, name, value] of (block[2] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    decls[name as string] = (value as string).trim();
  }
  return decls;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a 6-digit hex color: ${hex}`);
  const n = parseInt(m[1] as string, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [string, string][] = [
  ['--dim', '--surface'],
  ['--dim', '--surface2'],
  ['--accent-ink', '--accent'],
  ['--ink', '--base'],
  ['--ink', '--surface'],
  ['--ink', '--surface2'],
  ['--danger', '--surface'],
  ['--ok', '--surface'],
  ['--accent', '--surface'],
];

const HEX = /#[0-9a-fA-F]{3,8}\b/;

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(css|tsx)$/.test(name) ? [path] : [];
  });
}

describe('design tokens', () => {
  const table = designTable();

  it('reads all 12 color tokens per mood from design.md', () => {
    for (const mood of MOODS) expect(Object.keys(table[mood]), mood).toHaveLength(12);
    for (const mood of MOODS) expect(Object.values(table[mood]).every((v) => v !== ''), mood).toBe(true);
  });

  for (const mood of MOODS) {
    describe(mood, () => {
      const tokens = moodTokens(TOKENS, mood);

      it('defines every design.md token with its exact value', () => {
        for (const [token, value] of Object.entries(table[mood])) expect(tokens[token], token).toBe(value);
      });

      for (const [fg, bg] of PAIRS) {
        it(`${fg} on ${bg} meets WCAG AA (4.5:1)`, () => {
          expect(contrast(tokens[fg] as string, tokens[bg] as string)).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }

  it('computes known reference ratios (negative control)', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
    expect(contrast(moodTokens(TOKENS, 'urban')['--danger'] as string, moodTokens(TOKENS, 'urban')['--surface'] as string)).toBeCloseTo(4.78, 2);
  });
});

describe('Custom Rule 6: no hex literals in components', () => {
  it('detects a hex literal (negative control)', () => {
    expect(HEX.test('color: #d8a94e;')).toBe(true);
    expect(HEX.test('color: var(--accent);')).toBe(false);
  });

  it('ui/ and shell/ carry no hex color literal', () => {
    const files = ['ui', 'shell'].flatMap((d) => sourceFiles(join(ROOT, 'src/renderer/src', d)));
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => HEX.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
