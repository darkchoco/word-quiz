import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { getUserVersion } from '../../src/server/db/migrations';
import { createDatabase, openDatabase } from '../../src/server/db/open';
import { countWords, insertWord } from '../../src/server/db/queries';
import { startSession } from '../../src/server/db/sessions';
import { AppError } from '../../src/server/errors';
import { thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();

const scalar = (db: DatabaseSync, sql: string): unknown => {
  const row = db.prepare(sql).get() as Record<string, unknown>;
  return Object.values(row)[0];
};

describe('openDatabase: files that cannot be opened', () => {
  it('reports a missing file as DB_NOT_FOUND and does not create it', () => {
    const file = path.join(t.dir(), 'latin.db');
    const error = thrown(() => openDatabase(file));
    expect((error as AppError).code).toBe('DB_NOT_FOUND');
    expect(fs.existsSync(file)).toBe(false);
  });

  it('reports a directory as DB_NOT_FOUND', () => {
    const dir = t.dir();
    expect((thrown(() => openDatabase(dir)) as AppError).code).toBe('DB_NOT_FOUND');
  });

  it('rejects a file that is not a SQLite database and leaves it untouched', () => {
    const file = path.join(t.dir(), 'latin.db');
    fs.writeFileSync(file, 'this is not a database');
    expect((thrown(() => openDatabase(file)) as AppError).code).toBe('DB_NOT_FOUND');
    expect(fs.readFileSync(file, 'utf8')).toBe('this is not a database');
  });

  it('rejects a SQLite file that has no Word Quiz meta table', () => {
    const file = path.join(t.dir(), 'other.db');
    const other = new DatabaseSync(file);
    other.exec('CREATE TABLE something (x)');
    other.close();
    expect((thrown(() => openDatabase(file)) as AppError).code).toBe('DB_NOT_FOUND');
  });
});

describe('createDatabase', () => {
  it('creates the schema, the language and the default settings', () => {
    const file = path.join(t.dir(), 'latin.db');
    const db = t.track(createDatabase(file, 'latin', 1234));
    expect(getUserVersion(db)).toBe(1);
    expect(scalar(db, "SELECT value FROM meta WHERE key = 'language'")).toBe('latin');
    expect(scalar(db, "SELECT value FROM meta WHERE key = 'created_at'")).toBe('1234');
    expect(scalar(db, "SELECT value FROM setting WHERE key = 'questions_per_round'")).toBe('20');
  });

  it('applies the connection settings', () => {
    const db = t.track(createDatabase(path.join(t.dir(), 'latin.db'), 'latin'));
    expect(scalar(db, 'PRAGMA foreign_keys')).toBe(1);
    expect(scalar(db, 'PRAGMA busy_timeout')).toBe(5000);
    expect(scalar(db, 'PRAGMA journal_mode')).toBe('delete');
  });

  it('refuses a name that differs only in case, on every operating system', () => {
    const dir = t.dir();
    const first = createDatabase(path.join(dir, 'Latin.db'), 'latin');
    insertWord(first, { headword: 'taurus', meanings: [['Stier']] });
    first.close();

    for (const name of ['latin.db', 'LATIN.db', 'lAtIn.db']) {
      const error = thrown(() => createDatabase(path.join(dir, name), 'latin'));
      expect((error as AppError).code, name).toBe('INVALID_REQUEST');
    }
    expect(fs.readdirSync(dir)).toEqual(['Latin.db']);
    const again = t.track(openDatabase(path.join(dir, 'Latin.db')));
    expect(countWords(again)).toBe(1);
  });

  it('creates missing parent directories', () => {
    const file = path.join(t.dir(), 'nested', 'data', 'latin.db');
    t.track(createDatabase(file, 'latin'));
    expect(fs.existsSync(file)).toBe(true);
  });

  it('refuses to overwrite an existing database and leaves it intact', () => {
    const file = path.join(t.dir(), 'latin.db');
    const first = createDatabase(file, 'latin');
    insertWord(first, { headword: 'taurus', meanings: [['Stier']] });
    first.close();

    const error = thrown(() => createDatabase(file, 'latin'));
    expect((error as AppError).code).toBe('INVALID_REQUEST');

    const again = t.track(openDatabase(file));
    expect(countWords(again)).toBe(1);
  });

  it('refuses a path that is already taken by a directory', () => {
    const dir = t.dir();
    fs.mkdirSync(path.join(dir, 'latin.db'));
    expect(() => createDatabase(path.join(dir, 'latin.db'), 'latin')).toThrow();
    expect(fs.statSync(path.join(dir, 'latin.db')).isDirectory()).toBe(true);
  });
});

describe('openDatabase: existing databases', () => {
  it('reopens a database with its data', () => {
    const file = path.join(t.dir(), 'latin.db');
    const db = createDatabase(file, 'latin');
    insertWord(db, { headword: 'taurus', meanings: [['Stier']] });
    db.close();
    const again = t.track(openDatabase(file));
    expect(countWords(again)).toBe(1);
    expect(scalar(again, 'PRAGMA foreign_keys')).toBe(1);
  });

  it('opens read-only and blocks writes', () => {
    const file = path.join(t.dir(), 'latin.db');
    createDatabase(file, 'latin').close();
    const db = t.track(openDatabase(file, { readOnly: true }));
    expect(() => insertWord(db, { headword: 'a', meanings: [['x']] })).toThrow(/readonly/i);
  });

  it('refuses a database from a newer version, in both modes, without changing it', () => {
    const file = path.join(t.dir(), 'latin.db');
    const db = createDatabase(file, 'latin');
    db.exec('PRAGMA user_version = 99');
    db.close();
    for (const readOnly of [false, true]) {
      expect((thrown(() => openDatabase(file, { readOnly })) as AppError).code).toBe('DB_TOO_NEW');
    }
    const check = t.track(new DatabaseSync(file));
    expect(getUserVersion(check)).toBe(99);
  });
});

describe('openDatabase: recovering sessions', () => {
  function withOrphan(): string {
    const file = path.join(t.dir(), 'latin.db');
    const db = createDatabase(file, 'latin');
    startSession(db, 1000);
    db.close();
    return file;
  }
  const endedAt = (db: DatabaseSync) => scalar(db, 'SELECT ended_at FROM session');

  it('leaves open sessions alone by default (the import CLI must not end a live session)', () => {
    const db = t.track(openDatabase(withOrphan()));
    expect(endedAt(db)).toBeNull();
  });

  it('closes them at their last activity time when asked to', () => {
    const db = t.track(openDatabase(withOrphan(), { recoverSessions: true }));
    expect(endedAt(db)).toBe(1000);
  });

  it('ignores the request for a read-only connection', () => {
    const db = t.track(openDatabase(withOrphan(), { readOnly: true, recoverSessions: true }));
    expect(endedAt(db)).toBeNull();
  });
});
