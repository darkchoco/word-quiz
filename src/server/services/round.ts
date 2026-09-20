import type { AnswerResult, Direction, PoolInfo, RoundMode, RoundState } from '../../shared/api';
import { grade } from '../../shared/grading';
import { applyResult } from '../../shared/scheduling';
import { transaction } from '../db/transaction';
import {
  allWordsDone,
  getProgress,
  getQuestionsPerRound,
  nextRoundNumber,
  pickPool,
  saveProgress,
  sessionStats,
} from '../db/queries';
import {
  createRound,
  finishRound,
  getNextPosition,
  getOpenRoundId,
  getQuestion,
  getRoundRow,
  getRoundState,
  recordAnswer,
  resolveStartRound,
  roundSummary,
} from '../db/rounds';
import { AppError } from '../errors';
import { requireSession, type AppContext } from '../context';

/** The longest answer that is accepted. */
export const MAX_INPUT_LENGTH = 1000;

/** What the round start screen shows: which round comes next and how many words can be asked. */
export function getPoolInfo(ctx: AppContext): PoolInfo {
  const { db } = requireSession(ctx);
  const normal = resolveStartRound(db, false);
  const retest = resolveStartRound(db, true);
  const fallback = nextRoundNumber(db);
  return {
    nextRoundNumber: normal?.number ?? fallback,
    available: normal?.available ?? 0,
    retestRoundNumber: retest?.number ?? fallback,
    wrongAvailable: retest?.available ?? 0,
    questionsPerRound: getQuestionsPerRound(db),
    allDone: allWordsDone(db),
  };
}

/**
 * Starts a round: picks the words at random from the pool and fixes the questions. Only one
 * round can be open at a time; it has to be finished (or the session ended) first.
 */
export function startRound(ctx: AppContext, request: { mode: RoundMode; direction: Direction }): RoundState {
  const { db, sessionId } = requireSession(ctx);
  if (getOpenRoundId(db, sessionId) !== undefined) {
    throw new AppError('ROUND_IN_PROGRESS', 'A round is already in progress. Finish it first.');
  }
  if (request.direction !== 'word_to_meaning') {
    throw new AppError('DIRECTION_UNSUPPORTED', 'Latin only supports the direction word to meaning.');
  }
  if (allWordsDone(db)) {
    throw new AppError('ALL_DONE', 'Every word is done.');
  }
  const retest = request.mode === 'retest';
  const plan = resolveStartRound(db, retest);
  if (!plan) {
    throw new AppError('POOL_EMPTY', retest ? 'There are no wrong words to test again.' : 'There are no words to ask.');
  }
  const wordIds = pickPool(db, plan.number, {
    limit: Math.min(getQuestionsPerRound(db), plan.available),
    retest,
  });
  const roundId = createRound(
    db,
    { sessionId, mode: request.mode, direction: request.direction, number: plan.number, wordIds },
    ctx.now(),
  );
  return getRoundState(db, roundId);
}

/** The round that is in progress, so that a reload can continue it. */
export function getCurrentRound(ctx: AppContext): RoundState {
  const { db, sessionId } = requireSession(ctx);
  const roundId = getOpenRoundId(db, sessionId);
  if (roundId === undefined) throw new AppError('NO_ACTIVE_ROUND', 'There is no round in progress.');
  return getRoundState(db, roundId);
}

/**
 * Grades an answer and records it. Everything happens in one transaction: the answer, the
 * learning progress of the word and, after the last question, the end of the round.
 */
export function submitAnswer(
  ctx: AppContext,
  roundId: number,
  request: { position: number; input: string },
): AnswerResult {
  const { position, input } = request;
  if (input.trim() === '') throw new AppError('EMPTY_INPUT', 'Enter the meaning first.');
  if (input.length > MAX_INPUT_LENGTH) {
    throw new AppError('INVALID_REQUEST', `The answer is too long (at most ${MAX_INPUT_LENGTH} characters).`);
  }

  const { db, sessionId } = requireSession(ctx);
  const round = getRoundRow(db, roundId);
  if (!round || round.sessionId !== sessionId) {
    throw new AppError('NO_ACTIVE_ROUND', 'There is no such round in this session.');
  }
  const question = getQuestion(db, roundId, position);
  if (!question) throw new AppError('OUT_OF_ORDER', 'There is no such question in this round.');
  if (question.answered) throw new AppError('ALREADY_ANSWERED', 'This question has already been answered.');
  if (getNextPosition(db, roundId) !== position) {
    throw new AppError('OUT_OF_ORDER', 'Answer the questions in order.');
  }

  const now = ctx.now();
  const outcome = transaction(db, () => {
    const { hits, verdict } = grade(question.meanings, input);
    recordAnswer(db, { roundId, position, input, verdict, hits }, now);

    const before = getProgress(db, question.wordId);
    if (!before) throw new AppError('WORD_NOT_FOUND', 'The word does not exist.');
    const { progress, askDone } = applyResult(before, verdict, round.number);
    saveProgress(db, question.wordId, progress);

    const finished = getNextPosition(db, roundId) === null;
    if (finished) finishRound(db, roundId, now);
    return { hits, verdict, askDone, finished };
  });

  return {
    verdict: outcome.verdict,
    groups: question.meanings.map((synonyms, index) => ({ synonyms, hit: outcome.hits[index] === true })),
    wordId: question.wordId,
    askDone: outcome.askDone,
    canMarkDone: outcome.verdict !== 'wrong',
    stats: sessionStats(db, sessionId),
    round: getRoundState(db, roundId),
    summary: outcome.finished ? roundSummary(db, roundId) : null,
  };
}
