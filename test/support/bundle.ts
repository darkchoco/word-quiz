import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The same shim as scripts/build.mjs: bundled CommonJS packages call require().
const banner =
  "import { createRequire as __wqCreateRequire } from 'node:module'; " +
  'const require = __wqCreateRequire(import.meta.url);';

/** Bundles the real server entry point into a temporary file, like the release build does. */
export async function bundleServer(): Promise<{ file: string; cleanup(): void }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wq-bundle-'));
  const file = path.join(dir, 'server.mjs');
  await build({
    entryPoints: [path.join(root, 'src/server/index.ts')],
    outfile: file,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    banner: { js: banner },
    logLevel: 'silent',
  });
  return { file, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
