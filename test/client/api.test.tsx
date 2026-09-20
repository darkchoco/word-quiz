import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../src/client/api';
import { errorReply, fakeFetch } from './fake-fetch';

afterEach(() => vi.unstubAllGlobals());

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected a failure');
}

describe('requests', () => {
  it.each([
    ['databases', () => api.databases(), 'GET', '/api/databases', undefined, { databases: [] }],
    ['getSession', () => api.getSession(), 'GET', '/api/session', undefined, {}],
    ['startSession', () => api.startSession('latin.db'), 'POST', '/api/session', { db: 'latin.db' }, {}],
    ['pool', () => api.pool(), 'GET', '/api/pool', undefined, {}],
    ['startRound', () => api.startRound('retest', 'word_to_meaning'), 'POST', '/api/rounds', { mode: 'retest', direction: 'word_to_meaning' }, {}],
    ['currentRound', () => api.currentRound(), 'GET', '/api/rounds/current', undefined, {}],
    ['answer', () => api.answer(7, 3, 'nehmen, erobern'), 'POST', '/api/rounds/7/answers', { position: 3, input: 'nehmen, erobern' }, {}],
    ['wrong', () => api.wrong(), 'GET', '/api/wrong', undefined, { words: [] }],
    ['words', () => api.words(), 'GET', '/api/words', undefined, { words: [] }],
    ['patchWord', () => api.patchWord(5, { headword: 'x', meanings: [['y']] }), 'PATCH', '/api/words/5', { headword: 'x', meanings: [['y']] }, {}],
    ['setDone', () => api.setDone(5, true), 'POST', '/api/words/5/done', { done: true }, {}],
    ['setDone with a position', () => api.setDone(5, true, 2), 'POST', '/api/words/5/done', { done: true, questionPosition: 2 }, {}],
    ['getSettings', () => api.getSettings(), 'GET', '/api/settings', undefined, {}],
    ['putSettings', () => api.putSettings(30), 'PUT', '/api/settings', { questionsPerRound: 30 }, {}],
  ])('%s sends the right request', async (_name, call, method, path, body, reply) => {
    const { calls } = fakeFetch({ [`${method} ${path}`]: { body: reply } });
    await call();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method, path, body });
  });

  it('sends JSON content type only when there is a body', async () => {
    const { calls } = fakeFetch({ 'GET /api/session': { body: {} }, 'POST /api/session': { body: {} } });
    await api.getSession();
    await api.startSession('latin.db');
    expect(calls[0]!.headers['Content-Type']).toBeUndefined();
    expect(calls[1]!.headers['Content-Type']).toBe('application/json');
  });
});

describe('answers', () => {
  it('returns the parsed body, and unwraps the lists', async () => {
    fakeFetch({
      'GET /api/databases': { body: { databases: [{ name: 'latin.db', language: 'latin', wordCount: 178 }] } },
      'GET /api/words': { body: { words: [{ id: 1, headword: 'a', meanings: [['b']], done: false, wrongMark: false }] } },
      'GET /api/session': { body: { db: 'latin.db' } },
    });
    expect(await api.databases()).toEqual([{ name: 'latin.db', language: 'latin', wordCount: 178 }]);
    expect((await api.words())[0]?.headword).toBe('a');
    expect(await api.getSession()).toEqual({ db: 'latin.db' });
  });

  it('treats 204 as no content', async () => {
    fakeFetch({ 'DELETE /api/session': { status: 204 } });
    await expect(api.endSession()).resolves.toBeUndefined();
  });
});

describe('errors', () => {
  it('turns the error body of the server into an ApiError with code, status and message', async () => {
    fakeFetch({ 'GET /api/session': errorReply(404, 'NO_SESSION', 'No database is selected.') });
    const error = await failure(api.getSession());
    expect([error.code, error.status, error.message]).toEqual(['NO_SESSION', 404, 'No database is selected.']);
  });

  it('keeps the code of a conflict', async () => {
    fakeFetch({ 'POST /api/rounds': errorReply(409, 'POOL_EMPTY') });
    expect((await failure(api.startRound('normal', 'word_to_meaning'))).code).toBe('POOL_EMPTY');
  });

  it('reports a server that cannot be reached as NETWORK_ERROR', async () => {
    fakeFetch({ 'GET /api/session': new TypeError('Failed to fetch') });
    const error = await failure(api.getSession());
    expect([error.code, error.status]).toEqual(['NETWORK_ERROR', 0]);
  });

  it('reports an answer that is not JSON (a proxy error page) as INVALID_RESPONSE', async () => {
    fakeFetch({ 'GET /api/session': { status: 502, raw: '<html>Bad gateway</html>' } });
    const error = await failure(api.getSession());
    expect([error.code, error.status]).toEqual(['INVALID_RESPONSE', 502]);
  });

  it('reports an error status without the usual error body as INVALID_RESPONSE', async () => {
    fakeFetch({ 'GET /api/session': { status: 500, body: { something: 'else' } } });
    expect((await failure(api.getSession())).code).toBe('INVALID_RESPONSE');
  });

  it('is an Error, so it can be thrown and caught like one', () => {
    const error = new ApiError('NO_SESSION', 404, 'x');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
  });
});
