import type { Verdict } from './api';

/** Per-word learning state. The storage layer maps these fields to the word_progress columns. */
export interface Progress {
  /** Consecutive Perfect answers. */
  streak: number;
  /** Set on any non-Perfect answer, cleared only when the word is marked done. */
  wrongMark: boolean;
  /** The word is eligible again from this round number on. */
  nextRound: number;
  done: boolean;
}

/**
 * Applies one answer given in round `n` (PRD 4.3, TECH-SPEC 4.2). Never mutates its input.
 *
 * From the third consecutive Perfect on, `askDone` is true and the "No" outcome (n + 3) is
 * already applied, so answering "Yes" only needs a separate mark-done call.
 */
export function applyResult(
  p: Progress,
  verdict: Verdict,
  n: number,
): { progress: Progress; askDone: boolean } {
  if (verdict !== 'perfect') {
    return { progress: { ...p, streak: 0, wrongMark: true, nextRound: n + 1 }, askDone: false };
  }
  const streak = p.streak + 1;
  const nextRound = streak === 1 ? n + 2 : n + 3;
  return { progress: { ...p, streak, nextRound }, askDone: streak >= 3 };
}

/** Takes the word out of the pool and clears its wrong mark. */
export function markDone(p: Progress): Progress {
  return { ...p, done: true, wrongMark: false };
}

/** Puts the word back so that it can appear in the next round. */
export function unmarkDone(p: Progress, nextRoundNumber: number): Progress {
  return { ...p, done: false, streak: 0, nextRound: Math.min(p.nextRound, nextRoundNumber) };
}
