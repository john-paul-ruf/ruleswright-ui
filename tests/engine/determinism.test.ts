import { generateCampaign, listThemeKnobs, loadTheme } from 'ruleswright/compiler';
import { describe, expect, it } from 'vitest';
import { rerunSameSeed } from '../../src/renderer/src/engine/determinism';
import { importPackText } from '../../src/renderer/src/engine/schema';

const theme = loadTheme('dark-fantasy');
const knobs = Object.fromEntries(listThemeKnobs(theme).map((k) => [k.id, k.default])) as Record<string, string | number>;
const meta = { theme: 'dark-fantasy', seed: 42, knobs };
const pack = generateCampaign({ theme, seed: 42, knobs });
const packJson = JSON.stringify(pack);

describe('rerunSameSeed (CA-12, real library)', () => {
  it('passes a forged seed-42 dark-fantasy pack byte-for-byte', () => {
    const r = rerunSameSeed(meta, packJson);
    expect(r).toMatchObject({ status: 'pass', bytes: Buffer.byteLength(packJson, 'utf8') });
    expect(r.status === 'pass' && r.bytes).toBe(packJson.length);
  });

  it('passes a forged seed-42 wyldwood pack byte-for-byte (CAP-01)', () => {
    const wyld = loadTheme('wyldwood');
    const wyldKnobs = Object.fromEntries(listThemeKnobs(wyld).map((k) => [k.id, k.default])) as Record<string, string | number>;
    const wyldJson = JSON.stringify(generateCampaign({ theme: wyld, seed: 42, knobs: wyldKnobs }));
    const r = rerunSameSeed({ theme: 'wyldwood', seed: 42, knobs: wyldKnobs }, wyldJson);
    expect(r).toMatchObject({ status: 'pass', bytes: Buffer.byteLength(wyldJson, 'utf8') });
  });

  it('fails a stored string with one digit changed, pointing at that offset', () => {
    const index = packJson.indexOf('"seed":42') + '"seed":'.length;
    const tampered = `${packJson.slice(0, index)}5${packJson.slice(index + 1)}`;
    expect(tampered.length).toBe(packJson.length);
    const r = rerunSameSeed(meta, tampered);
    expect(r).toEqual({
      status: 'fail',
      offset: index,
      storedLength: tampered.length,
      rerunLength: packJson.length,
      storedExcerpt: tampered.slice(index - 40, index + 40),
      rerunExcerpt: packJson.slice(index - 40, index + 40),
    });
  });

  it('fails a structurally equal but differently serialized pack (bytes, not structure)', () => {
    const pretty = JSON.stringify(pack, null, 2);
    expect(JSON.parse(pretty)).toEqual(pack);
    expect(rerunSameSeed(meta, pretty).status).toBe('fail');
  });

  it('is unavailable when the generation params are null, never faked', () => {
    expect(rerunSameSeed({ theme: null, seed: null, knobs: null }, packJson)).toEqual({
      status: 'unavailable',
      reason: 'generation parameters unknown (imported pack)',
    });
  });

  it('is unavailable for a theme this engine build does not provide', () => {
    expect(rerunSameSeed({ ...meta, theme: 'no-such-theme' }, packJson)).toEqual({
      status: 'unavailable',
      reason: 'theme not provided by this engine build',
    });
  });

  it("surfaces the library's GenerationError verbatim for rejected knobs", () => {
    const r = rerunSameSeed({ ...meta, knobs: { nope: 1 } }, packJson);
    expect(r.status).toBe('error');
    if (r.status !== 'error') return;
    expect(r.error).toMatchObject({ kind: 'library', operation: 'rerun', name: 'GenerationError' });
    expect(r.error.kind === 'library' && r.error.cards[0]?.rule).toBe('E-SCHEMA-01');
  });

  it('passes an imported pretty-printed pack after canonicalization (D-05)', () => {
    const imported = importPackText(JSON.stringify(pack, null, 2));
    if (!imported.ok) throw new Error('import rejected a valid pack');
    expect(imported.params).not.toBeNull();
    const params = imported.params as NonNullable<typeof imported.params>;
    expect(rerunSameSeed(params, imported.packJson).status).toBe('pass');
  });
});
