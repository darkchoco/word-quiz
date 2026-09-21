// Shared by build.mjs, package.mjs and deploy.mjs: what a release consists of, and how its files are written.

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
