// Types and constants shared by the server, the client and the import CLI.
// This module must stay free of imports so that it can be bundled for the browser.

export type Verdict = 'perfect' | 'partial' | 'wrong';
export type Direction = 'word_to_meaning' | 'meaning_to_word' | 'mix';
export type QuestionDirection = 'word_to_meaning' | 'meaning_to_word';
export type RoundMode = 'normal' | 'retest';
export type Language = 'latin';

/** Status bar numbers. `correct` counts Perfect answers only (PRD D34). */
export interface Stats {
  totalWords: number;
  tested: number;
  correct: number;
}

export interface Question {
  position: number;
  headword: string;
  direction: QuestionDirection;
}

export interface RoundState {
  roundId: number;
  number: number;
  mode: RoundMode;
  direction: Direction;
  total: number;
  answered: number;
  /** Next unanswered question, or null when the round is finished. */
  question: Question | null;
}

export interface SessionState {
  db: string;
  language: Language;
  sessionId: number;
  startedAt: number;
  questionsPerRound: number;
  stats: Stats;
  activeRound: RoundState | null;
}

export interface PoolInfo {
  /** The number the next normal round will get (after skipping empty rounds, PRD D38). */
  nextRoundNumber: number;
  /** Words that can be asked in that round. */
  available: number;
  /** The number a retest would get, which can differ from `nextRoundNumber`. */
  retestRoundNumber: number;
  /** Wrong-marked words that can be asked in that retest. */
  wrongAvailable: number;
  questionsPerRound: number;
  allDone: boolean;
}

export interface AnswerGroup {
  synonyms: string[];
  hit: boolean;
}

export interface RoundSummary {
  total: number;
  correct: number;
  percent: number;
}

export interface AnswerResult {
  verdict: Verdict;
  groups: AnswerGroup[];
  wordId: number;
  /** True from the third consecutive Perfect on: the client asks "Mark this word as done?". */
  askDone: boolean;
  canMarkDone: boolean;
  stats: Stats;
  round: RoundState;
  /** Present only when this answer finished the round. */
  summary: RoundSummary | null;
}

export interface WordRow {
  id: number;
  headword: string;
  meanings: string[][];
  done: boolean;
  wrongMark: boolean;
}

export interface DatabaseInfo {
  name: string;
  language: Language;
  wordCount: number;
}

/** HTTP status for every error code (TECH-SPEC 5.1). */
export const ERROR_STATUS = {
  INVALID_REQUEST: 400,
  INVALID_DB_NAME: 400,
  EMPTY_INPUT: 400,
  INVALID_MEANINGS: 400,
  INVALID_SETTING: 400,
  FORBIDDEN_HOST: 403,
  NOT_FOUND: 404,
  DB_NOT_FOUND: 404,
  NO_SESSION: 404,
  NO_ACTIVE_ROUND: 404,
  WORD_NOT_FOUND: 404,
  DB_TOO_NEW: 409,
  ROUND_IN_PROGRESS: 409,
  POOL_EMPTY: 409,
  ALL_DONE: 409,
  ALREADY_ANSWERED: 409,
  OUT_OF_ORDER: 409,
  HEADWORD_EXISTS: 409,
  MARK_DONE_NOT_ALLOWED: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  DIRECTION_UNSUPPORTED: 422,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string };
}

export const QUESTIONS_PER_ROUND_MIN = 1;
export const QUESTIONS_PER_ROUND_MAX = 200;
export const QUESTIONS_PER_ROUND_DEFAULT = 20;
