import { GenerationError } from 'ruleswright/compiler';
import { CharacterBuildError, PackLoadError, RuntimeRuleError } from 'ruleswright/runtime';
import type { ErrorCard } from 'ruleswright/schema';
import { describe, expect, it } from 'vitest';
import { fromIpcError, toAppError } from '../../src/renderer/src/engine/errors';

const cards: ErrorCard[] = [
  { severity: 'error', artifactId: 'x', jsonPath: 'a.b', rule: 'E-TEST-01', message: 'verbatim message', hint: 'h' },
];

describe('toAppError (CA-05)', () => {
  for (const Cls of [GenerationError, PackLoadError, CharacterBuildError, RuntimeRuleError]) {
    it(`maps ${Cls.name} to library with its cards verbatim`, () => {
      const e = new Cls(cards);
      expect(toAppError('op', e)).toEqual({ kind: 'library', operation: 'op', name: e.name, message: e.message, cards });
    });
  }

  it('maps an IpcError to host', () => {
    const ipc = { code: 'not-found' as const, message: 'gone', operation: 'world:open' };
    expect(toAppError('open', ipc)).toEqual({ kind: 'host', operation: 'world:open', code: 'not-found', message: 'gone' });
    expect(fromIpcError(ipc)).toEqual({ kind: 'host', operation: 'world:open', code: 'not-found', message: 'gone' });
  });

  it('maps anything else to unexpected', () => {
    expect(toAppError('op', new Error('x'))).toEqual({ kind: 'unexpected', operation: 'op', message: 'x' });
    expect(toAppError('op', 'str')).toEqual({ kind: 'unexpected', operation: 'op', message: 'str' });
    expect(toAppError('op', { code: 'bogus', message: 'm', operation: 'o' })).toMatchObject({ kind: 'unexpected' });
  });
});
