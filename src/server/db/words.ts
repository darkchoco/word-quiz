import type { DatabaseSync } from 'node:sqlite';
import type { WordRow } from '../../shared/api';
import { validateMeanings } from '../../shared/meanings';
import { AppError } from '../errors';
import { parseStoredMeanings } from './queries';
import { savepoint } from './transaction';

interface JoinedRow {
  id: number;
  headword: string;
  meanings: string;
  done: number;
  wrong_mark: number;
}

const SELECT_ROWS = `SELECT w.id AS id, w.headword AS headword, w.meanings AS meanings,
                            p.done AS done, p.wrong_mark AS wrong_mark
                       FROM word w JOIN word_progress p ON p.word_id = w.id`;

const toRow = (row: JoinedRow): WordRow => ({
  id: row.id,
  headword: row.headword,
  meanings: parseStoredMeanings(row.meanings, row.headword),
  done: row.done === 1,
  wrongMark: row.wrong_mark === 1,
});

/** All words with their done flag and wrong mark, oldest first. */
export function listWordRows(db: DatabaseSync): WordRow[] {
  return (db.prepare(`${SELECT_ROWS} ORDER BY w.id`).all() as unknown as JoinedRow[]).map(toRow);
}

/** Words with a wrong mark that are not done yet (PRD 4.4). */
export function listWrongWordRows(db: DatabaseSync): WordRow[] {
  const sql = `${SELECT_ROWS} WHERE p.wrong_mark = 1 AND p.done = 0 ORDER BY w.id`;
  return (db.prepare(sql).all() as unknown as JoinedRow[]).map(toRow);
}

export function getWordRow(db: DatabaseSync, id: number): WordRow | undefined {
  const row = db.prepare(`${SELECT_ROWS} WHERE w.id = ?`).get(id) as JoinedRow | undefined;
  return row ? toRow(row) : undefined;
}

/**
 * Changes the headword and/or the meanings of a word (the notes are not editable). The headword
 * is stored trimmed and in NFC; a headword that another word already has is refused.
 */
export function updateWord(
  db: DatabaseSync,
  id: number,
  patch: { headword?: string; meanings?: string[][] },
  now: number = Date.now(),
): WordRow {
  if (patch.headword === undefined && patch.meanings === undefined) {
    throw new AppError('INVALID_REQUEST', 'Nothing to change: give a headword or meanings.');
  }
  const current = getWordRow(db, id);
  if (!current) throw new AppError('WORD_NOT_FOUND', 'The word does not exist.');

  let headword = current.headword;
  if (patch.headword !== undefined) {
    headword = patch.headword.normalize('NFC').trim();
    if (headword === '') throw new AppError('INVALID_REQUEST', 'The headword must not be empty.');
  }
  const meanings = patch.meanings ?? current.meanings;
  const problem = validateMeanings(meanings);
  if (problem !== null) {
    throw new AppError('INVALID_MEANINGS', `The meanings are not valid (${problem}).`);
  }

  savepoint(db, () => {
    db.prepare('UPDATE word SET headword = ?, meanings = ?, updated_at = ? WHERE id = ?').run(
      headword,
      JSON.stringify(meanings),
      now,
      id,
    );
  });
  return getWordRow(db, id) as WordRow;
}
