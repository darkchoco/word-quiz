import { ERROR_STATUS, type ErrorCode } from '../shared/api';

/** An error that the API reports to the client with a stable code. */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

/**
 * Turns SQLite constraint failures into AppError. Matching is done on the message text on
 * purpose: `errcode` exists in recent Node versions but is not guaranteed on the minimum
 * supported one (22.13), while the messages are stable.
 * Anything that is not a recognised constraint failure is returned unchanged.
 */
export function translateSqliteError(error: unknown): unknown {
  if (error instanceof AppError || !(error instanceof Error)) return error;
  const message = error.message;
  if (/^UNIQUE constraint failed: word\.headword\b/.test(message)) {
    return new AppError('HEADWORD_EXISTS', 'A word with this headword already exists.', {
      cause: error,
    });
  }
  if (/^(UNIQUE|PRIMARY KEY) constraint failed/.test(message)) {
    return new AppError('INTERNAL', message, { cause: error });
  }
  if (/^(CHECK|NOT NULL|FOREIGN KEY) constraint failed/.test(message)) {
    return new AppError('INVALID_REQUEST', message, { cause: error });
  }
  return error;
}
