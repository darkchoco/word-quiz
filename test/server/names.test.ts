import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dbNameExists, findExistingDbName, isValidDbName, sameDbName } from '../../src/server/db/names';
import { createDatabase } from '../../src/server/db/open';
import { insertWord } from '../../src/server/db/queries';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();

function makeDb(dir: string, name: string, words: string[] = []): void {
  const db = createDatabase(path.join(dir, name), 'latin');
  for (const headword of words) insertWord(db, { headword, meanings: [['x']] });
  db.close();
}


describe('isValidDbName', () => {
  it.each(['latin.db', 'latin_2.db', 'A-b_1.db', 'x.db', 'a'.repeat(64) + '.db', 'console.db', 'com10.db'])(
    'accepts %s',
    (name) => expect(isValidDbName(name)).toBe(true),
  );

  it.each([
    ['', 'empty'],
    ['.db', 'no name'],
    ['../x.db', 'parent directory'],
    ['a/b.db', 'slash'],
    ['a\\b.db', 'backslash'],
    ['x.txt', 'wrong extension'],
    ['x.DB', 'upper case extension'],
    ['a b.db', 'space'],
    ['a.b.db', 'extra dot'],
    ['ä.db', 'non-ASCII'],
    ['a'.repeat(65) + '.db', 'too long'],
    ['x.db\n', 'trailing newline'],
    ['con.db', 'Windows device CON'],
    ['NUL.db', 'Windows device NUL'],
    ['Aux.db', 'Windows device AUX'],
    ['prn.db', 'Windows device PRN'],
    ['com1.db', 'Windows device COM1'],
    ['COM9.db', 'Windows device COM9'],
    ['lpt1.db', 'Windows device LPT1'],
    ['LPT9.db', 'Windows device LPT9'],
  ])('rejects %j (%s)', (name) => expect(isValidDbName(name)).toBe(false));
});

describe('sameDbName and dbNameExists', () => {
  it('compares names ignoring case', () => {
    expect(sameDbName('Latin.db', 'latin.db')).toBe(true);
    expect(sameDbName('latin.db', 'latin_2.db')).toBe(false);
  });

  it('finds an existing file whatever the case (Windows would overwrite it)', () => {
    const dir = t.dir();
    makeDb(dir, 'Latin.db');
    expect(dbNameExists(dir, 'Latin.db')).toBe(true);
    expect(dbNameExists(dir, 'latin.db')).toBe(true);
    expect(dbNameExists(dir, 'LATIN.DB')).toBe(true);
    expect(dbNameExists(dir, 'latin_2.db')).toBe(false);
  });

  it('tells the real spelling of the file that is in the way', () => {
    const dir = t.dir();
    makeDb(dir, 'Latin.db');
    expect(findExistingDbName(dir, 'latin.db')).toBe('Latin.db');
    expect(findExistingDbName(dir, 'LATIN.DB')).toBe('Latin.db');
    expect(findExistingDbName(dir, 'other.db')).toBeUndefined();
    expect(findExistingDbName(path.join(dir, 'missing'), 'latin.db')).toBeUndefined();
  });

  it('is false when the data directory does not exist', () => {
    expect(dbNameExists(path.join(t.dir(), 'missing'), 'latin.db')).toBe(false);
  });
});
