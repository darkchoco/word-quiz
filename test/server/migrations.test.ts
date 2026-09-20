import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  assertNotTooNew,
  CURRENT_VERSION,
  getUserVersion,
  migrate,
} from '../../src/server/db/migrations';
import { AppError } from '../../src/server/errors';
import { thrown } from '../support/thrown';

function newDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

const names = (db: DatabaseSync, type: string) =>
  (db.prepare('SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ? ORDER BY name').all(type, 'sqlite_%') as {
    name: string;
  }[]).map((row) => row.name);

describe('migrate', () => {
  it('creates the v1 schema on an empty database', () => {
    const db = newDb();
    expect(names(db, 'table')).toEqual([
      'meta',
      'round',
      'round_question',
      'session',
      'setting',
      'word',
      'word_progress',
    ]);
    expect(names(db, 'index')).toContain('idx_progress_pool');
    expect(names(db, 'index')).toContain('idx_rq_answered');
    expect(getUserVersion(db)).toBe(CURRENT_VERSION);
    expect(CURRENT_VERSION).toBe(1);
  });

  it('can run again without changing anything', () => {
    const db = newDb();
    const before = db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY name').all();
    expect(() => migrate(db)).not.toThrow();
    expect(db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY name').all()).toEqual(before);
    expect(getUserVersion(db)).toBe(1);
  });

  it('refuses a database written by a newer version', () => {
    const db = newDb();
    db.exec('PRAGMA user_version = 99');
    const error = thrown(() => migrate(db));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('DB_TOO_NEW');
    expect(() => assertNotTooNew(db)).toThrow(AppError);
    expect(getUserVersion(db)).toBe(99);
  });
});

describe('schema constraints', () => {
  function seeded(): DatabaseSync {
    const db = newDb();
    db.exec(`
      INSERT INTO word (id, headword, meanings, created_at, updated_at) VALUES (1, 'a', '[["x"]]', 0, 0), (2, 'b', '[["y"]]', 0, 0);
      INSERT INTO word_progress (word_id) VALUES (1);
      INSERT INTO session (id, started_at, last_seen_at) VALUES (1, 0, 0);
      INSERT INTO round (id, number, session_id, mode, direction, total, started_at) VALUES (1, 1, 1, 'normal', 'word_to_meaning', 2, 0);
      INSERT INTO round_question (round_id, position, word_id, direction) VALUES (1, 1, 1, 'word_to_meaning');
    `);
    return db;
  }

  it.each([
    ['negative streak', 'UPDATE word_progress SET streak = -1'],
    ['wrong_mark outside 0/1', 'UPDATE word_progress SET wrong_mark = 2'],
    ['next_round below 1', 'UPDATE word_progress SET next_round = 0'],
    ['done outside 0/1', 'UPDATE word_progress SET done = 2'],
    ['invalid round mode', "UPDATE round SET mode = 'other'"],
    ['invalid round direction', "UPDATE round SET direction = 'sideways'"],
    ['mix as a per-question direction', "UPDATE round_question SET direction = 'mix'"],
    ['invalid verdict', "UPDATE round_question SET verdict = 'great'"],
    ['hits that is not JSON', "UPDATE round_question SET hits = 'nope'"],
    ['meanings that is not JSON', "UPDATE word SET meanings = 'nope' WHERE id = 1"],
    ['duplicate headword', "INSERT INTO word (headword, meanings, created_at, updated_at) VALUES ('a', '[]', 0, 0)"],
    ['same word twice in a round', "INSERT INTO round_question (round_id, position, word_id, direction) VALUES (1, 2, 1, 'word_to_meaning')"],
    ['duplicate round number', "INSERT INTO round (number, session_id, mode, direction, total, started_at) VALUES (1, 1, 'normal', 'word_to_meaning', 1, 0)"],
    ['round without a session', "INSERT INTO round (number, session_id, mode, direction, total, started_at) VALUES (2, 99, 'normal', 'word_to_meaning', 1, 0)"],
  ])('rejects %s', (_label, sql) => {
    const db = seeded();
    expect(() => db.exec(sql)).toThrow(/constraint failed/i);
  });

  it('accepts valid rows', () => {
    const db = seeded();
    expect(() =>
      db.exec("UPDATE round_question SET verdict = 'perfect', hits = '[true]', answered_at = 5"),
    ).not.toThrow();
  });

  it('deletes the progress row together with its word', () => {
    const db = seeded();
    db.exec('DELETE FROM round_question');
    db.exec('DELETE FROM word WHERE id = 1');
    expect(db.prepare('SELECT COUNT(*) AS n FROM word_progress').get()).toEqual({ n: 0 });
  });

  it('refuses to delete a word that appears in a round', () => {
    const db = seeded();
    expect(() => db.exec('DELETE FROM word WHERE id = 1')).toThrow(/FOREIGN KEY/);
  });

  it('removes questions together with their round', () => {
    const db = seeded();
    db.exec('DELETE FROM round WHERE id = 1');
    expect(db.prepare('SELECT COUNT(*) AS n FROM round_question').get()).toEqual({ n: 0 });
  });
});
