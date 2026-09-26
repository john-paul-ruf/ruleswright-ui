/** The pack gate (CA-02), import normalization (CA-03, D-03, D-05) and pack identity. */
import { Runtime } from 'ruleswright/runtime';
import { packContentHash, type Pack } from 'ruleswright/schema';
import type { PackIdentity } from '../../../shared/model';
import { listThemes } from './compiler';
import { toAppError, type AppError } from './errors';

export type {
  Pack,
  ClassDef,
  SpellDef,
  Statblock,
  TableDef,
  ConditionDef,
  RaceDef,
  ActionDef,
  FormulaDef,
  ErrorCard,
} from 'ruleswright/schema';
export type { Runtime } from 'ruleswright/runtime';

export type PackGate = { ok: true; pack: Pack; runtime: Runtime } | { ok: false; error: AppError };

/**
 * FR-3: accept a pack only if the library's full load validator (`new Runtime`) does.
 * Bare `validatePack` is not a gate — without the runtime's DSL checker it reports
 * deferred E-FORM-01 cards on valid packs (Custom Rule 4).
 */
export function openPack(packJson: string, operation = 'world:open'): PackGate {
  try {
    const runtime = new Runtime(JSON.parse(packJson));
    return { ok: true, pack: runtime.pack, runtime };
  } catch (e) {
    return { ok: false, error: toAppError(operation, e) };
  }
}

export interface GenerationParams {
  theme: string;
  seed: number;
  knobs: Record<string, string | number>;
}

export type ImportResult =
  | { ok: true; pack: Pack; packJson: string; runtime: Runtime; params: GenerationParams | null; suggestedName: string }
  | { ok: false; error: AppError };

function isKnobMap(v: unknown): v is Record<string, string | number> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.values(v).every((x) => typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x)))
  );
}

/** D-03: provenance is trusted only for a known theme and an integer seed; otherwise all params are null. */
function paramsOf(pack: Pack): GenerationParams | null {
  const p = pack.manifest.provenance;
  if (!p || !listThemes().some((t) => t.id === p.theme) || !Number.isInteger(p.seed)) return null;
  const knobs = p.knobs ?? {};
  if (!isKnobMap(knobs)) return null;
  return { theme: p.theme, seed: p.seed as number, knobs };
}

/**
 * FR-5: validate pasted/opened pack text. Stored bytes are canonical
 * `JSON.stringify(parsed)` (D-05) so a pretty-printed import can still rerun byte-identical.
 */
export function importPackText(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: toAppError('import', e) };
  }
  const packJson = JSON.stringify(parsed);
  const gate = openPack(packJson, 'import');
  if (!gate.ok) return gate;
  const params = paramsOf(gate.pack);
  const suggestedName = params ? `${params.theme} · ${params.seed}` : (gate.pack.manifest.title ?? 'imported pack');
  return { ok: true, pack: gate.pack, packJson, runtime: gate.runtime, params, suggestedName };
}

/** FR-10: the pack identity block a character snapshot carries (`serializeCharacter().pack`). */
export function packIdentityOf(pack: Pack): PackIdentity {
  return { id: pack.manifest.id, schemaVersion: pack.manifest.schemaVersion, contentHash: packContentHash(pack) };
}
