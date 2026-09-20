import type { DatabaseSync } from 'node:sqlite';
import { AppError } from '../errors';

const V1 = `
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE word (
  id         INTEGER PRIMARY KEY,
  headword   TEXT NOT NULL UNIQUE,
  meanings   TEXT NOT NULL CHECK (json_valid(meanings)),
  note       TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE word_progress (
  word_id    INTEGER PRIMARY KEY REFERENCES word(id) ON DELETE CASCADE,
  streak     INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
  wrong_mark INTEGER NOT NULL DEFAULT 0 CHECK (wrong_mark IN (0,1)),
  next_round INTEGER NOT NULL DEFAULT 1 CHECK (next_round >= 1),
  done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1))
);
CREATE INDEX idx_progress_pool ON word_progress(done, next_round);

CREATE TABLE session (
  id           INTEGER PRIMARY KEY,
  started_at   INTEGER NOT NULL,
  ended_at     INTEGER,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE round (
  id         INTEGER PRIMARY KEY,
  number     INTEGER NOT NULL UNIQUE,
  session_id INTEGER NOT NULL REFERENCES session(id),
  mode       TEXT NOT NULL CHECK (mode IN ('normal','retest')),
  direction  TEXT NOT NULL CHECK (direction IN ('word_to_meaning','meaning_to_word','mix')),
  total      INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at   INTEGER
);

CREATE TABLE round_question (
  round_id     INTEGER NOT NULL REFERENCES round(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  word_id      INTEGER NOT NULL REFERENCES word(id),
  direction    TEXT NOT NULL CHECK (direction IN ('word_to_meaning','meaning_to_word')),
  answer_input TEXT,
  verdict      TEXT CHECK (verdict IN ('perfect','partial','wrong')),
  hits         TEXT CHECK (hits IS NULL OR json_valid(hits)),
  answered_at  INTEGER,
  PRIMARY KEY (round_id, position),
  UNIQUE (round_id, word_id)
);
CREATE INDEX idx_rq_answered ON round_question(answered_at) WHERE answered_at IS NOT NULL;
`;

/** Ordered by version. Never edit a released migration; add a new one instead. */
export const MIGRATIONS: readonly { version: number; sql: string }[] = [{ version: 1, sql: V1 }];

export const CURRENT_VERSION: number = Math.max(...MIGRATIONS.map((m) => m.version));

export function getUserVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

/** Refuses a database that was written by a newer version of the program. */
export function assertNotTooNew(db: DatabaseSync): void {
  const version = getUserVersion(db);
  if (version > CURRENT_VERSION) {
    throw new AppError(
      'DB_TOO_NEW',
      `This database uses schema version ${version}, but this program supports up to ${CURRENT_VERSION}.`,
    );
  }
}

/** Applies every pending migration, each in its own transaction. Safe to call repeatedly. */
export function migrate(db: DatabaseSync): void {
  assertNotTooNew(db);
  const current = getUserVersion(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // already rolled back
      }
      throw error;
    }
  }
}
