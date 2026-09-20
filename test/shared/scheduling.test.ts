import { describe, expect, it } from 'vitest';
import { applyResult, markDone, unmarkDone, type Progress } from '../../src/shared/scheduling';

const fresh: Progress = { streak: 0, wrongMark: false, nextRound: 1, done: false };

describe('applyResult: TECH-SPEC 4.2 table', () => {
  it('wrong answer: streak 0, wrong mark, next round n + 1', () => {
    const start: Progress = { streak: 2, wrongMark: false, nextRound: 5, done: false };
    const { progress, askDone } = applyResult(start, 'wrong', 5);
    expect(progress).toEqual({ streak: 0, wrongMark: true, nextRound: 6, done: false });
    expect(askDone).toBe(false);
  });

  it('partial answer is treated like a wrong answer', () => {
    const start: Progress = { streak: 1, wrongMark: false, nextRound: 5, done: false };
    const { progress, askDone } = applyResult(start, 'partial', 5);
    expect(progress).toEqual({ streak: 0, wrongMark: true, nextRound: 6, done: false });
    expect(askDone).toBe(false);
  });

  it('first Perfect: streak 1, skips n + 1, eligible from n + 2', () => {
    const { progress, askDone } = applyResult(fresh, 'perfect', 5);
    expect(progress).toEqual({ streak: 1, wrongMark: false, nextRound: 7, done: false });
    expect(askDone).toBe(false);
  });

  it('second Perfect: streak 2, eligible from n + 3', () => {
    const { progress, askDone } = applyResult({ ...fresh, streak: 1 }, 'perfect', 5);
    expect(progress).toEqual({ streak: 2, wrongMark: false, nextRound: 8, done: false });
    expect(askDone).toBe(false);
  });

  it('third Perfect: asks about done and already applies the "No" outcome (n + 3)', () => {
    const { progress, askDone } = applyResult({ ...fresh, streak: 2 }, 'perfect', 5);
    expect(progress).toEqual({ streak: 3, wrongMark: false, nextRound: 8, done: false });
    expect(askDone).toBe(true);
  });

  it('fourth and later Perfect ask every time', () => {
    for (const streak of [3, 4, 9]) {
      const { progress, askDone } = applyResult({ ...fresh, streak }, 'perfect', 10);
      expect(progress.streak).toBe(streak + 1);
      expect(progress.nextRound).toBe(13);
      expect(askDone).toBe(true);
    }
  });
});

describe('applyResult: sequences', () => {
  it('follows N+2, N+3, N+3 across rounds', () => {
    let p = fresh;
    let result = applyResult(p, 'perfect', 1);
    expect(result.progress.nextRound).toBe(3);
    p = result.progress;

    result = applyResult(p, 'perfect', 3);
    expect(result.progress.nextRound).toBe(6);
    p = result.progress;

    result = applyResult(p, 'perfect', 6);
    expect(result.progress.nextRound).toBe(9);
    expect(result.askDone).toBe(true);
    p = result.progress;

    result = applyResult(p, 'perfect', 9);
    expect(result.progress.nextRound).toBe(12);
    expect(result.askDone).toBe(true);
  });

  it('starts over after a wrong answer', () => {
    let p = applyResult(applyResult(fresh, 'perfect', 1).progress, 'perfect', 3).progress;
    expect(p.streak).toBe(2);
    p = applyResult(p, 'wrong', 6).progress;
    expect(p).toMatchObject({ streak: 0, wrongMark: true, nextRound: 7 });
    const again = applyResult(p, 'perfect', 7);
    expect(again.progress).toMatchObject({ streak: 1, nextRound: 9 });
    expect(again.askDone).toBe(false);
  });
});

describe('applyResult: other fields', () => {
  it('keeps the wrong mark after a Perfect answer (it is cleared only by marking done)', () => {
    const marked: Progress = { streak: 0, wrongMark: true, nextRound: 4, done: false };
    expect(applyResult(marked, 'perfect', 4).progress.wrongMark).toBe(true);
  });

  it('does not change the done flag', () => {
    const done: Progress = { streak: 0, wrongMark: false, nextRound: 1, done: true };
    expect(applyResult(done, 'perfect', 3).progress.done).toBe(true);
    expect(applyResult(done, 'wrong', 3).progress.done).toBe(true);
  });

  it('never mutates its input', () => {
    const frozen = Object.freeze({ streak: 2, wrongMark: false, nextRound: 5, done: false });
    expect(() => applyResult(frozen, 'perfect', 5)).not.toThrow();
    expect(() => applyResult(frozen, 'wrong', 5)).not.toThrow();
    expect(frozen).toEqual({ streak: 2, wrongMark: false, nextRound: 5, done: false });
  });
});

describe('markDone', () => {
  it('sets done and clears the wrong mark, keeping the rest', () => {
    const p: Progress = { streak: 3, wrongMark: true, nextRound: 9, done: false };
    expect(markDone(p)).toEqual({ streak: 3, wrongMark: false, nextRound: 9, done: true });
  });

  it('does not mutate its input', () => {
    const frozen = Object.freeze({ streak: 3, wrongMark: true, nextRound: 9, done: false });
    expect(() => markDone(frozen)).not.toThrow();
  });
});

describe('unmarkDone', () => {
  it('clears done and the streak and lowers a later next round to the upcoming round', () => {
    const p: Progress = { streak: 3, wrongMark: false, nextRound: 20, done: true };
    expect(unmarkDone(p, 12)).toEqual({ streak: 0, wrongMark: false, nextRound: 12, done: false });
  });

  it('keeps a next round that is already earlier', () => {
    const p: Progress = { streak: 1, wrongMark: false, nextRound: 4, done: true };
    expect(unmarkDone(p, 12).nextRound).toBe(4);
  });

  it('leaves the wrong mark untouched', () => {
    const p: Progress = { streak: 0, wrongMark: true, nextRound: 4, done: true };
    expect(unmarkDone(p, 12).wrongMark).toBe(true);
  });

  it('does not mutate its input', () => {
    const frozen = Object.freeze({ streak: 3, wrongMark: false, nextRound: 20, done: true });
    expect(() => unmarkDone(frozen, 12)).not.toThrow();
  });
});
