// Behaviour check for the database layer on a real operating system (run by scripts/win-db-check.sh
// on Linux and on Windows). It uses plain node:assert because vitest cannot run under Windows Node
// when node_modules was installed on Linux.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { listDatabases } from '../../src/server/db/catalog';
import { dbNameExists, isValidDbName } from '../../src/server/db/names';
import { createDatabase, openDatabase } from '../../src/server/db/open';
import { countPool, countWords, insertWord } from '../../src/server/db/queries';
import { closeOrphanSessions, startSession } from '../../src/server/db/sessions';
import { AppError } from '../../src/server/errors';

const root = process.argv[2];
if (!root) {
  console.error('Usage: db-check.mjs <scratch directory>');
  process.exit(2);
}
const dataDir = path.join(root, 'data');
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

let failed = 0;
function check(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL  ${label}\n        ${(error as Error).message.split('\n')[0]}`);
  }
}

console.log(`platform: ${process.platform}, node ${process.version}, dir ${root}`);
const file = path.join(dataDir, 'Latin.db');

check('create a database and find it in the scan', () => {
  const db = createDatabase(file, 'latin');
  insertWord(db, { headword: 'capiō, cēpī', meanings: [['fassen', 'nehmen'], ['erobern']] });
  insertWord(db, { headword: 'taurus', meanings: [['Stier']] });
  db.close();
  const { databases, warnings } = listDatabases(dataDir);
  assert.deepEqual(databases, [{ name: 'Latin.db', language: 'latin', wordCount: 2 }]);
  assert.deepEqual(warnings, []);
});

check('no journal or side files are left next to the database', () => {
  assert.deepEqual(fs.readdirSync(dataDir), ['Latin.db']);
});

check('data with macrons survives a round trip', () => {
  const db = openDatabase(file);
  const row = db.prepare("SELECT headword FROM word WHERE headword LIKE 'cap%'").get() as { headword: string };
  db.close();
  assert.equal(row.headword, 'capiō, cēpī');
});

check('pool queries work', () => {
  const db = openDatabase(file);
  assert.equal(countPool(db, 1), 2);
  assert.equal(countPool(db, 1, true), 0);
  db.close();
});

check('a name that differs only in case counts as taken', () => {
  assert.equal(dbNameExists(dataDir, 'latin.db'), true);
  assert.equal(dbNameExists(dataDir, 'LATIN.DB'), true);
  assert.equal(dbNameExists(dataDir, 'other.db'), false);
});

check('creating "latin.db" next to "Latin.db" is refused and the original stays intact', () => {
  assert.throws(
    () => createDatabase(path.join(dataDir, 'latin.db'), 'latin'),
    (error: unknown) => error instanceof AppError && error.code === 'INVALID_REQUEST',
  );
  const db = openDatabase(file);
  assert.equal(countWords(db), 2);
  db.close();
  assert.deepEqual(fs.readdirSync(dataDir), ['Latin.db']);
});

check('Windows device names are refused', () => {
  for (const name of ['con.db', 'NUL.db', 'com1.db', 'LPT9.db']) assert.equal(isValidDbName(name), false, name);
});

check('read-only connections cannot write', () => {
  const db = openDatabase(file, { readOnly: true });
  assert.throws(() => insertWord(db, { headword: 'x', meanings: [['y']] }), /readonly/i);
  db.close();
});

check('sessions left open are closed only when recovery is requested', () => {
  const db = openDatabase(file);
  startSession(db, 1000);
  db.close();
  const plain = openDatabase(file);
  assert.equal((plain.prepare('SELECT ended_at FROM session').get() as { ended_at: number | null }).ended_at, null);
  plain.close();
  const recovering = openDatabase(file, { recoverSessions: true });
  assert.equal((recovering.prepare('SELECT ended_at FROM session').get() as { ended_at: number }).ended_at, 1000);
  assert.equal(closeOrphanSessions(recovering), 0);
  recovering.close();
});

check('an open database file cannot be deleted or renamed on Windows, and can be after close()', () => {
  const db = openDatabase(file);
  const moved = path.join(dataDir, 'Moved.db');
  if (process.platform === 'win32') {
    assert.throws(() => fs.rmSync(file), 'delete while open should fail on Windows');
    assert.throws(() => fs.renameSync(file, moved), 'rename while open should fail on Windows');
    assert.equal(fs.existsSync(file), true);
  }
  db.close();
  fs.renameSync(file, moved);
  fs.rmSync(moved);
  assert.deepEqual(fs.readdirSync(dataDir), []);
});

fs.rmSync(root, { recursive: true, force: true });
console.log(failed === 0 ? 'ALL PASSED' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
