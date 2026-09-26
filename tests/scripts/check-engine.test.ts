import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeTmpDir } from '../support/tmp';

const SCRIPT = resolve(__dirname, '../../scripts/check-engine.mjs');
const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((c) => c()));

function makeEngine(root: string, name: string, version: string, runtimeBytes = 'runtime'): string {
  const dir = join(root, name);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'ruleswright', version }));
  writeFileSync(join(dir, 'dist', 'compiler.js'), 'compiler');
  writeFileSync(join(dir, 'dist', 'runtime.js'), runtimeBytes);
  writeFileSync(join(dir, 'dist', 'schema.js'), 'schema');
  return dir;
}

function run(sibling: string, installed: string): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, [SCRIPT, '--sibling', sibling, '--installed', installed], { encoding: 'utf8' });
  return { status: r.status, out: r.stdout + r.stderr };
}

function tmp(): string {
  const t = makeTmpDir('check-engine-');
  cleanups.push(t.cleanup);
  return t.dir;
}

describe('scripts/check-engine.mjs', () => {
  it('passes when sibling and installed copies are identical', () => {
    const root = tmp();
    const r = run(makeEngine(root, 'sib', '0.1.0'), makeEngine(root, 'inst', '0.1.0'));
    expect(r.status).toBe(0);
    expect(r.out).toContain('engine ok: ruleswright@0.1.0');
  });

  it('fails on a version mismatch', () => {
    const root = tmp();
    const r = run(makeEngine(root, 'sib', '0.2.0'), makeEngine(root, 'inst', '0.1.0'));
    expect(r.status).toBe(1);
    expect(r.out).toContain('version mismatch');
    expect(r.out).toContain('pnpm install');
  });

  it('fails when dist/runtime.js bytes differ', () => {
    const root = tmp();
    const r = run(makeEngine(root, 'sib', '0.1.0', 'runtime-new'), makeEngine(root, 'inst', '0.1.0'));
    expect(r.status).toBe(1);
    expect(r.out).toContain('dist/runtime.js');
  });

  it('fails when the sibling dist is missing', () => {
    const root = tmp();
    const sibling = join(root, 'sib');
    mkdirSync(sibling);
    writeFileSync(join(sibling, 'package.json'), JSON.stringify({ version: '0.1.0' }));
    const r = run(sibling, makeEngine(root, 'inst', '0.1.0'));
    expect(r.status).toBe(1);
    expect(r.out).toContain('missing');
  });
});
