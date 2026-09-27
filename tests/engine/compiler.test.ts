import * as compiler from 'ruleswright/compiler';
import type { ThemeTemplate } from 'ruleswright/compiler';
import { describe, expect, it } from 'vitest';
import { forge, listThemes } from '../../src/renderer/src/engine/compiler';

/** CA-11 oracle, derived from the library's exports so a new engine theme does not break this gate. */
function isTemplate(v: unknown): v is ThemeTemplate {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.stats !== 'object' || t.stats === null) return false;
  try {
    return compiler.loadTheme(t.id) === v;
  } catch {
    return false;
  }
}

describe('listThemes (CA-11, D-04)', () => {
  it('discovers the library themes from its exports, sorted by id', () => {
    const themes = listThemes();
    const ids = themes.map((t) => t.id);
    const expected = Object.values(compiler).filter(isTemplate).map((t) => t.id).sort();
    expect(ids).toEqual(expected);
    expect(ids).toEqual(expect.arrayContaining(['dark-fantasy', 'wyldwood', 'zombie-urban']));
    expect(themes.every((t) => t.title.length > 0)).toBe(true);
  });

  it('carries knob declarations from listThemeKnobs', () => {
    const dark = listThemes().find((t) => t.id === 'dark-fantasy');
    expect(dark?.knobs.map((k) => k.id)).toEqual(['threat', 'spell-density', 'grittiness', 'demihuman-caps']);
    expect(dark?.knobs.find((k) => k.id === 'spell-density')).toMatchObject({ type: 'range', min: 1, max: 5 });
  });
});

describe('forge (FR-2, CA-01, CA-02)', () => {
  it('generates a gated pack with byte-identical canonical JSON across calls', () => {
    const a = forge('dark-fantasy', 42, {});
    const b = forge('dark-fantasy', 42, {});
    if (!a.ok || !b.ok) throw new Error('forge failed');
    expect(a.packJson).toBe(b.packJson);
    expect(a.packJson).toBe(JSON.stringify(a.pack));
    expect(a.pack.manifest.provenance?.seed).toBe(42);
    expect(a.runtime.pack.manifest.id).toBe(a.pack.manifest.id);
    expect(a.ms).toBeGreaterThanOrEqual(0);
  });

  it('forges the library-discovered wyldwood theme through the Runtime gate (CAP-01)', () => {
    const r = forge('wyldwood', 42, {});
    if (!r.ok) throw new Error(`forge failed: ${JSON.stringify(r.error)}`);
    expect(r.packJson).toBe(JSON.stringify(r.pack));
    expect(r.pack.manifest.provenance?.seed).toBe(42);
    expect(r.runtime.pack.manifest.id).toBe(r.pack.manifest.id);
  });

  it('shapes a knob rejection into library cards verbatim', () => {
    const r = forge('dark-fantasy', 42, { nope: 1 });
    if (r.ok) throw new Error('expected rejection');
    expect(r.error).toMatchObject({ kind: 'library', operation: 'forge', name: 'GenerationError' });
    if (r.error.kind !== 'library') throw new Error('not library');
    expect(r.error.cards).toContainEqual(expect.objectContaining({ rule: 'E-SCHEMA-01', jsonPath: 'knobs.nope' }));
  });

  it('shapes an unknown theme as unexpected', () => {
    const r = forge('no-such-theme', 1, {});
    expect(r).toMatchObject({ ok: false, error: { kind: 'unexpected', operation: 'forge' } });
  });
});
