// Zips the program folder (`dist/`, see build.mjs) into release/WordQuiz.zip. The zip holds only the
// program files; data\ and reports\ are created by the program on first use (TECH-SPEC 8.1).
//   node scripts/package.mjs [--from <dir>] [--out <file>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { zipSync } from 'fflate';
import { collectRelease, entryData, ReleaseError } from './lib/release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let values;
try {
  ({ values } = parseArgs({ options: { from: { type: 'string' }, out: { type: 'string' } }, allowPositionals: false }));
} catch (error) {
  console.error(`${error.message}\nUsage: node scripts/package.mjs [--from <dir>] [--out <file>]`);
  process.exit(2);
}
const from = path.resolve(values.from ?? path.join(root, 'dist'));
const out = path.resolve(values.out ?? path.join(root, 'release', 'WordQuiz.zip'));

let entries;
try {
  entries = collectRelease(from);
} catch (error) {
  if (!(error instanceof ReleaseError)) throw error;
  console.error(error.message);
  process.exit(2);
}

// Entries sit at the top of the zip and use `/`, as the zip format wants.
const files = {};
for (const entry of entries) files[entry.name] = [new Uint8Array(entryData(entry)), { level: 9 }];
const zip = zipSync(files);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, zip);
const shown = path.relative(root, out).startsWith('..') ? out : path.relative(root, out);
console.log(`${shown}  ${(zip.length / 1024 / 1024).toFixed(2)} MB, ${entries.length} files`);
