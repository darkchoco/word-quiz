import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/server/db/open';
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
} from '../../src/server/db/rounds';
import { startSession } from '../../src/server/db/sessions';
import { AppError } from '../../src/server/errors';
import { addWord, thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();
const freshDb = () => t.track(createDatabase(path.join(t.dir(), 'latin.db'), 'latin'));

type Db = ReturnType<typeof freshDb>;
const newRound = (db: Db, sessionId: number, wordIds: number[], number: number, mode: 'normal' | 'retest' = 'normal') =>
  createRound(db, { sessionId, mode, direction: 'word_to_meaning', number, wordIds }, 1000);

describe('resolveStartRound', () => {
  it('starts at the next free number when words are due', () => {
    const db = freshDb();
    addWord(db, 'a');
    addWord(db, 'b');
    expect(resolveStartRound(db, false)).toEqual({ number: 1, available: 2 });
  });

  it('continues after the highest round number', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const a = addWord(db, 'a');
    addWord(db, 'b');
    newRound(db, session, [a], 4);
    expect(resolveStartRound(db, false)).toEqual({ number: 5, available: 2 });
  });

  it('counts only the words that are due at that number', () => {
    const db = freshDb();
    addWord(db, 'due', { nextRound: 3 });
    addWord(db, 'later', { nextRound: 4 });
    const session = startSession(db, 0);
    newRound(db, session, [1], 2);
    expect(resolveStartRound(db, false)).toEqual({ number: 3, available: 1 });
  });

  it('jumps to the earliest round in which a word is due when every word is being held back (D38)', () => {
    const db = freshDb();
    addWord(db, 'a', { nextRound: 8 });
    addWord(db, 'b', { nextRound: 9 });
    addWord(db, 'c', { nextRound: 8 });
    const session = startSession(db, 0);
    newRound(db, session, [1], 2); // the next free number is 3
    expect(resolveStartRound(db, false)).toEqual({ number: 8, available: 2 });
  });

  it('never goes backwards', () => {
    const db = freshDb();
    addWord(db, 'a', { nextRound: 2 });
    const session = startSession(db, 0);
    newRound(db, session, [1], 5);
    // the word has been due since round 2, so it is in the pool of round 6
    expect(resolveStartRound(db, false)).toEqual({ number: 6, available: 1 });
  });

  it('ignores done words: nothing left to ask means null', () => {
    const db = freshDb();
    addWord(db, 'a', { done: true, nextRound: 9 });
    addWord(db, 'b', { done: true });
    expect(resolveStartRound(db, false)).toBeNull();
  });

  it('is null for a database without words', () => {
    expect(resolveStartRound(freshDb(), false)).toBeNull();
    expect(resolveStartRound(freshDb(), true)).toBeNull();
  });

  it('for a retest, only words with a wrong mark count, and it jumps the same way', () => {
    const db = freshDb();
    addWord(db, 'wrong but waiting', { wrongMark: true, nextRound: 7 });
    addWord(db, 'fine', {});
    addWord(db, 'wrong but done', { wrongMark: true, done: true });
    // a normal round could start right away with the word that is fine (the wrong word is
    // held back until round 7, the third one is done)...
    expect(resolveStartRound(db, false)).toEqual({ number: 1, available: 1 });
    // ...but a retest has to wait for the wrong word
    expect(resolveStartRound(db, true)).toEqual({ number: 7, available: 1 });
  });

  it('for a retest without wrong marks there is nothing to ask, even if normal words exist', () => {
    const db = freshDb();
    addWord(db, 'a');
    expect(resolveStartRound(db, true)).toBeNull();
  });
});

describe('createRound', () => {
  it('fixes the questions in the given order and records the round', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const [a, b, c] = [addWord(db, 'a'), addWord(db, 'b'), addWord(db, 'c')];
    const id = newRound(db, session, [c, a, b], 3, 'retest');
    expect(getRoundRow(db, id)).toEqual({
      id,
      number: 3,
      sessionId: session,
      mode: 'retest',
      direction: 'word_to_meaning',
      total: 3,
      endedAt: null,
    });
    expect(db.prepare('SELECT position, word_id, direction FROM round_question ORDER BY position').all()).toEqual([
      { position: 1, word_id: c, direction: 'word_to_meaning' },
      { position: 2, word_id: a, direction: 'word_to_meaning' },
      { position: 3, word_id: b, direction: 'word_to_meaning' },
    ]);
  });

  it('writes nothing when a question cannot be stored (one transaction)', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const a = addWord(db, 'a');
    const error = thrown(() => newRound(db, session, [a, a], 1)); // the same word twice
    expect(error).toBeInstanceOf(AppError);
    expect(db.prepare('SELECT COUNT(*) AS n FROM round').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM round_question').get()).toEqual({ n: 0 });
  });

  it('refuses a round number that is already used', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const a = addWord(db, 'a');
    newRound(db, session, [a], 1);
    const error = thrown(() => newRound(db, session, [a], 1));
    expect((error as AppError).code).toBe('INTERNAL');
    expect(db.prepare('SELECT COUNT(*) AS n FROM round').get()).toEqual({ n: 1 });
  });
});

