import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/server/db/open';
import {
  allWordsDone,
  countPool,
  countWords,
  getProgress,
  getQuestionsPerRound,
  insertWord,
  nextRoundNumber,
  pickPool,
  saveProgress,
  sessionStats,
  setQuestionsPerRound,
} from '../../src/server/db/queries';
import { startSession } from '../../src/server/db/sessions';
import { transaction } from '../../src/server/db/transaction';
import { AppError } from '../../src/server/errors';
import { addWord, recordQuestion, thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();
const freshDb = () => t.track(createDatabase(path.join(t.dir(), 'latin.db'), 'latin'));

describe('nextRoundNumber', () => {
  it('is 1 for a database without rounds and continues after the highest number', () => {
    const db = freshDb();
    expect(nextRoundNumber(db)).toBe(1);
    const session = startSession(db, 0);
    const word = addWord(db, 'a');
    recordQuestion(db, { sessionId: session, roundNumber: 1, position: 1, wordId: word, verdict: null });
    expect(nextRoundNumber(db)).toBe(2);
    recordQuestion(db, { sessionId: session, roundNumber: 7, position: 1, wordId: word, verdict: null });
    expect(nextRoundNumber(db)).toBe(8);
  });
});

describe('the pool', () => {
  it('includes words that are eligible from this round on, and excludes later ones', () => {
    const db = freshDb();
    const early = addWord(db, 'early', { nextRound: 2 });
    const exact = addWord(db, 'exact', { nextRound: 3 });
    addWord(db, 'later', { nextRound: 4 });
    const ids = pickPool(db, 3, { limit: 100 });
    expect(ids.sort()).toEqual([early, exact].sort());
    expect(countPool(db, 3)).toBe(2);
    expect(countPool(db, 2)).toBe(1);
    expect(countPool(db, 1)).toBe(0);
    expect(countPool(db, 4)).toBe(3);
  });

  it('excludes done words', () => {
    const db = freshDb();
    addWord(db, 'done', { done: true });
    const open = addWord(db, 'open');
    expect(pickPool(db, 1, { limit: 10 })).toEqual([open]);
    expect(countPool(db, 1)).toBe(1);
  });

  it('gives only wrong-marked words to a retest, with the same eligibility rules', () => {
    const db = freshDb();
    const wrong = addWord(db, 'wrong', { wrongMark: true });
    addWord(db, 'fine');
    addWord(db, 'wrong but done', { wrongMark: true, done: true });
    addWord(db, 'wrong but later', { wrongMark: true, nextRound: 5 });
    expect(pickPool(db, 2, { limit: 10, retest: true })).toEqual([wrong]);
    expect(countPool(db, 2, true)).toBe(1);
    // Without the retest filter: 'wrong' and 'fine' ('done' is out, 'later' is not eligible yet).
    expect(countPool(db, 2, false)).toBe(2);
    // From round 5 on, the wrong-marked word that was waiting joins the retest too.
    expect(countPool(db, 5, true)).toBe(2);
    expect(countPool(db, 5, false)).toBe(3);
  });

  it('respects the limit and never repeats a word', () => {
    const db = freshDb();
    transaction(db, () => {
      for (let i = 0; i < 30; i++) addWord(db, `word ${i}`);
    });
    const ten = pickPool(db, 1, { limit: 10 });
    expect(ten).toHaveLength(10);
    expect(new Set(ten).size).toBe(10);
    expect(pickPool(db, 1, { limit: 100 })).toHaveLength(30);
    expect(pickPool(db, 1, { limit: 0 })).toEqual([]);
  });

  it('picks in random order', () => {
    const db = freshDb();
    transaction(db, () => {
      for (let i = 0; i < 30; i++) addWord(db, `word ${i}`);
    });
    const draws = new Set(Array.from({ length: 20 }, () => pickPool(db, 1, { limit: 5 }).join(',')));
    expect(draws.size).toBeGreaterThan(1);
  });

  it('rejects a limit that is not a non-negative integer', () => {
    const db = freshDb();
    expect(() => pickPool(db, 1, { limit: -1 })).toThrow(RangeError);
    expect(() => pickPool(db, 1, { limit: 1.5 })).toThrow(RangeError);
  });
});

describe('allWordsDone and countWords', () => {
  it('is false for a database without words', () => {
    const db = freshDb();
    expect(allWordsDone(db)).toBe(false);
    expect(countWords(db)).toBe(0);
  });

  it('is false while any word is not done, true when all are', () => {
    const db = freshDb();
    const a = addWord(db, 'a', { done: true });
    const b = addWord(db, 'b');
    expect(countWords(db)).toBe(2);
    expect(allWordsDone(db)).toBe(false);
    saveProgress(db, b, { streak: 0, wrongMark: false, nextRound: 1, done: true });
    expect(allWordsDone(db)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('sessionStats', () => {
  it('counts answered questions of the session and only Perfect answers as correct', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const words = ['a', 'b', 'c', 'd', 'e'].map((h) => addWord(db, h));
    const verdicts = ['perfect', 'perfect', 'partial', 'wrong', null] as const;
    verdicts.forEach((verdict, i) =>
      recordQuestion(db, { sessionId: session, roundNumber: 1, position: i + 1, wordId: words[i]!, verdict }),
    );
    expect(sessionStats(db, session)).toEqual({ totalWords: 5, tested: 4, correct: 2 });
  });

  it('ignores other sessions', () => {
    const db = freshDb();
    const first = startSession(db, 0);
    const second = startSession(db, 1);
    const word = addWord(db, 'a');
    recordQuestion(db, { sessionId: first, roundNumber: 1, position: 1, wordId: word, verdict: 'perfect' });
    expect(sessionStats(db, second)).toEqual({ totalWords: 1, tested: 0, correct: 0 });
    expect(sessionStats(db, first)).toEqual({ totalWords: 1, tested: 1, correct: 1 });
  });
});

describe('questions per round', () => {
  it('starts at the default of 20', () => {
    expect(getQuestionsPerRound(freshDb())).toBe(20);
  });

  it('saves a value and keeps it', () => {
    const db = freshDb();
    expect(setQuestionsPerRound(db, 35)).toBe(35);
    expect(getQuestionsPerRound(db)).toBe(35);
    setQuestionsPerRound(db, 5);
    expect(getQuestionsPerRound(db)).toBe(5);
  });

  it('accepts the limits 1 and 200', () => {
    const db = freshDb();
    expect(setQuestionsPerRound(db, 1)).toBe(1);
    expect(setQuestionsPerRound(db, 200)).toBe(200);
  });

  it.each([0, -3, 201, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (value) => {
    const db = freshDb();
    const error = thrown(() => setQuestionsPerRound(db, value));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('INVALID_SETTING');
    expect(getQuestionsPerRound(db)).toBe(20);
  });

  it('falls back to the default if the stored value is damaged', () => {
    const db = freshDb();
    db.exec("UPDATE setting SET value = 'lots' WHERE key = 'questions_per_round'");
    expect(getQuestionsPerRound(db)).toBe(20);
    db.exec("UPDATE setting SET value = '9999' WHERE key = 'questions_per_round'");
    expect(getQuestionsPerRound(db)).toBe(20);
    db.exec("DELETE FROM setting WHERE key = 'questions_per_round'");
    expect(getQuestionsPerRound(db)).toBe(20);
  });
});

describe('insertWord', () => {
  it('stores the word with default progress and returns its id', () => {
    const db = freshDb();
    const id = insertWord(db, { headword: 'taurus', meanings: [['Stier']], note: 'Nomen' }, 4242);
    expect(getProgress(db, id)).toEqual({ streak: 0, wrongMark: false, nextRound: 1, done: false });
    expect(db.prepare('SELECT headword, meanings, note, created_at, updated_at FROM word WHERE id = ?').get(id)).toEqual({
      headword: 'taurus',
      meanings: '[["Stier"]]',
      note: 'Nomen',
      created_at: 4242,
      updated_at: 4242,
    });
  });

  it('stores a missing note as NULL', () => {
    const db = freshDb();
    const id = insertWord(db, { headword: 'a', meanings: [['x']] });
    expect(db.prepare('SELECT note FROM word WHERE id = ?').get(id)).toEqual({ note: null });
  });

  it('trims the headword and stores it in NFC', () => {
    const db = freshDb();
    const id = insertWord(db, { headword: '  capiū  ', meanings: [['x']] });
    const row = db.prepare('SELECT headword FROM word WHERE id = ?').get(id) as { headword: string };
    expect(row.headword).toBe('capiū');
  });

  it('rejects an empty headword', () => {
    const db = freshDb();
    expect((thrown(() => insertWord(db, { headword: '   ', meanings: [['x']] })) as AppError).code).toBe('INVALID_REQUEST');
  });

  it.each([
    ['no groups', []],
    ['an empty group', [['a'], []]],
    ['five groups', [['a'], ['b'], ['c'], ['d'], ['e']]],
    ['a padded synonym', [[' a']]],
  ])('rejects invalid meanings: %s', (_label, meanings) => {
    const db = freshDb();
    const error = thrown(() => insertWord(db, { headword: 'a', meanings }));
    expect((error as AppError).code).toBe('INVALID_MEANINGS');
    expect(countWords(db)).toBe(0);
  });

  it('rejects a duplicate headword without leaving an orphan progress row', () => {
    const db = freshDb();
    insertWord(db, { headword: 'a', meanings: [['x']] });
    const error = thrown(() => insertWord(db, { headword: 'a', meanings: [['y']] }));
    expect((error as AppError).code).toBe('HEADWORD_EXISTS');
    expect(countWords(db)).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM word_progress').get()).toEqual({ n: 1 });
  });

  it('works inside a transaction and is undone with it', () => {
    const db = freshDb();
    thrown(() =>
      transaction(db, () => {
        insertWord(db, { headword: 'a', meanings: [['x']] });
        throw new Error('abort');
      }),
    );
    expect(countWords(db)).toBe(0);
  });
});

describe('progress', () => {
  it('converts between the 0/1 columns and booleans', () => {
    const db = freshDb();
    const id = addWord(db, 'a');
    const progress = { streak: 3, wrongMark: true, nextRound: 9, done: true };
    saveProgress(db, id, progress);
    expect(getProgress(db, id)).toEqual(progress);
    expect(db.prepare('SELECT wrong_mark, done FROM word_progress WHERE word_id = ?').get(id)).toEqual({
      wrong_mark: 1,
      done: 1,
    });
    saveProgress(db, id, { streak: 0, wrongMark: false, nextRound: 1, done: false });
    expect(getProgress(db, id)).toEqual({ streak: 0, wrongMark: false, nextRound: 1, done: false });
  });

  it('returns undefined for an unknown word and refuses to save for one', () => {
    const db = freshDb();
    expect(getProgress(db, 999)).toBeUndefined();
    const error = thrown(() => saveProgress(db, 999, { streak: 0, wrongMark: false, nextRound: 1, done: false }));
    expect((error as AppError).code).toBe('WORD_NOT_FOUND');
  });
});
