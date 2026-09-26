/** Theme discovery + forge (FR-2, CA-11, CA-02). */
import * as compiler from 'ruleswright/compiler';
import type { KnobDecl, ThemeTemplate } from 'ruleswright/compiler';
import { Runtime } from 'ruleswright/runtime';
import type { Pack } from 'ruleswright/schema';
import { toAppError, type AppError } from './errors';

/** A knob declaration joined with its id (the library's `KnobDeclWithId`, which it does not export). */
export type KnobSpec = KnobDecl & { id: string };

export interface ThemeInfo {
  id: string;
  title: string;
  knobs: readonly KnobSpec[];
}

function isThemeShaped(v: unknown): v is ThemeTemplate {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.title === 'string' && typeof t.stats === 'object' && t.stats !== null;
}

function resolvesToItself(theme: ThemeTemplate): boolean {
  try {
    return compiler.loadTheme(theme.id) === theme;
  } catch {
    return false;
  }
}

/**
 * FR-2 / D-04: the library's themes, discovered from its exports — every exported
 * ThemeTemplate-shaped value that `loadTheme(id)` resolves to the same object. No UI-side list.
 */
export function listThemes(): ThemeInfo[] {
  return Object.values(compiler)
    .filter(isThemeShaped)
    .filter(resolvesToItself)
    .map((theme) => ({ id: theme.id, title: theme.title, knobs: compiler.listThemeKnobs(theme).map((k) => ({ ...k })) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export type ForgeResult =
  | { ok: true; pack: Pack; packJson: string; runtime: Runtime; ms: number }
  | { ok: false; error: AppError };

/**
 * FR-2: generate a campaign, serialize it canonically (`JSON.stringify`, CA-01) and
 * gate it through `new Runtime` (CA-02). `ms` is display-only timing.
 */
export function forge(themeId: string, seed: number, knobs: Readonly<Record<string, string | number>>): ForgeResult {
  const started = performance.now();
  try {
    const pack = compiler.generateCampaign({ theme: compiler.loadTheme(themeId), seed, knobs });
    const packJson = JSON.stringify(pack);
    const runtime = new Runtime(JSON.parse(packJson));
    return { ok: true, pack, packJson, runtime, ms: performance.now() - started };
  } catch (e) {
    return { ok: false, error: toAppError('forge', e) };
  }
}
