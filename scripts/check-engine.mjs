// Engine guard (arch/M18): fail loudly unless the installed `ruleswright` copy
// is the sibling engine's current build. pnpm copies `file:` deps, so a rebuilt
// sibling leaves a stale copy here until `pnpm install` runs again.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENTRY_FILES = ['compiler.js', 'runtime.js', 'schema.js'];
const FIX = 'Fix: run `pnpm build` in ../Ruleswright, then `pnpm install` here.';

function parseArgs(argv) {
  const dirs = { sibling: '../Ruleswright', installed: 'node_modules/ruleswright' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (!(key in dirs) || argv[i + 1] === undefined) {
      throw new Error(`unknown or incomplete argument "${argv[i]}" (expected --sibling <dir> --installed <dir>)`);
    }
    dirs[key] = argv[i + 1];
  }
  return { sibling: resolve(dirs.sibling), installed: resolve(dirs.installed) };
}

function readVersion(dir) {
  const file = resolve(dir, 'package.json');
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')).version ?? null;
}

function check({ sibling, installed }) {
  const problems = [];
  for (const f of ENTRY_FILES) {
    if (!existsSync(resolve(sibling, 'dist', f))) problems.push(`missing ${resolve(sibling, 'dist', f)}`);
  }
  const siblingVersion = readVersion(sibling);
  const installedVersion = readVersion(installed);
  if (siblingVersion === null) problems.push(`missing ${resolve(sibling, 'package.json')}`);
  if (installedVersion === null) problems.push(`missing ${resolve(installed, 'package.json')}`);
  if (siblingVersion !== null && installedVersion !== null && siblingVersion !== installedVersion) {
    problems.push(`version mismatch: sibling ${siblingVersion}, installed ${installedVersion}`);
  }
  if (problems.length === 0) {
    for (const f of ENTRY_FILES) {
      const installedFile = resolve(installed, 'dist', f);
      if (!existsSync(installedFile)) {
        problems.push(`missing ${installedFile}`);
      } else if (!readFileSync(resolve(sibling, 'dist', f)).equals(readFileSync(installedFile))) {
        problems.push(`stale copy: dist/${f} differs between sibling and installed engine`);
      }
    }
  }
  return { problems, version: installedVersion };
}

try {
  const { problems, version } = check(parseArgs(process.argv.slice(2)));
  if (problems.length > 0) {
    console.error(`engine check failed:\n  ${problems.join('\n  ')}\n${FIX}`);
    process.exit(1);
  }
  console.log(`engine ok: ruleswright@${version}`);
} catch (e) {
  console.error(`engine check failed: ${e instanceof Error ? e.message : String(e)}\n${FIX}`);
  process.exit(1);
}
