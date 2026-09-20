import { describe, expect, it } from 'vitest';
import {
  ERROR_STATUS,
  QUESTIONS_PER_ROUND_DEFAULT,
  QUESTIONS_PER_ROUND_MAX,
  QUESTIONS_PER_ROUND_MIN,
  type ErrorCode,
} from '../../src/shared/api';

describe('ERROR_STATUS', () => {
  it('maps every code to a 4xx or 5xx status', () => {
    for (const [code, status] of Object.entries(ERROR_STATUS)) {
      expect(status, code).toBeGreaterThanOrEqual(400);
      expect(status, code).toBeLessThan(600);
    }
  });

  it('matches the statuses documented in TECH-SPEC 5.1', () => {
    const expected: Partial<Record<ErrorCode, number>> = {
      INVALID_DB_NAME: 400,
      DB_NOT_FOUND: 404,
      DB_TOO_NEW: 409,
      NO_SESSION: 404,
      ROUND_IN_PROGRESS: 409,
      POOL_EMPTY: 409,
      ALL_DONE: 409,
      DIRECTION_UNSUPPORTED: 422,
      NO_ACTIVE_ROUND: 404,
      EMPTY_INPUT: 400,
      ALREADY_ANSWERED: 409,
      OUT_OF_ORDER: 409,
      INVALID_MEANINGS: 400,
      HEADWORD_EXISTS: 409,
      WORD_NOT_FOUND: 404,
      MARK_DONE_NOT_ALLOWED: 409,
      INVALID_SETTING: 400,
    };
    for (const [code, status] of Object.entries(expected)) {
      expect(ERROR_STATUS[code as ErrorCode], code).toBe(status);
    }
  });
});

describe('settings bounds', () => {
  it('keeps the default inside the allowed range', () => {
    expect(QUESTIONS_PER_ROUND_MIN).toBe(1);
    expect(QUESTIONS_PER_ROUND_MAX).toBe(200);
    expect(QUESTIONS_PER_ROUND_DEFAULT).toBeGreaterThanOrEqual(QUESTIONS_PER_ROUND_MIN);
    expect(QUESTIONS_PER_ROUND_DEFAULT).toBeLessThanOrEqual(QUESTIONS_PER_ROUND_MAX);
  });
});
