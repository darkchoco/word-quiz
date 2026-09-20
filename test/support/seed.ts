import type { DatabaseSync } from 'node:sqlite';
import type { Verdict } from '../../src/shared/api';
import type { Progress } from '../../src/shared/scheduling';
import { getProgress, insertWord, saveProgress } from '../../src/server/db/queries';

/** Adds a word and optionally overrides parts of its progress. Returns the word id. */
export function addWord(
  db: DatabaseSync,
  headword: string,
  progress: Partial<Progress> = {},
  meanings: string[][] = [['x']],
): number {
  const id = insertWord(db, { headword, meanings });
  if (Object.keys(progress).length > 0) {
    const current = getProgress(db, id);
    if (!current) throw new Error('progress row missing');
    saveProgress(db, id, { ...current, ...progress });
  }
  return id;
}

/** Records one question of a round. `verdict: null` means it was not answered yet. */
export function recordQuestion(
  db: DatabaseSync,
  o: { sessionId: number; roundNumber: number; position: number; wordId: number; verdict: Verdict | null },
): void {
  db.prepare(
    `INSERT OR IGNORE INTO round (number, session_id, mode, direction, total, started_at)
     VALUES (?, ?, 'normal', 'word_to_meaning', 20, 0)`,
  ).run(o.roundNumber, o.sessionId);
  const round = db.prepare('SELECT id FROM round WHERE number = ?').get(o.roundNumber) as { id: number };
  db.prepare(
    `INSERT INTO round_question (round_id, position, word_id, direction, verdict, answered_at)
     VALUES (?, ?, ?, 'word_to_meaning', ?, ?)`,
  ).run(round.id, o.position, o.wordId, o.verdict, o.verdict === null ? null : 1000);
}

export { thrown } from './thrown';