describe('getRoundState and answering', () => {
  it('shows the first question, then the next one after each answer, then none', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const [a, b] = [addWord(db, 'first'), addWord(db, 'second')];
    const id = newRound(db, session, [a, b], 1);

    expect(getRoundState(db, id)).toEqual({
      roundId: id,
      number: 1,
      mode: 'normal',
      direction: 'word_to_meaning',
      total: 2,
      answered: 0,
      question: { position: 1, headword: 'first', direction: 'word_to_meaning' },
    });
    expect(getNextPosition(db, id)).toBe(1);

    recordAnswer(db, { roundId: id, position: 1, input: 'x', verdict: 'perfect', hits: [true] }, 2000);
    expect(getRoundState(db, id)).toMatchObject({ answered: 1, question: { position: 2, headword: 'second' } });
    expect(getNextPosition(db, id)).toBe(2);

    recordAnswer(db, { roundId: id, position: 2, input: 'y', verdict: 'wrong', hits: [false] }, 3000);
    expect(getRoundState(db, id)).toMatchObject({ answered: 2, question: null });
    expect(getNextPosition(db, id)).toBeNull();
  });

  it('stores the answer, verdict, hits and time', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const id = newRound(db, session, [addWord(db, 'a', {}, [['x'], ['y']])], 1);
    recordAnswer(db, { roundId: id, position: 1, input: 'x, nope', verdict: 'partial', hits: [true, false] }, 4242);
    expect(db.prepare('SELECT answer_input, verdict, hits, answered_at FROM round_question').get()).toEqual({
      answer_input: 'x, nope',
      verdict: 'partial',
      hits: '[true,false]',
      answered_at: 4242,
    });
  });

  it('refuses to answer a question twice and keeps the first answer', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const id = newRound(db, session, [addWord(db, 'a')], 1);
    recordAnswer(db, { roundId: id, position: 1, input: 'first', verdict: 'perfect', hits: [true] }, 10);
    const error = thrown(() => recordAnswer(db, { roundId: id, position: 1, input: 'second', verdict: 'wrong', hits: [false] }, 20));
    expect((error as AppError).code).toBe('ALREADY_ANSWERED');
    expect(db.prepare('SELECT answer_input, verdict FROM round_question').get()).toEqual({ answer_input: 'first', verdict: 'perfect' });
  });

  it('reports an unknown round', () => {
    expect((thrown(() => getRoundState(freshDb(), 99)) as AppError).code).toBe('NO_ACTIVE_ROUND');
  });
});

describe('getQuestion', () => {
  it('returns the word, its meanings and the verdict once answered', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const id = newRound(db, session, [addWord(db, 'capere', {}, [['fassen', 'nehmen'], ['erobern']])], 1);
    expect(getQuestion(db, id, 1)).toEqual({
      wordId: 1,
      headword: 'capere',
      meanings: [['fassen', 'nehmen'], ['erobern']],
      verdict: null,
      answered: false,
    });
    recordAnswer(db, { roundId: id, position: 1, input: 'x', verdict: 'wrong', hits: [false, false] });
    expect(getQuestion(db, id, 1)).toMatchObject({ verdict: 'wrong', answered: true });
  });

  it('is undefined for a position that does not exist', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const id = newRound(db, session, [addWord(db, 'a')], 1);
    expect(getQuestion(db, id, 2)).toBeUndefined();
    expect(getQuestion(db, 999, 1)).toBeUndefined();
  });
});

describe('finishing a round', () => {
  it('sets the end time once', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const id = newRound(db, session, [addWord(db, 'a')], 1);
    finishRound(db, id, 500);
    finishRound(db, id, 900);
    expect(getRoundRow(db, id)?.endedAt).toBe(500);
  });

  it('summarizes: only Perfect counts as correct, the percentage is rounded', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const ids = [addWord(db, 'a'), addWord(db, 'b'), addWord(db, 'c')];
    const id = newRound(db, session, ids, 1);
    recordAnswer(db, { roundId: id, position: 1, input: '', verdict: 'perfect', hits: [true] });
    recordAnswer(db, { roundId: id, position: 2, input: '', verdict: 'perfect', hits: [true] });
    recordAnswer(db, { roundId: id, position: 3, input: '', verdict: 'partial', hits: [false] });
    expect(roundSummary(db, id)).toEqual({ total: 3, correct: 2, percent: 67 });
  });

  it('does not count unanswered questions as correct', () => {
    const db = freshDb();
    const session = startSession(db, 0);
    const id = newRound(db, session, [addWord(db, 'a'), addWord(db, 'b')], 1);
    recordAnswer(db, { roundId: id, position: 1, input: '', verdict: 'perfect', hits: [true] });
    expect(roundSummary(db, id)).toEqual({ total: 2, correct: 1, percent: 50 });
  });
});

describe('getOpenRoundId', () => {
  it('finds the unfinished round of this session only', () => {
    const db = freshDb();
    const mine = startSession(db, 0);
    const other = startSession(db, 1);
    const [a, b, c] = [addWord(db, 'a'), addWord(db, 'b'), addWord(db, 'c')];
    const finished = newRound(db, mine, [a], 1);
    finishRound(db, finished);
    const open = newRound(db, mine, [b], 2);
    newRound(db, other, [c], 3);
    expect(getOpenRoundId(db, mine)).toBe(open);
    expect(getOpenRoundId(db, startSession(db, 2))).toBeUndefined();
  });
});
