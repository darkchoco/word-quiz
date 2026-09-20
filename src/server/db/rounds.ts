import type { DatabaseSync } from 'node:sqlite';
import type {
  Direction,
  Question,
  QuestionDirection,
  RoundMode,
  RoundState,
  RoundSummary,
  Verdict,
} from '../../shared/api';
import { AppError } from '../errors';
import { countPool, nextRoundNumber, parseStoredMeanings } from './queries';
import { transaction } from './transaction';

export interface StartPlan {
  /** The number the round will get. */
  number: number;
  /** Words that can be asked in a round with that number. */
  available: number;
}

/**
 * Decides which round number the next round gets and how many words can be asked in it.
 *
 * Normally that is the next free number. But a word that was answered correctly is held back
 * for two or three rounds, and round numbers only go up when a round is started. If every word
 * is being held back the pool of the next number is empty and no round could ever be started.
 * So in that case the number jumps to the earliest round in which a word is due again
 * (PRD D38). Returns null when there is nothing left to ask at all.
 */
export function resolveStartRound(db: DatabaseSync, retest: boolean): StartPlan | null {
  const base = nextRoundNumber(db);
  const atBase = countPool(db, base, retest);
  if (atBase > 0) return { number: base, available: atBase };

  const row = db
    .prepare(`SELECT MIN(next_round) AS due FROM word_progress WHERE done = 0${retest ? ' AND wrong_mark = 1' : ''}`)
    .get() as { due: number | null } | undefined;
  const due = row?.due ?? null;
  if (due === null) return null;

  const number = Math.max(due, base);
  return { number, available: countPool(db, number, retest) };
}

export interface NewRound {
  sessionId: number;
  mode: RoundMode;
  direction: Direction;
  number: number;
  /** In the order they will be asked. */
  wordIds: readonly number[];
}

/**
 * Creates a round and fixes its questions, all in one transaction, so that a reload can
 * continue the same round. Returns the round id.
 */
