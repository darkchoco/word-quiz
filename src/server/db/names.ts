import fs from 'node:fs';

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}\.db$/;

/** Windows treats these as devices whatever the extension ("con.db" is not a file). */
const WINDOWS_RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);


/** A database file name: 1-64 letters, digits, "_" or "-" plus ".db", and not a Windows device name. */
export function isValidDbName(name: string): boolean {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) return false;
  return !WINDOWS_RESERVED.has(name.slice(0, -'.db'.length).toLowerCase());
}

/** Windows file names are case-insensitive, so `Latin.db` and `latin.db` are the same name. */
export function sameDbName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * True if a file whose name equals `name` ignoring case exists in `dataDir`. The import CLI
 * checks this before creating a database, because on Windows `latin.db` would silently
 * overwrite an existing `Latin.db`.
 */
export function dbNameExists(dataDir: string, name: string): boolean {
  let entries: string[];
  try {
    entries = fs.readdirSync(dataDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  return entries.some((entry) => sameDbName(entry, name));
}
