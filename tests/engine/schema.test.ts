import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import { Runtime, createCharacter, serializeCharacter } from 'ruleswright/runtime';
import { validatePack } from 'ruleswright/schema';
import { describe, expect, it } from 'vitest';
import { importPackText, openPack, packIdentityOf } from '../../src/renderer/src/engine/schema';

const pack = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 42 });
const packJson = JSON.stringify(pack);

describe('openPack — the gate is new Runtime (CA-02)', () => {
  it('accepts a valid forged pack', () => {
    const r = openPack(packJson);
    expect(r.ok).toBe(true);
  });

  it('rejects {schemaVersion:1} with PackLoadError cards including E-SCHEMA-01', () => {
    const r = openPack('{"schemaVersion":1}');
    if (r.ok) throw new Error('expected rejection');
    expect(r.error).toMatchObject({ kind: 'library', name: 'PackLoadError', operation: 'world:open' });
    if (r.error.kind !== 'library') throw new Error('not library');
    expect(r.error.cards.map((c) => c.rule)).toContain('E-SCHEMA-01');
  });

  it('documents why bare validatePack is not the gate: it reports cards on a valid pack', () => {
    expect(validatePack(JSON.parse(packJson)).length).toBeGreaterThan(0);
    expect(openPack(packJson).ok).toBe(true);
  });
});

describe('importPackText (CA-03, D-03, D-05)', () => {
  it('stores canonical bytes and trusts provenance for a known theme + integer seed', () => {
    const r = importPackText(JSON.stringify(pack, null, 2));
    if (!r.ok) throw new Error('import failed');
    expect(r.packJson).toBe(packJson);
    expect(r.params).toEqual({
      theme: 'dark-fantasy',
      seed: 42,
      knobs: { threat: 'medium', 'spell-density': 3, grittiness: 'heroic', 'demihuman-caps': 'on' },
    });
    expect(r.suggestedName).toBe('dark-fantasy · 42');
  });

  it('nulls every param when provenance is absent, and names from the manifest title', () => {
    const { provenance: _p, ...manifest } = pack.manifest;
    const r = importPackText(JSON.stringify({ ...pack, manifest }));
    if (!r.ok) throw new Error('import failed');
    expect(r.params).toBeNull();
    expect(r.suggestedName).toBe(pack.manifest.title);
  });

  it('nulls every param for an unknown theme or a non-integer seed', () => {
    for (const provenance of [
      { ...pack.manifest.provenance, theme: 'other-theme' },
      { ...pack.manifest.provenance, seed: 'forty-two' },
    ]) {
      const r = importPackText(JSON.stringify({ ...pack, manifest: { ...pack.manifest, provenance } }));
      if (!r.ok) throw new Error('import failed');
      expect(r.params).toBeNull();
    }
  });

  it('shapes unparseable text as unexpected', () => {
    expect(importPackText('{')).toMatchObject({ ok: false, error: { kind: 'unexpected', operation: 'import' } });
  });

  it('shapes an invalid pack as library cards under the import operation', () => {
    expect(importPackText('{"schemaVersion":1}')).toMatchObject({
      ok: false,
      error: { kind: 'library', name: 'PackLoadError', operation: 'import' },
    });
  });
});

function envelopePackOf(p: typeof pack) {
  const rt = new Runtime(p);
  const c = createCharacter(rt, { name: 'Brynn', race: 'hillfolk', classes: [{ id: 'warden', level: 1 }] });
  return serializeCharacter(rt, c.state).pack;
}

describe('packIdentityOf', () => {
  it('matches the snapshot envelope pack block the library writes for dark-fantasy · 42', () => {
    expect(packIdentityOf(pack)).toEqual(envelopePackOf(pack));
    expect(packIdentityOf(pack)).toMatchObject({ id: pack.manifest.id, schemaVersion: 1 });
    expect(packIdentityOf(pack).contentHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('does not match another pack’s envelope (negative control: dark-fantasy · 43)', () => {
    const other = generateCampaign({ theme: loadTheme('dark-fantasy'), seed: 43 });
    expect(packIdentityOf(pack)).not.toEqual(envelopePackOf(other));
  });
});
