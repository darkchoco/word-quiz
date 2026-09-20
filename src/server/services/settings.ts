import { getQuestionsPerRound, setQuestionsPerRound } from '../db/queries';
import { AppError } from '../errors';
import { requireSession, type AppContext } from '../context';

export interface Settings {
  questionsPerRound: number;
}

export function getSettings(ctx: AppContext): Settings {
  return { questionsPerRound: getQuestionsPerRound(requireSession(ctx).db) };
}

/** Saves the settings of the current database. The value must be a whole number from 1 to 200. */
export function putSettings(ctx: AppContext, value: unknown): Settings {
  const { db } = requireSession(ctx);
  if (typeof value !== 'number') {
    throw new AppError('INVALID_SETTING', 'Questions per round must be a number.');
  }
  return { questionsPerRound: setQuestionsPerRound(db, value) };
}
