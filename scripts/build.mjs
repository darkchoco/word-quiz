// Bundles the server and the import CLI into single .mjs files (no node_modules needed at runtime).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

// Some bundled dependencies are CommonJS and call require(); ESM output needs this shim.
const banner =
  "import { createRequire as __wqCreateRequire } from 'node:module'; " +
  'const require = __wqCreateRequire(import.meta.url);';

fs.rmSync(dist, { recursive: true, force: true });

const entries = [
  ['src/server/index.ts', 'server.mjs'],
  ['src/cli/index.ts', 'import.mjs'],
];

for (const [entry, out] of entries) {
  await build({
    entryPoints: [path.join(root, entry)],
    outfile: path.join(dist, out),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    banner: { js: banner },
    logLevel: 'warning',
  });
  const kb = (fs.statSync(path.join(dist, out)).size / 1024).toFixed(0);
  console.log(`dist/${out}  ${kb} KB`);
}
