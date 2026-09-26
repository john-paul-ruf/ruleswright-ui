import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

/** Rebuilds `out/` from the working tree and records which tree the e2e run exercised. */
export default function globalSetup(): void {
  execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: 'inherit' });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  const porcelain = git('status', '--porcelain');
  const identity = {
    head: git('rev-parse', 'HEAD').trim(),
    dirty: porcelain !== '',
    porcelainSha256: createHash('sha256').update(porcelain).digest('hex'),
    builtAt: new Date().toISOString(),
  };
  mkdirSync(join(ROOT, 'test-results'), { recursive: true });
  writeFileSync(join(ROOT, 'test-results', 'build-identity.json'), `${JSON.stringify(identity, null, 2)}\n`);
}
