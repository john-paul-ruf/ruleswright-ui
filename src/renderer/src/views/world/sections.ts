/** Which pack sections the World surface lays out bespoke, and which fall back to raw JSON (FR-4). */
import type { Pack } from '../../engine/schema';

export type BespokeKind = 'classes' | 'spells' | 'bestiary' | 'tables';

export interface WorldSection {
  /** Subnav id: the pack key (`world-nav-<id>`). */
  id: string;
  /** Pack path shown on raw views, e.g. `content.races`. */
  path: string;
  data: unknown;
  /** `Object.keys(...).length` for objects/arrays; null for scalars. */
  count: number | null;
  bespoke: BespokeKind | null;
}

const BESPOKE_CONTENT: readonly BespokeKind[] = ['classes', 'spells'];
const BESPOKE_TOP: readonly BespokeKind[] = ['bestiary', 'tables'];
/** Top-level keys shown elsewhere: content is split per subsection, progression is part of the classes view. */
const NOT_RAW_TOP = new Set<string>(['content', 'progression', ...BESPOKE_TOP]);

function countOf(data: unknown): number | null {
  return typeof data === 'object' && data !== null ? Object.keys(data).length : null;
}

function section(id: string, path: string, data: unknown, bespoke: BespokeKind | null): WorldSection {
  return { id, path, data, count: countOf(data), bespoke };
}

/** Bespoke sections first (mock order), then every other content subsection and top-level section, in pack order. */
export function sectionsOf(pack: Pack): WorldSection[] {
  const content = pack.content as Record<string, unknown>;
  const top = pack as unknown as Record<string, unknown>;
  return [
    ...BESPOKE_CONTENT.map((id) => section(id, `content.${id}`, content[id] ?? {}, id)),
    ...BESPOKE_TOP.map((id) => section(id, id, top[id] ?? {}, id)),
    ...Object.keys(content)
      .filter((id) => !BESPOKE_CONTENT.includes(id as BespokeKind))
      .map((id) => section(id, `content.${id}`, content[id], null)),
    ...Object.keys(top)
      .filter((id) => !NOT_RAW_TOP.has(id))
      .map((id) => section(id, id, top[id], null)),
  ];
}
