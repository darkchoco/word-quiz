import fs from 'node:fs';
import path from 'node:path';
import type { AnswerResult, RoundState, Verdict } from '../../src/shared/api';
import { createContext, type AppContext } from '../../src/server/context';
import { createDatabase } from '../../src/server/db/open';
import { getProgress, insertWord, saveProgress, setQuestionsPerRound } from '../../src/server/db/queries';
import { getAllWords } from '../../src/server/db/queries';
import type { Progress } from '../../src/shared/scheduling';
import { submitAnswer } from '../../src/server/services/round';
import { requireSession } from '../../src/server/context';
import { useTempDir } from './tempdir';

export interface WordSpec {
  headword: string;
  meanings: string[][];
}

/** Three words: A and B have one meaning group, C has two (so it can be answered only half right). */
export const ABC: WordSpec[] = [
  { headword: 'A', meanings: [['alpha']] },
  { headword: 'B', meanings: [['beta']] },
  { headword: 'C', meanings: [['gamma one', 'gamma two'], ['gamma three']] },
];

export interface World {
  ctx: AppContext;
  home: string;
  dataDir: string;
  file: string;
  /** The clock used by the context. Change `now` to let time pass. */
  clock: { now: number };
  logs: string[];
}

/** A temporary application folder with one Latin database that holds `words`. */
export function makeWorld(
  t: ReturnType<typeof useTempDir>,
  words: WordSpec[] = ABC,
  options: { questionsPerRound?: number; dbName?: string } = {},
): World {
  const home = t.dir();
  const dataDir = path.join(home, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, options.dbName ?? 'latin.db');
  const db = createDatabase(file, 'latin');
  for (const word of words) insertWord(db, word, 1);
  if (options.questionsPerRound !== undefined) setQuestionsPerRound(db, options.questionsPerRound);
  db.close();

  const clock = { now: 1_000_000 };
  const logs: string[] = [];
  const ctx = createContext({ home, now: () => clock.now, log: (line) => logs.push(line) });
  return { ctx, home, dataDir, file, clock, logs };
}

/** Adds another empty-progress Latin database next to the first one. */
export function addDatabase(world: World, name: string, words: WordSpec[]): string {
  const file = path.join(world.dataDir, name);
  const db = createDatabase(file, 'latin');
  for (const word of words) insertWord(db, word, 1);
  db.close();
  return file;
}

/** What to type to get every meaning group right. */
export const correctInput = (meanings: string[][]): string => meanings.map((group) => group[0]).join(', ');
/** What to type to get only the first group right (needs at least two groups). */
export const partialInput = (meanings: string[][]): string => meanings[0]?.[0] ?? '';
export const WRONG_INPUT = 'xyzzy';

export function inputFor(verdict: Verdict, meanings: string[][]): string {
  if (verdict === 'perfect') return correctInput(meanings);
  if (verdict === 'partial') return partialInput(meanings);
  return WRONG_INPUT;
}

function meaningsOf(ctx: AppContext): Map<string, string[][]> {
  const { db } = requireSession(ctx);
  return new Map(getAllWords(db).map((w) => [w.headword, w.meanings]));
}

/**
 * Answers every question of a round. `verdicts` says which answer each word gets (default:
 * Perfect). Returns the results in the order the questions were asked, with the headwords.
 */
export function answerRound(
  ctx: AppContext,
  round: RoundState,
  verdicts: Record<string, Verdict> = {},
): { headword: string; result: AnswerResult }[] {
  const meanings = meaningsOf(ctx);
  const out: { headword: string; result: AnswerResult }[] = [];
  let state = round;
  while (state.question) {
    const { headword, position } = state.question;
    const wanted = verdicts[headword] ?? 'perfect';
    const result = submitAnswer(ctx, state.roundId, { position, input: inputFor(wanted, meanings.get(headword) ?? []) });
    out.push({ headword, result });
    state = result.round;
  }
  return out;
}

/** The headwords of all questions of a round, in order (reads the database, not the API). */
export function headwordsOf(ctx: AppContext, roundId: number): string[] {
  const { db } = requireSession(ctx);
  const rows = db
    .prepare(
      'SELECT w.headword AS headword FROM round_question rq JOIN word w ON w.id = rq.word_id WHERE rq.round_id = ? ORDER BY rq.position',
    )
    .all(roundId) as { headword: string }[];
  return rows.map((r) => r.headword);
}

/** Sets the learning progress of a word directly, to skip many rounds in a test. */
export function setProgress(ctx: AppContext, headword: string, progress: Partial<Progress>): void {
  const { db } = requireSession(ctx);
  const id = (db.prepare('SELECT id FROM word WHERE headword = ?').get(headword) as { id: number }).id;
  const current = getProgress(db, id) as Progress;
  saveProgress(db, id, { ...current, ...progress });
}

export function progressOf(ctx: AppContext, headword: string): Progress {
  const { db } = requireSession(ctx);
  const id = (db.prepare('SELECT id FROM word WHERE headword = ?').get(headword) as { id: number }).id;
  return getProgress(db, id) as Progress;
}
