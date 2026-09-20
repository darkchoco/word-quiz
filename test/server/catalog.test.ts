import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listDatabases, resolveDatabase } from '../../src/server/db/catalog';
import { createDatabase } from '../../src/server/db/open';
import { insertWord } from '../../src/server/db/queries';
import { AppError } from '../../src/server/errors';
import { thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();

function makeDb(dir: string, name: string, words: string[] = []): void {
  const db = createDatabase(path.join(dir, name), 'latin');
  for (const headword of words) insertWord(db, { headword, meanings: [['x']] });
  db.close();
}

/** True on Windows/macOS defaults, where two names that differ only in case are one file. */
function caseInsensitiveFileSystem(): boolean {
  const dir = t.dir();
  fs.writeFileSync(path.join(dir, 'a'), '1');
  fs.writeFileSync(path.join(dir, 'A'), '2');
  return fs.readdirSync(dir).length === 1;
}

describe('listDatabases', () => {
  it('returns an empty list when the data directory does not exist', () => {
    expect(listDatabases(path.join(t.dir(), 'missing'))).toEqual({ databases: [], warnings: [] });
  });

  it('lists Latin databases with their word counts, sorted by name', () => {
    const dir = t.dir();
    makeDb(dir, 'b.db', ['one', 'two']);
    makeDb(dir, 'A.db');
    makeDb(dir, 'c.db', ['one']);
    const { databases, warnings } = listDatabases(dir);
    expect(databases).toEqual([
      { name: 'A.db', language: 'latin', wordCount: 0 },
      { name: 'b.db', language: 'latin', wordCount: 2 },
      { name: 'c.db', language: 'latin', wordCount: 1 },
    ]);
    expect(warnings).toEqual([]);
  });

  it('ignores files that are not databases, and directories', () => {
    const dir = t.dir();
    makeDb(dir, 'latin.db');
    fs.writeFileSync(path.join(dir, 'readme.txt'), 'hello');
    fs.mkdirSync(path.join(dir, 'backup'));
    makeDb(path.join(dir, 'backup'), 'latin.20260920.db');
    const { databases, warnings } = listDatabases(dir);
    expect(databases.map((d) => d.name)).toEqual(['latin.db']);
    expect(warnings).toEqual([]);
  });

  it('skips unusable .db files and says why', () => {
    const dir = t.dir();
    makeDb(dir, 'latin.db');
    fs.writeFileSync(path.join(dir, 'garbage.db'), 'not a database');
    fs.writeFileSync(path.join(dir, 'con.db'), 'x');
    fs.writeFileSync(path.join(dir, 'bad name.db'), 'x');
    const { databases, warnings } = listDatabases(dir);
    expect(databases.map((d) => d.name)).toEqual(['latin.db']);
    expect(warnings.some((w) => w.startsWith('garbage.db:'))).toBe(true);
    expect(warnings.some((w) => w.startsWith('con.db:'))).toBe(true);
    expect(warnings.some((w) => w.startsWith('bad name.db:'))).toBe(true);
  });

  it('skips databases of a language the program does not support yet', () => {
    const dir = t.dir();
    const db = createDatabase(path.join(dir, 'english.db'), 'latin');
    db.exec("UPDATE meta SET value = 'english' WHERE key = 'language'");
    db.close();
    const { databases, warnings } = listDatabases(dir);
    expect(databases).toEqual([]);
    expect(warnings).toEqual(['english.db: unsupported language "english"']);
  });

  it('skips a database from a newer version with a warning', () => {
    const dir = t.dir();
    const db = createDatabase(path.join(dir, 'latin.db'), 'latin');
    db.exec('PRAGMA user_version = 99');
    db.close();
    const { databases, warnings } = listDatabases(dir);
    expect(databases).toEqual([]);
    expect(warnings).toHaveLength(1);
  });

  it.skipIf(caseInsensitiveFileSystem())(
    'lists names that differ only in case and warns about the collision',
    () => {
      const dir = t.dir();
      makeDb(dir, 'Latin.db');
      // createDatabase refuses this name, so build the collision the way it really happens:
      // a folder copied from a case-sensitive system.
      fs.copyFileSync(path.join(dir, 'Latin.db'), path.join(dir, 'latin.db'));
      const { databases, warnings } = listDatabases(dir);
      expect(databases.map((d) => d.name)).toEqual(['latin.db', 'Latin.db']);
      expect(warnings).toEqual(['Latin.db, latin.db: names differ only in case and collide on Windows']);
    },
  );
});

describe('resolveDatabase', () => {
  it('returns the path of a listed database', () => {
    const dir = t.dir();
    makeDb(dir, 'latin.db');
    expect(resolveDatabase(dir, 'latin.db')).toBe(path.join(dir, 'latin.db'));
  });

  it.each(['../latin.db', 'a/b.db', '..\\x.db', '', 'x.txt', 'con.db'])(
    'rejects the invalid name %j before touching the disk',
    (name) => {
      const dir = t.dir();
      makeDb(dir, 'latin.db');
      const error = thrown(() => resolveDatabase(dir, name));
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('INVALID_DB_NAME');
    },
  );

  it('reports a valid name that is not in the list as DB_NOT_FOUND', () => {
    const dir = t.dir();
    makeDb(dir, 'latin.db');
    expect((thrown(() => resolveDatabase(dir, 'other.db')) as AppError).code).toBe('DB_NOT_FOUND');
  });

  it('does not accept a file that exists but is not a Word Quiz database', () => {
    const dir = t.dir();
    fs.writeFileSync(path.join(dir, 'garbage.db'), 'nope');
    expect((thrown(() => resolveDatabase(dir, 'garbage.db')) as AppError).code).toBe('DB_NOT_FOUND');
  });

  it('reports a missing data directory as DB_NOT_FOUND', () => {
    const missing = path.join(t.dir(), 'missing');
    expect((thrown(() => resolveDatabase(missing, 'latin.db')) as AppError).code).toBe('DB_NOT_FOUND');
  });
});
