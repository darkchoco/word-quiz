import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/server/errors';
import { getPoolInfo, startRound } from '../../src/server/services/round';
import { getSessionState, openSession } from '../../src/server/services/session';
import { listWords, listWrong, setDone } from '../../src/server/services/words';
import { thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';
import { ABC, answerRound, headwordsOf, makeWorld, progressOf, setProgress, type World } from '../support/world';

const t = useTempDir();
const normal = { mode: 'normal', direction: 'word_to_meaning' } as const;
const retest = { mode: 'retest', direction: 'word_to_meaning' } as const;

function opened(words = ABC): World {
  const world = makeWorld(t, words);
  openSession(world.ctx, 'latin.db');
  return world;
}
const sorted = (list: string[]) => [...list].sort();
/** The one result of a round that had exactly one question. */
const single = (results: ReturnType<typeof answerRound>) => {
  expect(results).toHaveLength(1);
  return results[0]!.result;
};
const idOf = (world: World, headword: string) => listWords(world.ctx).find((w) => w.headword === headword)!.id;

describe('the schedule of a word over several rounds (PRD 4.3)', () => {
  it('a wrong answer comes back in the very next round; a Perfect one waits (N+1 excluded, N+2 due)', () => {
    const world = opened();
    // round 1: A right, B and C wrong
    const r1 = startRound(world.ctx, normal);
    expect(r1.number).toBe(1);
    answerRound(world.ctx, r1, { A: 'perfect', B: 'wrong', C: 'wrong' });
    expect(progressOf(world.ctx, 'A')).toMatchObject({ streak: 1, nextRound: 3 });
    expect(progressOf(world.ctx, 'B')).toMatchObject({ streak: 0, wrongMark: true, nextRound: 2 });

    // round 2: B and C are asked again, A is held back
    const r2 = startRound(world.ctx, normal);
    expect(r2.number).toBe(2);
    expect(sorted(headwordsOf(world.ctx, r2.roundId))).toEqual(['B', 'C']);
    answerRound(world.ctx, r2, { B: 'perfect', C: 'perfect' });

    // round 3: A is due again (N+2)
    const r3 = startRound(world.ctx, normal);
    expect(r3.number).toBe(3);
    expect(headwordsOf(world.ctx, r3.roundId)).toContain('A');
  });

  it('a second Perfect waits three rounds, the third asks about "done" and already waits three (T7)', () => {
    const world = opened();
    // only A takes part: B and C are done
    setDone(world.ctx, idOf(world, 'B'), { done: true });
    setDone(world.ctx, idOf(world, 'C'), { done: true });

    // A has been right twice already, in rounds we skip
    setProgress(world.ctx, 'A', { streak: 2, nextRound: 1 });
    const round = startRound(world.ctx, normal);
    const result = single(answerRound(world.ctx, round));

    expect(result.verdict).toBe('perfect');
    expect(result.askDone).toBe(true);
    expect(progressOf(world.ctx, 'A')).toMatchObject({ streak: 3, nextRound: round.number + 3, done: false });

    // answering "No" (doing nothing) leaves the schedule as it is: A is not in the next rounds
    const next = startRound(world.ctx, normal);
    expect(next.number).toBe(round.number + 3); // skipped ahead to when A is due (D38)
  });

  it('answering "Yes" marks the word done and it never comes back', () => {
    const world = opened();
    setDone(world.ctx, idOf(world, 'B'), { done: true });
    setDone(world.ctx, idOf(world, 'C'), { done: true });
    setProgress(world.ctx, 'A', { streak: 2, nextRound: 1 });
    const round = startRound(world.ctx, normal);
    const result = single(answerRound(world.ctx, round));
    expect(result.askDone).toBe(true);

    const row = setDone(world.ctx, result.wordId, { done: true, questionPosition: 1 });
    expect(row.done).toBe(true);
    expect((thrown(() => startRound(world.ctx, normal)) as AppError).code).toBe('ALL_DONE');
  });

  it('keeps asking every time from the third Perfect on', () => {
    const world = opened([{ headword: 'A', meanings: [['alpha']] }]);
    setProgress(world.ctx, 'A', { streak: 3, nextRound: 1 });
    const result = single(answerRound(world.ctx, startRound(world.ctx, normal)));
    expect(result.askDone).toBe(true);
    expect(progressOf(world.ctx, 'A').streak).toBe(4);
  });

  it('a wrong answer resets the streak, so the next Perfect starts over at N+2', () => {
    const world = opened([{ headword: 'A', meanings: [['alpha']] }]);
    setProgress(world.ctx, 'A', { streak: 2, nextRound: 1 });
    const r1 = startRound(world.ctx, normal);
    answerRound(world.ctx, r1, { A: 'wrong' });
    expect(progressOf(world.ctx, 'A')).toMatchObject({ streak: 0, wrongMark: true, nextRound: r1.number + 1 });

    const r2 = startRound(world.ctx, normal);
    expect(r2.number).toBe(r1.number + 1);
    answerRound(world.ctx, r2, { A: 'perfect' });
    expect(progressOf(world.ctx, 'A')).toMatchObject({ streak: 1, nextRound: r2.number + 2 });
  });
});

describe('the status bar', () => {
  it('counts a half-right answer as tested but not as correct, and marks the word wrong', () => {
    const world = opened([{ headword: 'C', meanings: [['gamma one'], ['gamma three']] }]);
    const round = startRound(world.ctx, normal);
    const result = single(answerRound(world.ctx, round, { C: 'partial' }));
    expect(result.verdict).toBe('partial');
    expect(result.stats).toEqual({ totalWords: 1, tested: 1, correct: 0 });
    expect(progressOf(world.ctx, 'C')).toMatchObject({ wrongMark: true, nextRound: round.number + 1 });
    expect(listWrong(world.ctx).map((w) => w.headword)).toEqual(['C']);
  });

  it('adds up over several rounds of the same session, and starts again from zero in a new session', () => {
    const world = opened();
    answerRound(world.ctx, startRound(world.ctx, normal), { A: 'perfect', B: 'perfect', C: 'wrong' }); // 3 tested, 2 correct
    // round 2: only C is due again (A and B wait until round 3); it is answered right
    const second = startRound(world.ctx, normal);
    expect(headwordsOf(world.ctx, second.roundId)).toEqual(['C']);
    answerRound(world.ctx, second);
    expect(getSessionState(world.ctx).stats).toEqual({ totalWords: 3, tested: 4, correct: 3 });

    const fresh = openSession(world.ctx, 'latin.db');
    expect(fresh.stats).toEqual({ totalWords: 3, tested: 0, correct: 0 });
  });
});

describe('retesting wrong words (PRD 3.4, 4.4)', () => {
  it('asks only the words with a wrong mark that are not done, and they leave the list when done', () => {
    const world = opened();
    answerRound(world.ctx, startRound(world.ctx, normal), { A: 'perfect', B: 'wrong', C: 'wrong' });
    expect(listWrong(world.ctx).map((w) => w.headword)).toEqual(['B', 'C']);

    const round = startRound(world.ctx, retest);
    expect(round.mode).toBe('retest');
    expect(sorted(headwordsOf(world.ctx, round.roundId))).toEqual(['B', 'C']);
    // B is answered right in the retest: the wrong mark stays until the word is marked done
    answerRound(world.ctx, round, { B: 'perfect', C: 'wrong' });
    expect(listWrong(world.ctx).map((w) => w.headword)).toEqual(['B', 'C']);

    setDone(world.ctx, idOf(world, 'B'), { done: true });
    expect(listWrong(world.ctx).map((w) => w.headword)).toEqual(['C']);
    const again = startRound(world.ctx, retest);
    expect(headwordsOf(world.ctx, again.roundId)).toEqual(['C']);
  });

  it('has nothing to retest once every wrong word is done', () => {
    const world = opened();
    answerRound(world.ctx, startRound(world.ctx, normal), { A: 'perfect', B: 'wrong', C: 'perfect' });
    setDone(world.ctx, idOf(world, 'B'), { done: true });
    expect((thrown(() => startRound(world.ctx, retest)) as AppError).code).toBe('POOL_EMPTY');
  });

  it('a retest uses the same schedule and consumes a round number', () => {
    const world = opened();
    const r1 = startRound(world.ctx, normal);
    answerRound(world.ctx, r1, { A: 'perfect', B: 'wrong', C: 'perfect' });
    const r2 = startRound(world.ctx, retest);
    expect(r2.number).toBe(r1.number + 1);
    answerRound(world.ctx, r2, { B: 'perfect' });
    expect(progressOf(world.ctx, 'B')).toMatchObject({ streak: 1, nextRound: r2.number + 2, wrongMark: true });
  });
});

describe('never getting stuck when every word is being held back (PRD D38)', () => {
  it('starts the next round by skipping the empty round numbers', () => {
    const world = opened();
    const r1 = startRound(world.ctx, normal);
    answerRound(world.ctx, r1); // all three answered right: every word waits until round 3

    // round 2 would be empty. Without the skip this would say "nothing to ask" forever.
    const info = getPoolInfo(world.ctx);
    expect(info).toMatchObject({ nextRoundNumber: 3, available: 3, allDone: false });

    const r2 = startRound(world.ctx, normal);
    expect(r2.number).toBe(3);
    expect(r2.total).toBe(3);
  });

  it('works for a tiny database from the very first round', () => {
    const world = opened([{ headword: 'A', meanings: [['alpha']] }]);
    for (let i = 0; i < 6; i++) {
      const round = startRound(world.ctx, normal);
      answerRound(world.ctx, round);
      if (progressOf(world.ctx, 'A').streak >= 3) break;
    }
    expect(progressOf(world.ctx, 'A').streak).toBe(3);
  });

  it('does not skip when there is nothing left to ask, and says so', () => {
    const world = opened();
    for (const word of listWords(world.ctx)) setDone(world.ctx, word.id, { done: true });
    expect((thrown(() => startRound(world.ctx, normal)) as AppError).code).toBe('ALL_DONE');
  });

  it('a retest can wait for wrong words that are held back', () => {
    const world = opened();
    setProgress(world.ctx, 'B', { wrongMark: true, nextRound: 9 });
    const info = getPoolInfo(world.ctx);
    expect(info).toMatchObject({ retestRoundNumber: 9, wrongAvailable: 1 });
    const round = startRound(world.ctx, retest);
    expect(round.number).toBe(9);
    expect(headwordsOf(world.ctx, round.roundId)).toEqual(['B']);
  });

  it('keeps round numbers increasing after a jump', () => {
    const world = opened();
    answerRound(world.ctx, startRound(world.ctx, normal));
    const jumped = startRound(world.ctx, normal);
    expect(jumped.number).toBe(3);
    answerRound(world.ctx, jumped);
    expect(startRound(world.ctx, normal).number).toBeGreaterThan(3);
  });
});

describe('putting a word back into the pool', () => {
  it('a word that is marked undone appears in the very next round', () => {
    const world = opened();
    const r1 = startRound(world.ctx, normal);
    answerRound(world.ctx, r1);
    const id = idOf(world, 'A');
    setDone(world.ctx, id, { done: true });
    setDone(world.ctx, id, { done: false });
    const next = startRound(world.ctx, normal);
    expect(headwordsOf(world.ctx, next.roundId)).toContain('A');
  });
});
