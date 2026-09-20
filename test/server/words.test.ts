import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/server/db/open';
import { getProgress, insertWord, saveProgress } from '../../src/server/db/queries';
import { getWordRow, listWordRows, listWrongWordRows, updateWord } from '../../src/server/db/words';
import { AppError } from '../../src/server/errors';
import { addWord, thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();
const freshDb = () => t.track(createDatabase(path.join(t.dir(), 'latin.db'), 'latin'));

describe('word lists', () => {
  it('lists every word with its done flag and wrong mark, oldest first', () => {
    const db = freshDb();
    addWord(db, 'capere', { wrongMark: true }, [['fassen', 'nehmen'], ['erobern']]);
    addWord(db, 'taurus', { done: true }, [['Stier']]);
    addWord(db, 'gravis');
    expect(listWordRows(db)).toEqual([
      { id: 1, headword: 'capere', meanings: [['fassen', 'nehmen'], ['erobern']], done: false, wrongMark: true },
      { id: 2, headword: 'taurus', meanings: [['Stier']], done: true, wrongMark: false },
      { id: 3, headword: 'gravis', meanings: [['x']], done: false, wrongMark: false },
    ]);
  });

  it('lists only words with a wrong mark that are not done', () => {
    const db = freshDb();
    addWord(db, 'wrong', { wrongMark: true });
    addWord(db, 'fine');
    addWord(db, 'done', { wrongMark: true, done: true });
    expect(listWrongWordRows(db).map((w) => w.headword)).toEqual(['wrong']);
  });

  it('returns one word or undefined', () => {
    const db = freshDb();
    const id = addWord(db, 'taurus');
    expect(getWordRow(db, id)?.headword).toBe('taurus');
    expect(getWordRow(db, 999)).toBeUndefined();
  });

  it('gives empty lists for an empty database', () => {
    const db = freshDb();
    expect(listWordRows(db)).toEqual([]);
    expect(listWrongWordRows(db)).toEqual([]);
  });
});

describe('updateWord', () => {
  it('changes the headword (trimmed, NFC) and the meanings and returns the new row', () => {
    const db = freshDb();
    const id = insertWord(db, { headword: 'taurus', meanings: [['Stier']], note: 'keep me' }, 100);
    const row = updateWord(db, id, { headword: '  taurus, tauri m  ', meanings: [['Stier', 'Bulle']] }, 500);
    expect(row).toEqual({ id, headword: 'taurus, tauri m', meanings: [['Stier', 'Bulle']], done: false, wrongMark: false });
    expect(db.prepare('SELECT note, created_at, updated_at FROM word WHERE id = ?').get(id)).toEqual({
      note: 'keep me',
      created_at: 100,
      updated_at: 500,
    });
  });

  it('can change only one of the two', () => {
    const db = freshDb();
    const id = addWord(db, 'a', {}, [['x']]);
    expect(updateWord(db, id, { headword: 'b' }).meanings).toEqual([['x']]);
    expect(updateWord(db, id, { meanings: [['y']] }).headword).toBe('b');
  });

  it('stores a decomposed headword in NFC', () => {
    const db = freshDb();
    const id = addWord(db, 'a');
    expect(updateWord(db, id, { headword: 'capiū' }).headword).toBe('capiū');
  });

  it('leaves the learning progress alone', () => {
    const db = freshDb();
    const id = addWord(db, 'a');
    saveProgress(db, id, { streak: 3, wrongMark: true, nextRound: 9, done: true });
    updateWord(db, id, { headword: 'b', meanings: [['q']] });
    expect(getProgress(db, id)).toEqual({ streak: 3, wrongMark: true, nextRound: 9, done: true });
  });

  it('accepts the word\'s own headword again', () => {
    const db = freshDb();
    const id = addWord(db, 'a');
    expect(() => updateWord(db, id, { headword: 'a', meanings: [['z']] })).not.toThrow();
  });

  it('refuses a headword that another word has, and changes nothing', () => {
    const db = freshDb();
    addWord(db, 'taurus');
    const id = addWord(db, 'gravis', {}, [['schwer']]);
    const error = thrown(() => updateWord(db, id, { headword: 'taurus', meanings: [['leicht']] }));
    expect((error as AppError).code).toBe('HEADWORD_EXISTS');
    expect(getWordRow(db, id)).toMatchObject({ headword: 'gravis', meanings: [['schwer']] });
  });

  it('treats headwords that differ only in case as different words', () => {
    const db = freshDb();
    addWord(db, 'taurus');
    const id = addWord(db, 'gravis');
    expect(() => updateWord(db, id, { headword: 'Taurus' })).not.toThrow();
  });

  it.each([
    ['an empty headword', { headword: '   ' }, 'INVALID_REQUEST'],
    ['nothing at all', {}, 'INVALID_REQUEST'],
    ['no meaning groups', { meanings: [] }, 'INVALID_MEANINGS'],
    ['an empty group', { meanings: [['a'], []] }, 'INVALID_MEANINGS'],
    ['five groups', { meanings: [['a'], ['b'], ['c'], ['d'], ['e']] }, 'INVALID_MEANINGS'],
    ['a padded synonym', { meanings: [[' a']] }, 'INVALID_MEANINGS'],
  ])('rejects %s', (_label, patch, code) => {
    const db = freshDb();
    const id = addWord(db, 'a', {}, [['x']]);
    const error = thrown(() => updateWord(db, id, patch));
    expect((error as AppError).code).toBe(code);
    expect(getWordRow(db, id)).toMatchObject({ headword: 'a', meanings: [['x']] });
  });

  it('reports an unknown word', () => {
    const db = freshDb();
    expect((thrown(() => updateWord(db, 999, { headword: 'x' })) as AppError).code).toBe('WORD_NOT_FOUND');
  });
});
