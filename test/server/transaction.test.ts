import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/server/db/open';
import { countWords, insertWord } from '../../src/server/db/queries';
import { savepoint, transaction } from '../../src/server/db/transaction';
import { AppError } from '../../src/server/errors';
import { thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();
const freshDb = () => t.track(createDatabase(path.join(t.dir(), 'latin.db'), 'latin'));
const add = (db: ReturnType<typeof freshDb>, headword: string) =>
  insertWord(db, { headword, meanings: [['x']] });

describe('transaction', () => {
  it('commits when the function returns and passes the result through', () => {
    const db = freshDb();
    const id = transaction(db, () => add(db, 'a'));
    expect(id).toBeGreaterThan(0);
    expect(countWords(db)).toBe(1);
  });

  it('rolls everything back when the function throws, and rethrows the same error', () => {
    const db = freshDb();
    const boom = new Error('boom');
    const error = thrown(() =>
      transaction(db, () => {
        add(db, 'a');
        add(db, 'b');
        throw boom;
      }),
    );
    expect(error).toBe(boom);
    expect(countWords(db)).toBe(0);
  });

  it('translates SQLite constraint failures', () => {
    const db = freshDb();
    add(db, 'a');
    const error = thrown(() => transaction(db, () => add(db, 'a')));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('HEADWORD_EXISTS');
  });

  it('leaves the connection usable after a failure', () => {
    const db = freshDb();
    thrown(() =>
      transaction(db, () => {
        throw new Error('first');
      }),
    );
    expect(() => transaction(db, () => add(db, 'a'))).not.toThrow();
    expect(countWords(db)).toBe(1);
  });
});

describe('savepoint', () => {
  it('works without an outer transaction', () => {
    const db = freshDb();
    savepoint(db, () => add(db, 'a'));
    expect(countWords(db)).toBe(1);
    thrown(() =>
      savepoint(db, () => {
        add(db, 'b');
        throw new Error('nope');
      }),
    );
    expect(countWords(db)).toBe(1);
  });

  it('undoes only its own work when the caller handles the error inside a transaction', () => {
    const db = freshDb();
    transaction(db, () => {
      add(db, 'a');
      thrown(() =>
        savepoint(db, () => {
          add(db, 'b');
          throw new Error('inner');
        }),
      );
      add(db, 'c');
    });
    expect(countWords(db)).toBe(2);
    expect(db.prepare('SELECT headword FROM word ORDER BY headword').all()).toEqual([
      { headword: 'a' },
      { headword: 'c' },
    ]);
  });

  it('is undone together with a failing outer transaction', () => {
    const db = freshDb();
    thrown(() =>
      transaction(db, () => {
        savepoint(db, () => add(db, 'a'));
        throw new Error('outer');
      }),
    );
    expect(countWords(db)).toBe(0);
  });
});
