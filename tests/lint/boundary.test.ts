import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });

async function errorsFor(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.ruleId ?? 'fatal');
}

describe('lint gate: Custom Rules 1 & 3', () => {
  it('rejects a runtime ruleswright import outside engine/', async () => {
    const errors = await errorsFor(
      "import { Runtime } from 'ruleswright/runtime';\nexport const r = Runtime;\n",
      'src/renderer/src/store/x.ts',
    );
    expect(errors).toEqual(['no-restricted-imports']);
  });

  it('rejects a type-only ruleswright import in a view', async () => {
    const errors = await errorsFor(
      "import type { Pack } from 'ruleswright/schema';\nexport type P = Pack;\n",
      'src/renderer/src/views/x.tsx',
    );
    expect(errors).toEqual(['no-restricted-imports']);
  });

  it('allows the same import inside engine/', async () => {
    const errors = await errorsFor(
      "import type { Pack } from 'ruleswright/schema';\nexport type P = Pack;\n",
      'src/renderer/src/engine/x.ts',
    );
    expect(errors).toEqual([]);
  });

  it('rejects Math.random in a view', async () => {
    const errors = await errorsFor('export const n = Math.random();\n', 'src/renderer/src/views/x.tsx');
    expect(errors).toEqual(['no-restricted-properties']);
  });

  it('rejects Date.now inside engine/', async () => {
    const errors = await errorsFor('export const t = Date.now();\n', 'src/renderer/src/engine/x.ts');
    expect(errors).toEqual(['no-restricted-properties']);
  });

  it('rejects eval and new Function everywhere', async () => {
    const errors = await errorsFor(
      "export const a = eval('1');\nexport const f = new Function('return 1');\n",
      'src/renderer/src/store/x.ts',
    );
    expect(errors).toEqual(['no-restricted-syntax', 'no-restricted-syntax']);
  });
});
