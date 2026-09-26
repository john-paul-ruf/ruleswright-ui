/**
 * Structural copies of the shapes ui renders, so ui never imports engine or moods (M08).
 * `AppErrorLike` mirrors `engine/errors.ts` `AppError` (CA-05); an `AppError` is assignable to it.
 */

export interface ErrorCardLike {
  readonly rule: string;
  readonly jsonPath: string;
  readonly message: string;
  readonly hint?: string;
}

export type AppErrorLike =
  | {
      readonly kind: 'library';
      readonly operation: string;
      readonly name: string;
      readonly message: string;
      readonly cards: readonly ErrorCardLike[];
    }
  | { readonly kind: 'host'; readonly operation: string; readonly code: string; readonly message: string }
  | { readonly kind: 'unexpected'; readonly operation: string; readonly message: string };

/** A mood id, for previewing another mood's tokens inside a subtree (FR-15). */
export type MoodLike = 'fantasy' | 'urban' | 'archive';
