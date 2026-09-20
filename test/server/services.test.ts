import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { getProgress } from '../../src/server/db/queries';
import { AppError } from '../../src/server/errors';
import { getPoolInfo, getCurrentRound, startRound, submitAnswer, MAX_INPUT_LENGTH } from '../../src/server/services/round';
import { endActiveSession, getSessionState, listDatabaseInfos, openSession } from '../../src/server/services/session';
import { getSettings, putSettings } from '../../src/server/services/settings';
import { listWords, listWrong, patchWord, setDone } from '../../src/server/services/words';
import { thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';
import { ABC, addDatabase, answerRound, correctInput, makeWorld, progressOf, WRONG_INPUT, type World } from '../support/world';

const t = useTempDir();
const code = (fn: () => unknown) => (thrown(fn) as AppError).code;
const opened = (words = ABC, options = {}): World => {
  const world = makeWorld(t, words, options);
  openSession(world.ctx, 'latin.db');
  return world;
};
const normal = { mode: 'normal', direction: 'word_to_meaning' } as const;
const retest = { mode: 'retest', direction: 'word_to_meaning' } as const;

describe('databases and sessions', () => {
  it('lists the databases and logs scan warnings once', () => {
    const world = makeWorld(t);
    expect(listDatabaseInfos(world.ctx)).toEqual([{ name: 'latin.db', language: 'latin', wordCount: 3 }]);
    fs.writeFileSync(`${world.dataDir}/broken.db`, 'not a database');
    listDatabaseInfos(world.ctx);
    listDatabaseInfos(world.ctx);
    expect(world.logs.filter((l) => l.includes('broken.db'))).toHaveLength(1);
  });

  it('starts a session and describes it', () => {
    const world = makeWorld(t);
    const state = openSession(world.ctx, 'latin.db');
    expect(state).toEqual({
      db: 'latin.db',
      language: 'latin',
      sessionId: 1,
      startedAt: world.clock.now,
      questionsPerRound: 20,
      stats: { totalWords: 3, tested: 0, correct: 0 },
      activeRound: null,
    });
    expect(getSessionState(world.ctx)).toEqual(state);
  });

  it('has no session until one is started, and after it is ended', () => {
    const world = makeWorld(t);
    expect(code(() => getSessionState(world.ctx))).toBe('NO_SESSION');
    openSession(world.ctx, 'latin.db');
    endActiveSession(world.ctx);
    expect(code(() => getSessionState(world.ctx))).toBe('NO_SESSION');
    expect(() => endActiveSession(world.ctx)).not.toThrow();
  });

  it('refuses a bad name and a missing database without ending the running session', () => {
    const world = opened();
    expect(code(() => openSession(world.ctx, '../latin.db'))).toBe('INVALID_DB_NAME');
    expect(code(() => openSession(world.ctx, 'nope.db'))).toBe('DB_NOT_FOUND');
    expect(getSessionState(world.ctx).db).toBe('latin.db');
    expect(world.ctx.active?.db.prepare('SELECT ended_at FROM session').get()).toEqual({ ended_at: null });
  });

  it('switching databases ends the old session at the current time and starts a new one', () => {
    const world = opened();
    addDatabase(world, 'latin_2.db', [{ headword: 'X', meanings: [['x']] }]);
    const oldDb = world.ctx.active!.db;
    world.clock.now += 7000;
    const state = openSession(world.ctx, 'latin_2.db');
    expect(state.db).toBe('latin_2.db');
    expect(state.stats.totalWords).toBe(1);
    expect(() => oldDb.prepare('SELECT 1').get()).toThrow(); // closed
    // the old database has its session ended with the switch time
    const check = t.track(new DatabaseSync(world.file, { readOnly: true }));
    expect(check.prepare('SELECT ended_at FROM session').get()).toEqual({ ended_at: world.clock.now });
  });

  it('selecting the database that is already open gives a new session and a proper end time for the old one', () => {
    const world = opened();
    world.clock.now += 5000;
    const state = openSession(world.ctx, 'latin.db');
    expect(state.sessionId).toBe(2);
    const rows = world.ctx.active!.db.prepare('SELECT id, ended_at FROM session ORDER BY id').all();
    expect(rows).toEqual([{ id: 1, ended_at: world.clock.now }, { id: 2, ended_at: null }]);
  });

  it('closes sessions left open by a crash when the database is opened', () => {
    const world = makeWorld(t);
    const first = openSession(world.ctx, 'latin.db');
    // simulate a crash: the connection goes away without ending the session
    world.ctx.active!.db.close();
    world.ctx.active = null;
    world.clock.now += 60_000;
    openSession(world.ctx, 'latin.db');
    const rows = world.ctx.active!.db.prepare('SELECT id, ended_at, last_seen_at FROM session ORDER BY id').all();
    expect(rows[0]).toEqual({ id: first.sessionId, ended_at: first.startedAt, last_seen_at: first.startedAt });
    expect(rows[1]).toMatchObject({ id: 2, ended_at: null });
  });
});

describe('settings', () => {
  it('reads the default and saves a new value for the database', () => {
    const world = opened();
    expect(getSettings(world.ctx)).toEqual({ questionsPerRound: 20 });
    expect(putSettings(world.ctx, 5)).toEqual({ questionsPerRound: 5 });
    expect(getSettings(world.ctx)).toEqual({ questionsPerRound: 5 });
    expect(getSessionState(world.ctx).questionsPerRound).toBe(5);
  });

  it.each([0, 201, 1.5, -1, 'ten', null, undefined, Number.NaN])('rejects %s', (value) => {
    const world = opened();
    expect(code(() => putSettings(world.ctx, value))).toBe('INVALID_SETTING');
    expect(getSettings(world.ctx).questionsPerRound).toBe(20);
  });

  it('needs a session', () => {
    const world = makeWorld(t);
    expect(code(() => getSettings(world.ctx))).toBe('NO_SESSION');
    expect(code(() => putSettings(world.ctx, 5))).toBe('NO_SESSION');
  });
});

describe('pool info', () => {
  it('describes the next round for a fresh database', () => {
    const world = opened();
    expect(getPoolInfo(world.ctx)).toEqual({
      nextRoundNumber: 1,
      available: 3,
      retestRoundNumber: 1,
      wrongAvailable: 0,
      questionsPerRound: 20,
      allDone: false,
    });
  });

  it('shows wrong words for a retest and the skipped-ahead number when everything is being held back', () => {
    const world = opened();
    answerRound(world.ctx, startRound(world.ctx, normal), { A: 'perfect', B: 'perfect', C: 'wrong' });
    // A and B are held back until round 3, C is due in round 2
    expect(getPoolInfo(world.ctx)).toMatchObject({ nextRoundNumber: 2, available: 1, retestRoundNumber: 2, wrongAvailable: 1 });
  });

  it('says when every word is done', () => {
    const world = opened();
    for (const word of listWords(world.ctx)) setDone(world.ctx, word.id, { done: true });
    expect(getPoolInfo(world.ctx)).toMatchObject({ allDone: true, available: 0, wrongAvailable: 0 });
  });
});

describe('starting a round', () => {
  it('asks each word once, at most as many as the setting says', () => {
    const world = opened(ABC, { questionsPerRound: 2 });
    const round = startRound(world.ctx, normal);
    expect(round).toMatchObject({ number: 1, mode: 'normal', direction: 'word_to_meaning', total: 2, answered: 0 });
    expect(round.question).toMatchObject({ position: 1, direction: 'word_to_meaning' });
    const all = answerRound(world.ctx, round);
    expect(new Set(all.map((a) => a.headword)).size).toBe(2);
  });

  it('asks every word when there are fewer than the setting', () => {
    const world = opened();
    expect(startRound(world.ctx, normal).total).toBe(3);
  });

  it('refuses a second round while one is open', () => {
    const world = opened();
    startRound(world.ctx, normal);
    expect(code(() => startRound(world.ctx, normal))).toBe('ROUND_IN_PROGRESS');
    // ... and this is checked before the direction
    expect(code(() => startRound(world.ctx, { mode: 'normal', direction: 'mix' }))).toBe('ROUND_IN_PROGRESS');
  });

  it.each(['meaning_to_word', 'mix'] as const)('refuses the direction %s for Latin', (direction) => {
    const world = opened();
    expect(code(() => startRound(world.ctx, { mode: 'normal', direction }))).toBe('DIRECTION_UNSUPPORTED');
  });

  it('reports ALL_DONE when every word is done, for both kinds of round', () => {
    const world = opened();
    for (const word of listWords(world.ctx)) setDone(world.ctx, word.id, { done: true });
    expect(code(() => startRound(world.ctx, normal))).toBe('ALL_DONE');
    expect(code(() => startRound(world.ctx, retest))).toBe('ALL_DONE');
  });

  it('reports POOL_EMPTY for a database without words', () => {
    const world = opened([]);
    expect(code(() => startRound(world.ctx, normal))).toBe('POOL_EMPTY');
  });

  it('reports POOL_EMPTY for a retest when no word has a wrong mark', () => {
    const world = opened();
    expect(code(() => startRound(world.ctx, retest))).toBe('POOL_EMPTY');
  });

  it('needs a session', () => {
    expect(code(() => startRound(makeWorld(t).ctx, normal))).toBe('NO_SESSION');
  });

  it('numbers rounds from the database: they continue across sessions and an abandoned round keeps its number', () => {
    const world = opened();
    answerRound(world.ctx, startRound(world.ctx, normal)); // round 1, everything answered right
    const second = startRound(world.ctx, normal);
    expect(second.number).toBe(3); // 2 has nobody due, so the number skips ahead (PRD D38)

    openSession(world.ctx, 'latin.db'); // a new session: round 3 is abandoned unanswered
    expect(getSessionState(world.ctx).activeRound).toBeNull();
    const third = startRound(world.ctx, normal);
    expect(third.number).toBe(4); // number 3 was used up by the abandoned round
  });
});

describe('the round in progress', () => {
  it('has none before a start and none after it is finished', () => {
    const world = opened();
    expect(code(() => getCurrentRound(world.ctx))).toBe('NO_ACTIVE_ROUND');
    const round = startRound(world.ctx, normal);
    expect(getCurrentRound(world.ctx)).toEqual(round);
    answerRound(world.ctx, round);
    expect(code(() => getCurrentRound(world.ctx))).toBe('NO_ACTIVE_ROUND');
  });

  it('can be continued after a reload, from the next unanswered question', () => {
    const world = opened();
    const round = startRound(world.ctx, normal);
    const meanings = new Map(listWords(world.ctx).map((w) => [w.headword, w.meanings]));
    const first = submitAnswer(world.ctx, round.roundId, {
      position: 1,
      input: correctInput(meanings.get(round.question!.headword)!),
    });
    const reloaded = getCurrentRound(world.ctx);
    expect(reloaded).toEqual(first.round);
    expect(reloaded).toMatchObject({ answered: 1, question: { position: 2 } });
    expect(getSessionState(world.ctx).activeRound).toEqual(reloaded);
  });

  it('is abandoned when a new session starts; its number stays used', () => {
    const world = opened();
    const round = startRound(world.ctx, normal);
    openSession(world.ctx, 'latin.db');
    expect(getSessionState(world.ctx).activeRound).toBeNull();
    expect(code(() => getCurrentRound(world.ctx))).toBe('NO_ACTIVE_ROUND');
    const next = startRound(world.ctx, normal);
    expect(next.number).toBeGreaterThan(round.number);
    // the old round cannot be answered from the new session
    expect(code(() => submitAnswer(world.ctx, round.roundId, { position: 1, input: 'x' }))).toBe('NO_ACTIVE_ROUND');
  });
});

describe('submitting an answer', () => {
  it('reports a Perfect answer with the groups, the new status bar and the next question', () => {
    const world = opened();
    const round = startRound(world.ctx, normal);
    const headword = round.question!.headword;
    const meanings = listWords(world.ctx).find((w) => w.headword === headword)!.meanings;
    const result = submitAnswer(world.ctx, round.roundId, { position: 1, input: correctInput(meanings) });
    expect(result).toMatchObject({
      verdict: 'perfect',
      askDone: false,
      canMarkDone: true,
      stats: { totalWords: 3, tested: 1, correct: 1 },
      summary: null,
    });
    expect(result.groups).toEqual(meanings.map((synonyms) => ({ synonyms, hit: true })));
    expect(result.round).toMatchObject({ answered: 1, question: { position: 2 } });
  });

  it('marks the groups that were missed, and cannot mark a wrong answer done', () => {
    const world = opened([{ headword: 'C', meanings: [['gamma one', 'gamma two'], ['gamma three']] }]);
    const round = startRound(world.ctx, normal);
    const partial = submitAnswer(world.ctx, round.roundId, { position: 1, input: 'gamma two' });
    expect(partial.verdict).toBe('partial');
    expect(partial.groups).toEqual([
      { synonyms: ['gamma one', 'gamma two'], hit: true },
      { synonyms: ['gamma three'], hit: false },
    ]);
    expect(partial.canMarkDone).toBe(true);
  });

  it('reports Wrong, refuses to mark it done, and sets the wrong mark', () => {
    const world = opened();
    const round = startRound(world.ctx, normal);
    const result = submitAnswer(world.ctx, round.roundId, { position: 1, input: WRONG_INPUT });
    expect(result).toMatchObject({ verdict: 'wrong', canMarkDone: false, stats: { tested: 1, correct: 0 } });
    expect(progressOf(world.ctx, round.question!.headword)).toMatchObject({ streak: 0, wrongMark: true, nextRound: 2 });
  });

  it('finishes the round with the last answer and gives a summary', () => {
    const world = opened();
    const results = answerRound(world.ctx, startRound(world.ctx, normal), { C: 'wrong' });
    const last = results[results.length - 1]!.result;
    expect(last.round.question).toBeNull();
    expect(last.summary).toEqual({ total: 3, correct: 2, percent: 67 });
    expect(results.slice(0, -1).every((r) => r.result.summary === null)).toBe(true);
  });

  it('uses the round number for the learning schedule', () => {
    const world = opened();
    const round = startRound(world.ctx, normal);
    const headword = round.question!.headword;
    const meanings = listWords(world.ctx).find((w) => w.headword === headword)!.meanings;
    submitAnswer(world.ctx, round.roundId, { position: 1, input: correctInput(meanings) });
    expect(progressOf(world.ctx, headword)).toMatchObject({ streak: 1, nextRound: round.number + 2 });
  });

  describe('is refused', () => {
    it.each([['blank', '   '], ['empty', '']])('for a %s answer', (_label, input) => {
      const world = opened();
      const round = startRound(world.ctx, normal);
      expect(code(() => submitAnswer(world.ctx, round.roundId, { position: 1, input }))).toBe('EMPTY_INPUT');
      expect(getCurrentRound(world.ctx).answered).toBe(0);
    });

    it('for an answer that is too long, while the limit itself is fine', () => {
      const world = opened();
      const round = startRound(world.ctx, normal);
      expect(code(() => submitAnswer(world.ctx, round.roundId, { position: 1, input: 'x'.repeat(MAX_INPUT_LENGTH + 1) }))).toBe('INVALID_REQUEST');
      expect(() => submitAnswer(world.ctx, round.roundId, { position: 1, input: 'x'.repeat(MAX_INPUT_LENGTH) })).not.toThrow();
    });

    it('for a round that does not exist', () => {
      const world = opened();
      startRound(world.ctx, normal);
      expect(code(() => submitAnswer(world.ctx, 999, { position: 1, input: 'x' }))).toBe('NO_ACTIVE_ROUND');
    });

    it('for a question that is not the next one', () => {
      const world = opened();
      const round = startRound(world.ctx, normal);
      expect(code(() => submitAnswer(world.ctx, round.roundId, { position: 2, input: 'x' }))).toBe('OUT_OF_ORDER');
      expect(code(() => submitAnswer(world.ctx, round.roundId, { position: 99, input: 'x' }))).toBe('OUT_OF_ORDER');
      expect(getCurrentRound(world.ctx).answered).toBe(0);
    });

    it('for a question that was already answered', () => {
      const world = opened();
      const round = startRound(world.ctx, normal);
      submitAnswer(world.ctx, round.roundId, { position: 1, input: 'x' });
      expect(code(() => submitAnswer(world.ctx, round.roundId, { position: 1, input: 'y' }))).toBe('ALREADY_ANSWERED');
    });

    it('without a session', () => {
      expect(code(() => submitAnswer(makeWorld(t).ctx, 1, { position: 1, input: 'x' }))).toBe('NO_SESSION');
    });
  });

  it('writes nothing at all when something fails half way (one transaction)', () => {
    const world = opened();
    const round = startRound(world.ctx, normal);
    const db = world.ctx.active!.db;
    const headword = round.question!.headword;
    const wordId = (db.prepare('SELECT id FROM word WHERE headword = ?').get(headword) as { id: number }).id;
    // break the word's progress row so that the step after recording the answer fails
    db.exec(`DELETE FROM word_progress WHERE word_id = ${wordId}`);

    expect(code(() => submitAnswer(world.ctx, round.roundId, { position: 1, input: 'x' }))).toBe('WORD_NOT_FOUND');
    expect(db.prepare('SELECT COUNT(*) AS n FROM round_question WHERE answered_at IS NOT NULL').get()).toEqual({ n: 0 });
    expect(getCurrentRound(world.ctx).answered).toBe(0);
  });

  it('finishing the last question is part of the same transaction', () => {
    const world = opened([{ headword: 'A', meanings: [['alpha']] }]);
    const round = startRound(world.ctx, normal);
    const db = world.ctx.active!.db;
    db.exec('DELETE FROM word_progress');
    expect(code(() => submitAnswer(world.ctx, round.roundId, { position: 1, input: 'alpha' }))).toBe('WORD_NOT_FOUND');
    expect(db.prepare('SELECT ended_at FROM round').get()).toEqual({ ended_at: null });
  });
});

describe('marking words done', () => {
  const playOne = (world: World, verdict: 'perfect' | 'partial' | 'wrong') => {
    const round = startRound(world.ctx, normal);
    const results = answerRound(world.ctx, round, { [round.question!.headword]: verdict });
    return { round, first: results[0]!, rest: results.slice(1) };
  };

  it('accepts a word that was answered right or half right in the round just played', () => {
    for (const verdict of ['perfect', 'partial'] as const) {
      const world = opened([{ headword: 'C', meanings: [['gamma one'], ['gamma three']] }]);
      const { first } = playOne(world, verdict);
      const row = setDone(world.ctx, first.result.wordId, { done: true, questionPosition: 1 });
      expect(row).toMatchObject({ done: true, wrongMark: false });
    }
  });

  it('works after the last question, when the round is already finished', () => {
    const world = opened([{ headword: 'A', meanings: [['alpha']] }]);
    const { first } = playOne(world, 'perfect');
    expect(first.result.round.question).toBeNull();
    expect(setDone(world.ctx, first.result.wordId, { done: true, questionPosition: 1 }).done).toBe(true);
  });

  it('refuses a word that was answered wrongly, and leaves it unchanged', () => {
    const world = opened([{ headword: 'A', meanings: [['alpha']] }]);
    const { first } = playOne(world, 'wrong');
    expect(code(() => setDone(world.ctx, first.result.wordId, { done: true, questionPosition: 1 }))).toBe('MARK_DONE_NOT_ALLOWED');
    expect(progressOf(world.ctx, 'A')).toMatchObject({ done: false, wrongMark: true });
  });

  it('refuses a position that belongs to another word, is not answered yet, or does not exist', () => {
    const world = opened();
    const round = startRound(world.ctx, normal);
    const meanings = new Map(listWords(world.ctx).map((w) => [w.headword, w]));
    const firstWord = meanings.get(round.question!.headword)!;
    const other = listWords(world.ctx).find((w) => w.id !== firstWord.id)!;
    submitAnswer(world.ctx, round.roundId, { position: 1, input: correctInput(firstWord.meanings) });
    expect(code(() => setDone(world.ctx, other.id, { done: true, questionPosition: 1 }))).toBe('MARK_DONE_NOT_ALLOWED');
    expect(code(() => setDone(world.ctx, firstWord.id, { done: true, questionPosition: 2 }))).toBe('MARK_DONE_NOT_ALLOWED');
    expect(code(() => setDone(world.ctx, firstWord.id, { done: true, questionPosition: 99 }))).toBe('MARK_DONE_NOT_ALLOWED');
  });

  it('refuses a position when there was no round yet', () => {
    const world = opened();
    expect(code(() => setDone(world.ctx, 1, { done: true, questionPosition: 1 }))).toBe('MARK_DONE_NOT_ALLOWED');
  });

  it('lets the words screen mark any word without a position, and clears the wrong mark', () => {
    const world = opened();
    const { first } = playOne(world, 'wrong');
    const row = setDone(world.ctx, first.result.wordId, { done: true });
    expect(row).toMatchObject({ done: true, wrongMark: false });
  });

  it('puts a word back so that it can be asked in the very next round', () => {
    const world = opened();
    const { first } = playOne(world, 'perfect');
    const id = first.result.wordId;
    setDone(world.ctx, id, { done: true });
    const row = setDone(world.ctx, id, { done: false });
    expect(row.done).toBe(false);
    const p = progressOf(world.ctx, first.headword);
    expect(p).toMatchObject({ done: false, streak: 0 });
    expect(p.nextRound).toBeLessThanOrEqual(2);
    expect(getProgress(world.ctx.active!.db, id)?.done).toBe(false);
  });

  it('reports a word that does not exist', () => {
    const world = opened();
    expect(code(() => setDone(world.ctx, 999, { done: true }))).toBe('WORD_NOT_FOUND');
    expect(code(() => setDone(world.ctx, 999, { done: false }))).toBe('WORD_NOT_FOUND');
  });
});

describe('words', () => {
  it('lists all words and only the wrong ones that are not done', () => {
    const world = opened();
    answerRound(world.ctx, startRound(world.ctx, normal), { B: 'wrong', C: 'wrong' });
    expect(listWords(world.ctx).map((w) => w.headword)).toEqual(['A', 'B', 'C']);
    expect(listWrong(world.ctx).map((w) => w.headword)).toEqual(['B', 'C']);
    setDone(world.ctx, listWords(world.ctx)[1]!.id, { done: true });
    expect(listWrong(world.ctx).map((w) => w.headword)).toEqual(['C']);
  });

  it('changes a word, and the next answer is graded against the new meaning', () => {
    const world = opened([{ headword: 'A', meanings: [['alpha']] }]);
    const id = listWords(world.ctx)[0]!.id;
    expect(patchWord(world.ctx, id, { meanings: [['omega']] }).meanings).toEqual([['omega']]);
    const round = startRound(world.ctx, normal);
    expect(submitAnswer(world.ctx, round.roundId, { position: 1, input: 'omega' }).verdict).toBe('perfect');
  });

  it('checks the shape of the request', () => {
    const world = opened();
    const id = listWords(world.ctx)[0]!.id;
    expect(code(() => patchWord(world.ctx, id, { headword: 5 }))).toBe('INVALID_REQUEST');
    expect(code(() => patchWord(world.ctx, id, { meanings: 'text' }))).toBe('INVALID_MEANINGS');
    expect(code(() => patchWord(world.ctx, id, { meanings: [['a'], 'b'] }))).toBe('INVALID_MEANINGS');
    expect(code(() => patchWord(world.ctx, id, { meanings: [[1]] }))).toBe('INVALID_MEANINGS');
    expect(code(() => patchWord(world.ctx, id, {}))).toBe('INVALID_REQUEST');
    expect(code(() => patchWord(world.ctx, id, { headword: 'B' }))).toBe('HEADWORD_EXISTS');
    expect(code(() => patchWord(world.ctx, 999, { headword: 'Z' }))).toBe('WORD_NOT_FOUND');
  });

  it('needs a session', () => {
    const { ctx } = makeWorld(t);
    expect(code(() => listWords(ctx))).toBe('NO_SESSION');
    expect(code(() => listWrong(ctx))).toBe('NO_SESSION');
    expect(code(() => patchWord(ctx, 1, { headword: 'x' }))).toBe('NO_SESSION');
    expect(code(() => setDone(ctx, 1, { done: true }))).toBe('NO_SESSION');
  });
});
