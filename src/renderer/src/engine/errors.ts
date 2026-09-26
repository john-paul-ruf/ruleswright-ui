/**
 * Error shaping (CA-05, FR-16): every failure becomes an `AppError`, and library
 * cards are carried verbatim — never paraphrased.
 */
import type { ErrorCard } from 'ruleswright/schema';
import { GenerationError } from 'ruleswright/compiler';
import { CharacterBuildError, PackLoadError, RuntimeRuleError } from 'ruleswright/runtime';
import type { IpcError, IpcErrorCode } from '../../../shared/ipc-contract';

export type { ErrorCard };

export type AppError =
  | { kind: 'library'; operation: string; name: string; message: string; cards: readonly ErrorCard[] }
  | { kind: 'host'; operation: string; code: IpcError['code']; message: string }
  | { kind: 'unexpected'; operation: string; message: string };

const LIBRARY_ERRORS = [GenerationError, PackLoadError, CharacterBuildError, RuntimeRuleError];
const IPC_CODES: readonly IpcErrorCode[] = ['invalid-input', 'not-found', 'name-collision', 'io', 'too-large'];

function isIpcError(e: unknown): e is IpcError {
  if (typeof e !== 'object' || e === null) return false;
  const r = e as Record<string, unknown>;
  return (
    IPC_CODES.includes(r.code as IpcErrorCode) && typeof r.message === 'string' && typeof r.operation === 'string'
  );
}

/** FR-16: shapes any thrown value from `operation` into an `AppError`. */
export function toAppError(operation: string, e: unknown): AppError {
  if (LIBRARY_ERRORS.some((cls) => e instanceof cls)) {
    const err = e as Error & { errors: readonly ErrorCard[] };
    return { kind: 'library', operation, name: err.name, message: err.message, cards: err.errors };
  }
  if (isIpcError(e)) return fromIpcError(e);
  return { kind: 'unexpected', operation, message: e instanceof Error ? e.message : String(e) };
}

/** FR-16: a host (main-process) failure, carried with its code. */
export function fromIpcError(e: IpcError): AppError {
  return { kind: 'host', operation: e.operation, code: e.code, message: e.message };
}
