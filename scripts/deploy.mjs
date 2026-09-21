// Copies the program folder (`dist/`, see build.mjs) to the install folder.
//   node scripts/deploy.mjs [--dir <folder>] [--from <folder>] [--force]
// The folder is --dir, else the environment variable DEPLOY_DIR, else /mnt/c/WordQuiz (C:\WordQuiz seen from WSL).
//
// Only the program files are replaced: start.bat, import.bat, server.mjs, import.mjs and public\.
// data\ (the databases and their backups), reports\ and server.lock are never touched.
// A server.lock means that a server runs from that folder, whose old code in memory would no longer
// fit the new public\ (TECH-SPEC 8.5, T16); then nothing is done unless --force is given.
//
// Exit codes: 0 done, 1 stopped by server.lock, 2 wrong usage, incomplete build or unsafe folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { collectRelease, entryData, isInside, PROGRAM_FILES, readLock, ReleaseError } from './lib/release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'Usage: node scripts/deploy.mjs [--dir <folder>] [--from <folder>] [--force]';

let values;
try {
  ({ values } = parseArgs({
    options: { dir: { type: 'string' }, from: { type: 'string' }, force: { type: 'boolean', default: false } },
    allowPositionals: false,
  }));
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}

const from = path.resolve(values.from ?? path.join(root, 'dist'));
const target = path.resolve(values.dir ?? (process.env['DEPLOY_DIR'] || '/mnt/c/WordQuiz'));

let entries;
try {
  entries = collectRelease(from);
  // public\ of the target is deleted below; that must never be (part of) the source.
  if (isInside(target, from) || isInside(from, target)) {
    throw new ReleaseError(`Refusing to deploy: ${target} and the build folder ${from} contain each other.`);
  }
} catch (error) {
  if (!(error instanceof ReleaseError)) throw error;
  console.error(error.message);
  process.exit(2);
}

const lock = readLock(target);
if (lock !== null) {
  const facts = [
    lock.pid !== undefined && `pid ${lock.pid}`,
    lock.port !== undefined && `port ${lock.port}`,
    typeof lock.startedAt === 'number' && `started ${new Date(lock.startedAt).toISOString()}`,
  ].filter(Boolean);
  const detail = facts.length > 0 ? ` (${facts.join(', ')})` : '';
  if (!values.force) {
    console.error(
      `A server seems to be running from ${target}: server.lock exists${detail}.\n` +
        'Close it first (close its console window or press Ctrl+C there), then deploy again.\n' +
        'If the server was closed abnormally and the lock is left over, run again with --force.',
    );
    process.exit(1);
  }
  console.warn(`server.lock exists${detail}; continuing because of --force.`);
}

// The web app is replaced as a whole so that files with old hashed names do not stay behind.
fs.rmSync(path.join(target, 'public'), { recursive: true, force: true });
for (const entry of entries) {
  const file = path.join(target, ...entry.name.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, entryData(entry));
}
console.log(`Deployed ${entries.length} files (${PROGRAM_FILES.join(', ')} and public/) to ${target}`);
console.log('data/, reports/ and server.lock were left as they are.');
