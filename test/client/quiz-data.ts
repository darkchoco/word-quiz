import type { AnswerResult, PoolInfo, RoundState, SessionState, Stats } from '../../src/shared/api';

export const pool = (over: Partial<PoolInfo> = {}): PoolInfo => ({
  nextRoundNumber: 1,
  available: 178,
  retestRoundNumber: 1,
  wrongAvailable: 0,
  questionsPerRound: 20,
  allDone: false,
  ...over,
});

/** A round of `total` questions with the given number of them answered. */
export const round = (answered: number, total = 3, headwords = ['taurus', 'canis', 'equus'], over: Partial<RoundState> = {}): RoundState => ({
  roundId: 7,
  number: 1,
  mode: 'normal',
  direction: 'word_to_meaning',
  total,
  answered,
  question: answered < total ? { position: answered + 1, headword: headwords[answered] ?? `word${answered + 1}`, direction: 'word_to_meaning' } : null,
  ...over,
});

export const stats = (tested: number, correct: number): Stats => ({ totalWords: 178, tested, correct });

export const answerResult = (over: Partial<AnswerResult> = {}): AnswerResult => ({
  verdict: 'perfect',
  groups: [{ synonyms: ['Stier'], hit: true }],
  wordId: 11,
  askDone: false,
  canMarkDone: true,
  stats: stats(1, 1),
  round: round(1),
  summary: null,
  ...over,
});

export type { SessionState };
