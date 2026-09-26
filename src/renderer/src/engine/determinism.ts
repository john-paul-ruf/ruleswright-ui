/** Rerun same seed (FR-14a, CA-12): regenerate from stored params and compare bytes, nothing less. */
import { generateCampaign, loadTheme } from 'ruleswright/compiler';
import type { WorldMeta } from '../../../shared/model';
import { listThemes } from './compiler';
import { toAppError, type AppError } from './errors';

export type RerunResult =
  | { status: 'pass'; bytes: number; ms: number }
  | {
      status: 'fail';
      offset: number;
      storedLength: number;
      rerunLength: number;
      storedExcerpt: string;
      rerunExcerpt: string;
    }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; error: AppError };

/** Characters shown on each side of the first difference. */
const EXCERPT_RADIUS = 40;

function firstDifference(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) return i;
  return n;
}

/** FR-14a: why a rerun cannot run for these params (null when it can), without generating anything. */
export function rerunUnavailableReason(meta: Pick<WorldMeta, 'theme' | 'seed' | 'knobs'>): string | null {
  if (meta.theme === null || meta.seed === null || meta.knobs === null) return 'generation parameters unknown (imported pack)';
  if (!listThemes().some((t) => t.id === meta.theme)) return 'theme not provided by this engine build';
  return null;
}

/**
 * FR-14a: `generateCampaign` with the world's stored theme/seed/knobs, `JSON.stringify`, then strict
 * string equality with the stored pack bytes (CA-12). Unknown params are `unavailable`, never faked.
 * `ms` is display-only timing.
 */
export function rerunSameSeed(meta: Pick<WorldMeta, 'theme' | 'seed' | 'knobs'>, storedPackJson: string): RerunResult {
  const unavailable = rerunUnavailableReason(meta);
  if (unavailable !== null) return { status: 'unavailable', reason: unavailable };
  const { theme, seed, knobs } = meta as { theme: string; seed: number; knobs: Record<string, string | number> };
  const started = performance.now();
  let rerun: string;
  try {
    rerun = JSON.stringify(generateCampaign({ theme: loadTheme(theme), seed, knobs }));
  } catch (e) {
    return { status: 'error', error: toAppError('rerun', e) };
  }
  const ms = performance.now() - started;
  if (rerun === storedPackJson) {
    return { status: 'pass', bytes: new TextEncoder().encode(storedPackJson).length, ms };
  }
  const offset = firstDifference(storedPackJson, rerun);
  const from = Math.max(0, offset - EXCERPT_RADIUS);
  const to = offset + EXCERPT_RADIUS;
  return {
    status: 'fail',
    offset,
    storedLength: storedPackJson.length,
    rerunLength: rerun.length,
    storedExcerpt: storedPackJson.slice(from, to),
    rerunExcerpt: rerun.slice(from, to),
  };
}
