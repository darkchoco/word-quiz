import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/server/db/open';
import { insertWord } from '../../src/server/db/queries';
import { AppError, translateSqliteError } from '../../src/server/errors';
import { thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();
const freshDb = () => t.track(createDatabase(path.join(t.dir(), 'latin.db'), 'latin'));

describe('AppError', () => {
  it('carries the code and derives the HTTP status from it', () => {
    const error = new AppError('DB_NOT_FOUND', 'missing');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('DB_NOT_FOUND');
    expect(error.status).toBe(404);
    expect(new AppError('POOL_EMPTY', 'x').status).toBe(409);
  });
});

describe('translateSqliteError', () => {
  it('maps a duplicate headword to HEADWORD_EXISTS', () => {
    const db = freshDb();
    insertWord(db, { headword: 'taurus', meanings: [['Stier']] });
    const error = thrown(() => insertWord(db, { headword: 'taurus', meanings: [['Stier']] }));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('HEADWORD_EXISTS');
  });

  it('maps CHECK, NOT NULL and FOREIGN KEY failures to INVALID_REQUEST', () => {
    const db = freshDb();
    const cases = [
      () => db.exec("INSERT INTO word (headword, meanings, created_at, updated_at) VALUES ('a', 'not json', 0, 0)"),
      () => db.exec("INSERT INTO word (headword, meanings, created_at, updated_at) VALUES (NULL, '[]', 0, 0)"),
      () => db.exec('INSERT INTO word_progress (word_id) VALUES (9999)'),
    ];
    for (const run of cases) {
      const translated = translateSqliteError(thrown(run));
      expect(translated).toBeInstanceOf(AppError);
      expect((translated as AppError).code).toBe('INVALID_REQUEST');
    }
  });

  it('maps any other UNIQUE failure to INTERNAL', () => {
    const db = freshDb();
    db.exec("INSERT INTO session (started_at, last_seen_at) VALUES (0, 0)");
    const insertRound = () =>
      db.exec("INSERT INTO round (number, session_id, mode, direction, total, started_at) VALUES (1, 1, 'normal', 'word_to_meaning', 1, 0)");
    insertRound();
    const translated = translateSqliteError(thrown(insertRound));
    expect((translated as AppError).code).toBe('INTERNAL');
  });

  it('keeps the original error as the cause', () => {
    const db = freshDb();
    insertWord(db, { headword: 'taurus', meanings: [['Stier']] });
    const error = thrown(() => insertWord(db, { headword: 'taurus', meanings: [['Stier']] })) as AppError;
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as Error).message).toMatch(/UNIQUE constraint failed: word\.headword/);
  });

  it('leaves everything else unchanged', () => {
    const plain = new Error('boom');
    expect(translateSqliteError(plain)).toBe(plain);
    expect(translateSqliteError('text')).toBe('text');
    const app = new AppError('EMPTY_INPUT', 'x');
    expect(translateSqliteError(app)).toBe(app);
  });
});