export function createRound(
  db: DatabaseSync,
  round: NewRound,
  now: number = Date.now(),
  questionDirection: QuestionDirection = 'word_to_meaning',
): number {
  return transaction(db, () => {
    const inserted = db
      .prepare(
        'INSERT INTO round (number, session_id, mode, direction, total, started_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(round.number, round.sessionId, round.mode, round.direction, round.wordIds.length, now);
    const roundId = Number(inserted.lastInsertRowid);
    const insertQuestion = db.prepare(
      'INSERT INTO round_question (round_id, position, word_id, direction) VALUES (?, ?, ?, ?)',
    );
    round.wordIds.forEach((wordId, index) => insertQuestion.run(roundId, index + 1, wordId, questionDirection));
    return roundId;
  });
}

export interface RoundRow {
  id: number;
  number: number;
  sessionId: number;
  mode: RoundMode;
  direction: Direction;
  total: number;
  endedAt: number | null;
}

export function getRoundRow(db: DatabaseSync, roundId: number): RoundRow | undefined {
  const row = db
    .prepare('SELECT id, number, session_id, mode, direction, total, ended_at FROM round WHERE id = ?')
    .get(roundId) as
    | { id: number; number: number; session_id: number; mode: RoundMode; direction: Direction; total: number; ended_at: number | null }
    | undefined;
  if (!row) return undefined;
  return {
    id: row.id,
    number: row.number,
    sessionId: row.session_id,
    mode: row.mode,
    direction: row.direction,
    total: row.total,
    endedAt: row.ended_at,
  };
}

/** The round of this session that has not been finished yet, if any (the newest one). */
export function getOpenRoundId(db: DatabaseSync, sessionId: number): number | undefined {
  const row = db
    .prepare('SELECT id FROM round WHERE session_id = ? AND ended_at IS NULL ORDER BY number DESC LIMIT 1')
    .get(sessionId) as { id: number } | undefined;
  return row?.id;
}

/** The newest round of this session, finished or not. */
export function getLatestRoundId(db: DatabaseSync, sessionId: number): number | undefined {
  const row = db
    .prepare('SELECT id FROM round WHERE session_id = ? ORDER BY number DESC LIMIT 1')
    .get(sessionId) as { id: number } | undefined;
  return row?.id;
}

/** The state of a round as the client sees it, including the next unanswered question. */
export function getRoundState(db: DatabaseSync, roundId: number): RoundState {
  const round = getRoundRow(db, roundId);
  if (!round) throw new AppError('NO_ACTIVE_ROUND', 'There is no such round.');
  const answered = (
    db
      .prepare('SELECT COUNT(*) AS n FROM round_question WHERE round_id = ? AND answered_at IS NOT NULL')
      .get(roundId) as { n: number }
  ).n;
  const next = db
    .prepare(
      `SELECT rq.position AS position, rq.direction AS direction, w.headword AS headword
         FROM round_question rq JOIN word w ON w.id = rq.word_id
        WHERE rq.round_id = ? AND rq.answered_at IS NULL
        ORDER BY rq.position LIMIT 1`,
    )
    .get(roundId) as { position: number; direction: QuestionDirection; headword: string } | undefined;
  const question: Question | null = next
    ? { position: next.position, headword: next.headword, direction: next.direction }
    : null;
  return {
    roundId: round.id,
    number: round.number,
    mode: round.mode,
    direction: round.direction,
    total: round.total,
    answered,
    question,
  };
}

export interface StoredQuestion {
  wordId: number;
  headword: string;
  meanings: string[][];
  /** Null while the question is unanswered. */
  verdict: Verdict | null;
  answered: boolean;
}

export function getQuestion(db: DatabaseSync, roundId: number, position: number): StoredQuestion | undefined {
  const row = db
    .prepare(
      `SELECT rq.word_id AS word_id, rq.verdict AS verdict, rq.answered_at AS answered_at,
              w.headword AS headword, w.meanings AS meanings
         FROM round_question rq JOIN word w ON w.id = rq.word_id
        WHERE rq.round_id = ? AND rq.position = ?`,
    )
    .get(roundId, position) as
    | { word_id: number; verdict: Verdict | null; answered_at: number | null; headword: string; meanings: string }
    | undefined;
  if (!row) return undefined;
  return {
    wordId: row.word_id,
    headword: row.headword,
    meanings: parseStoredMeanings(row.meanings, row.headword),
    verdict: row.verdict,
    answered: row.answered_at !== null,
  };
}

/** The position of the first question without an answer, or null when all are answered. */
export function getNextPosition(db: DatabaseSync, roundId: number): number | null {
  const row = db
    .prepare('SELECT MIN(position) AS p FROM round_question WHERE round_id = ? AND answered_at IS NULL')
    .get(roundId) as { p: number | null } | undefined;
  return row?.p ?? null;
}

export function recordAnswer(
  db: DatabaseSync,
  answer: { roundId: number; position: number; input: string; verdict: Verdict; hits: readonly boolean[] },
  now: number = Date.now(),
): void {
  const result = db
    .prepare(
      `UPDATE round_question
          SET answer_input = ?, verdict = ?, hits = ?, answered_at = ?
        WHERE round_id = ? AND position = ? AND answered_at IS NULL`,
    )
    .run(answer.input, answer.verdict, JSON.stringify(answer.hits), now, answer.roundId, answer.position);
  if (Number(result.changes) === 0) {
    throw new AppError('ALREADY_ANSWERED', 'This question has already been answered.');
  }
}

export function finishRound(db: DatabaseSync, roundId: number, now: number = Date.now()): void {
  db.prepare('UPDATE round SET ended_at = ? WHERE id = ? AND ended_at IS NULL').run(now, roundId);
}

export function roundSummary(db: DatabaseSync, roundId: number): RoundSummary {
  const round = getRoundRow(db, roundId);
  if (!round) throw new AppError('NO_ACTIVE_ROUND', 'There is no such round.');
  const correct = (
    db
      .prepare("SELECT COUNT(*) AS n FROM round_question WHERE round_id = ? AND verdict = 'perfect'")
      .get(roundId) as { n: number }
  ).n;
  const percent = round.total === 0 ? 0 : Math.round((correct * 100) / round.total);
  return { total: round.total, correct, percent };
}
