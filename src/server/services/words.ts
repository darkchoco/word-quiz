import type { WordRow } from '../../shared/api';
import { markDone, unmarkDone } from '../../shared/scheduling';
import { getProgress, nextRoundNumber, saveProgress } from '../db/queries';
import { getLatestRoundId, getQuestion } from '../db/rounds';
import { getWordRow, listWordRows, listWrongWordRows, updateWord } from '../db/words';
import { AppError } from '../errors';
import { requireSession, type AppContext } from '../context';

export const listWords = (ctx: AppContext): WordRow[] => listWordRows(requireSession(ctx).db);

/** Words with a wrong mark that are not done (PRD 4.4). */
export const listWrong = (ctx: AppContext): WordRow[] => listWrongWordRows(requireSession(ctx).db);

const isGroups = (value: unknown): value is string[][] =>
  Array.isArray(value) && value.every((group) => Array.isArray(group) && group.every((item) => typeof item === 'string'));

/** Changes the headword and/or the meanings of a word. */
export function patchWord(ctx: AppContext, id: number, body: { headword?: unknown; meanings?: unknown }): WordRow {
  const { db } = requireSession(ctx);
  if (body.headword !== undefined && typeof body.headword !== 'string') {
    throw new AppError('INVALID_REQUEST', 'The headword must be text.');
  }
  if (body.meanings !== undefined && !isGroups(body.meanings)) {
    throw new AppError('INVALID_MEANINGS', 'The meanings must be a list of groups of text.');
  }
  return updateWord(db, id, { headword: body.headword, meanings: body.meanings }, ctx.now());
}

/**
 * Marks a word done or puts it back into the pool.
 *
 * When `questionPosition` is given the request comes from the "Mark done" button or the
 * three-times-in-a-row question of the round that was just played: then that question must be
 * of this word and must not have been answered wrongly (PRD 4.5). The words screen does not send
 * a position and can change any word.
 */
export function setDone(
  ctx: AppContext,
  id: number,
  request: { done: boolean; questionPosition?: number },
): WordRow {
  const { db, sessionId } = requireSession(ctx);
  if (!getWordRow(db, id)) throw new AppError('WORD_NOT_FOUND', 'The word does not exist.');
  const progress = getProgress(db, id);
  if (!progress) throw new AppError('WORD_NOT_FOUND', 'The word does not exist.');

  if (request.done) {
    if (request.questionPosition !== undefined) {
      const roundId = getLatestRoundId(db, sessionId);
      const question = roundId === undefined ? undefined : getQuestion(db, roundId, request.questionPosition);
      if (!question || question.wordId !== id || !question.answered || question.verdict === 'wrong') {
        throw new AppError('MARK_DONE_NOT_ALLOWED', 'A word that was answered wrongly cannot be marked done.');
      }
    }
    saveProgress(db, id, markDone(progress));
  } else {
    saveProgress(db, id, unmarkDone(progress, nextRoundNumber(db)));
  }
  return getWordRow(db, id) as WordRow;
}
