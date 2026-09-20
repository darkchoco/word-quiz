import type { DatabaseSync } from 'node:sqlite';
import {
  QUESTIONS_PER_ROUND_DEFAULT,
  QUESTIONS_PER_ROUND_MAX,
  QUESTIONS_PER_ROUND_MIN,
  type Stats,
} from '../../shared/api';
import { validateMeanings } from '../../shared/meanings';
import type { Progress } from '../../shared/scheduling';
import { AppError } from '../errors';
import { savepoint } from './transaction';

const QUESTIONS_KEY = 'questions_per_round';

interface CountRow {
  n: number;
}

/** Result of a query that always returns exactly one row (an aggregate). */
function one<T>(row: unknown): T {
  if (row === undefined) throw new Error("Expected the query to return a row");
  return row as T;
}

/** The number the next round will get. Round numbers continue across restarts. */
export function nextRoundNumber(db: DatabaseSync): number {
  return one<CountRow>(db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM round').get()).n;
}

export function countWords(db: DatabaseSync): number {
  return one<CountRow>(db.prepare('SELECT COUNT(*) AS n FROM word').get()).n;
}

/** True when the database has words and every one of them is done. */
export function allWordsDone(db: DatabaseSync): boolean {
  const row = one<{ total: number; remaining: number }>(
    db
      .prepare('SELECT COUNT(*) AS total, COALESCE(SUM(done = 0), 0) AS remaining FROM word_progress')
      .get(),
  );
  return row.total > 0 && row.remaining === 0;
}

// The pool: not done, and eligible from this round on. A retest also needs the wrong mark.
const POOL_FROM = `FROM word w JOIN word_progress p ON p.word_id = w.id
                   WHERE p.done = 0 AND p.next_round <= ?`;
const RETEST_ONLY = ' AND p.wrong_mark = 1';

/** Number of words that can be asked in round `n`. */
export function countPool(db: DatabaseSync, n: number, retest = false): number {
  const sql = `SELECT COUNT(*) AS n ${POOL_FROM}${retest ? RETEST_ONLY : ''}`;
  return one<CountRow>(db.prepare(sql).get(n)).n;
}

/** Picks up to `limit` distinct word ids from the pool of round `n`, in random order. */
export function pickPool(
  db: DatabaseSync,
  n: number,
  options: { limit: number; retest?: boolean },
): number[] {
  if (!Number.isInteger(options.limit) || options.limit < 0) {
    throw new RangeError('limit must be a non-negative integer');
  }
  const sql = `SELECT w.id AS id ${POOL_FROM}${options.retest ? RETEST_ONLY : ''}
               ORDER BY RANDOM() LIMIT ?`;
  const rows = db.prepare(sql).all(n, options.limit) as { id: number }[];
  return rows.map((row) => row.id);
}

/** Status bar numbers. `correct` counts Perfect answers only (PRD D34). */
export function sessionStats(db: DatabaseSync, sessionId: number): Stats {
  const row = one<{ tested: number; correct: number }>(
    db
      .prepare(
        `SELECT COUNT(*) AS tested, COALESCE(SUM(rq.verdict = 'perfect'), 0) AS correct
           FROM round_question rq JOIN round r ON r.id = rq.round_id
          WHERE r.session_id = ? AND rq.answered_at IS NOT NULL`,
      )
      .get(sessionId),
  );
  return { totalWords: countWords(db), tested: row.tested, correct: row.correct };
}

export function getQuestionsPerRound(db: DatabaseSync): number {
  const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(QUESTIONS_KEY) as
    | { value: string }
    | undefined;
  const value = Number(row?.value);
  const valid =
    Number.isInteger(value) && value >= QUESTIONS_PER_ROUND_MIN && value <= QUESTIONS_PER_ROUND_MAX;
  return valid ? value : QUESTIONS_PER_ROUND_DEFAULT;
}

export function setQuestionsPerRound(db: DatabaseSync, value: number): number {
  if (
    !Number.isInteger(value) ||
    value < QUESTIONS_PER_ROUND_MIN ||
    value > QUESTIONS_PER_ROUND_MAX
  ) {
    throw new AppError(
      'INVALID_SETTING',
      `Questions per round must be a whole number from ${QUESTIONS_PER_ROUND_MIN} to ${QUESTIONS_PER_ROUND_MAX}.`,
    );
  }
  db.prepare(
    'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(QUESTIONS_KEY, String(value));
  return value;
}

export interface NewWord {
  headword: string;
  meanings: string[][];
  note?: string | null;
}

/**
 * Inserts a word together with its default progress row and returns the new id.
 * The headword is stored trimmed and in NFC. Works inside or outside a transaction.
 */
export function insertWord(db: DatabaseSync, word: NewWord, now: number = Date.now()): number {
  const headword = word.headword.normalize('NFC').trim();
  if (headword === '') {
    throw new AppError('INVALID_REQUEST', 'The headword must not be empty.');
  }
  const problem = validateMeanings(word.meanings);
  if (problem !== null) {
    throw new AppError('INVALID_MEANINGS', `The meanings are not valid (${problem}).`);
  }
  return savepoint(db, () => {
    const result = db
      .prepare(
        'INSERT INTO word (headword, meanings, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(headword, JSON.stringify(word.meanings), word.note ?? null, now, now);
    const id = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO word_progress (word_id) VALUES (?)').run(id);
    return id;
  });
}

interface ProgressRow {
  streak: number;
  wrong_mark: number;
  next_round: number;
  done: number;
}

export function getProgress(db: DatabaseSync, wordId: number): Progress | undefined {
  const row = db
    .prepare('SELECT streak, wrong_mark, next_round, done FROM word_progress WHERE word_id = ?')
    .get(wordId) as ProgressRow | undefined;
  if (!row) return undefined;
  return {
    streak: row.streak,
    wrongMark: row.wrong_mark === 1,
    nextRound: row.next_round,
    done: row.done === 1,
  };
}

export function saveProgress(db: DatabaseSync, wordId: number, progress: Progress): void {
  const result = db
    .prepare(
      'UPDATE word_progress SET streak = ?, wrong_mark = ?, next_round = ?, done = ? WHERE word_id = ?',
    )
    .run(progress.streak, progress.wrongMark ? 1 : 0, progress.nextRound, progress.done ? 1 : 0, wordId);
  if (Number(result.changes) === 0) {
    throw new AppError('WORD_NOT_FOUND', 'The word does not exist.');
  }
}

/** A word as stored, without its learning progress. */
export interface StoredWord {
  id: number;
  headword: string;
  meanings: string[][];
  note: string | null;
}

function parseStoredMeanings(json: string, headword: string): string[][] {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    value = undefined;
  }
  const ok =
    Array.isArray(value) &&
    value.every((group) => Array.isArray(group) && group.every((item) => typeof item === 'string'));
  if (!ok) throw new AppError('INTERNAL', `The stored meanings of "${headword}" are damaged.`);
  return value as string[][];
}

/** Every word, oldest first. */
export function getAllWords(db: DatabaseSync): StoredWord[] {
  const rows = db.prepare('SELECT id, headword, meanings, note FROM word ORDER BY id').all() as {
    id: number;
    headword: string;
    meanings: string;
    note: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    headword: row.headword,
    meanings: parseStoredMeanings(row.meanings, row.headword),
    note: row.note,
  }));
}

/**
 * Replaces the meanings and the note of a word and touches `updated_at`. The headword and the
 * learning progress stay as they are. An empty note is stored as NULL.
 */
export function updateWordContent(
  db: DatabaseSync,
  id: number,
  content: { meanings: string[][]; note: string | null },
  now: number = Date.now(),
): void {
  const problem = validateMeanings(content.meanings);
  if (problem !== null) {
    throw new AppError('INVALID_MEANINGS', `The meanings are not valid (${problem}).`);
  }
  const note = content.note === null || content.note.trim() === '' ? null : content.note;
  const result = db
    .prepare('UPDATE word SET meanings = ?, note = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(content.meanings), note, now, id);
  if (Number(result.changes) === 0) {
    throw new AppError('WORD_NOT_FOUND', 'The word does not exist.');
  }
}
