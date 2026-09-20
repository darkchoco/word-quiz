import type {
  AnswerResult,
  ApiErrorBody,
  DatabaseInfo,
  Direction,
  ErrorCode,
  PoolInfo,
  RoundMode,
  RoundState,
  SessionState,
  WordRow,
} from '../shared/api';

/** Errors the server reports, plus two that only exist on the client side. */
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      ...(body !== undefined
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 0, 'Cannot reach the server.');
  }

  if (response.status === 204) return undefined as T;

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    // for example an HTML error page from a proxy that has nothing to talk to
    throw new ApiError('INVALID_RESPONSE', response.status, 'The server sent an answer that could not be read.');
  }

  if (!response.ok) {
    const error = (data as Partial<ApiErrorBody> | null)?.error;
    if (error && typeof error.code === 'string') {
      throw new ApiError(error.code, response.status, typeof error.message === 'string' ? error.message : '');
    }
    throw new ApiError('INVALID_RESPONSE', response.status, 'The server sent an answer that could not be read.');
  }
  return data as T;
}

/** All endpoints of TECH-SPEC 5.1 with their types. */
export const api = {
  databases: () => request<{ databases: DatabaseInfo[] }>('GET', '/databases').then((r) => r.databases),
  getSession: () => request<SessionState>('GET', '/session'),
  startSession: (db: string) => request<SessionState>('POST', '/session', { db }),
  endSession: () => request<void>('DELETE', '/session'),
  pool: () => request<PoolInfo>('GET', '/pool'),
  startRound: (mode: RoundMode, direction: Direction) => request<RoundState>('POST', '/rounds', { mode, direction }),
  currentRound: () => request<RoundState>('GET', '/rounds/current'),
  answer: (roundId: number, position: number, input: string) =>
    request<AnswerResult>('POST', `/rounds/${roundId}/answers`, { position, input }),
  wrong: () => request<{ words: WordRow[] }>('GET', '/wrong').then((r) => r.words),
  words: () => request<{ words: WordRow[] }>('GET', '/words').then((r) => r.words),
  patchWord: (id: number, patch: { headword?: string; meanings?: string[][] }) =>
    request<WordRow>('PATCH', `/words/${id}`, patch),
  setDone: (id: number, done: boolean, questionPosition?: number) =>
    request<WordRow>('POST', `/words/${id}/done`, questionPosition === undefined ? { done } : { done, questionPosition }),
  getSettings: () => request<{ questionsPerRound: number }>('GET', '/settings'),
  putSettings: (questionsPerRound: number) =>
    request<{ questionsPerRound: number }>('PUT', '/settings', { questionsPerRound }),
};
