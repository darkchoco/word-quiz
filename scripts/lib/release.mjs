// Shared by build.mjs, package.mjs and deploy.mjs: what a release consists of, and how its files are written.
import fs from 'node:fs';
import path from 'node:path';

/** The launchers, kept in `release/` and written to `dist/` (TECH-SPEC 8.1, 8.5). */
export const BATCH_FILES = ['start.bat', 'import.bat'];

/** The bundles esbuild makes. */
export const BUNDLE_FILES = ['server.mjs', 'import.mjs'];

/** Every single file of the program folder; the web app is the folder `public/` next to them. */
export const PROGRAM_FILES = [...BATCH_FILES, ...BUNDLE_FILES];

/**
 * Batch files must use CRLF and no byte order mark, or `cmd.exe` may misread them (T14). Files that
 * already do are returned unchanged, so applying this twice is harmless.
 */
export function toCrlf(text) {
  return text.replace(/^﻿/, '').replace(/\r?\n/g, '\r\n');
}

/** Something is wrong with what was asked for (an incomplete build, an unsafe target, ...). */
export class ReleaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReleaseError';
  }
}

const isFile = (file) => {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
};

/** Relative paths (with `/`) of all files below `dir`, sorted. */
function walk(dir, prefix = '') {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile()) found.push(rel);
  }
  return found.sort();
}

/**
 * The files of a release in `from` (normally `dist/`): the program files and everything in `public/`.
 * `name` is the path inside the program folder, always with `/`. Throws if the build is incomplete.
 */
export function collectRelease(from) {
  const missing = PROGRAM_FILES.filter((name) => !isFile(path.join(from, name)));
  if (!isFile(path.join(from, 'public', 'index.html'))) missing.push('public/index.html');
  if (missing.length > 0) {
    throw new ReleaseError(`The build is incomplete: ${missing.join(', ')} not found in ${from}. Run "npm run build" first.`);
  }
  const entries = PROGRAM_FILES.map((name) => ({ name, file: path.join(from, name) }));
  for (const rel of walk(path.join(from, 'public'))) entries.push({ name: `public/${rel}`, file: path.join(from, 'public', ...rel.split('/')) });
  return entries;
}

/** The content to write for an entry: launchers always get CRLF, everything else is copied byte for byte. */
export function entryData(entry) {
  if (BATCH_FILES.includes(entry.name)) return Buffer.from(toCrlf(fs.readFileSync(entry.file, 'utf8')), 'utf8');
  return fs.readFileSync(entry.file);
}

/** What `server.lock` in a program folder says: null if there is none, otherwise its fields (missing ones stay undefined). */
export function readLock(dir) {
  let text;
  try {
    text = fs.readFileSync(path.join(dir, 'server.lock'), 'utf8');
  } catch {
    return null;
  }
  try {
    const { pid, port, startedAt } = JSON.parse(text);
    return { pid, port, startedAt };
  } catch {
    return {};
  }
}

/** True if `child` is `parent` itself or lies below it. */
export function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
