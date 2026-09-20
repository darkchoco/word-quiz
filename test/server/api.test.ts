import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { AnswerResult, RoundState, SessionState, WordRow } from '../../src/shared/api';
import { correctInput } from '../support/world';
import { startTestServer, writePublic, type TestServer } from '../support/api';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();

const errorOf = (response: { json: unknown }) => (response.json as { error: { code: string; message: string } }).error;

async function withSession(words?: Parameters<typeof startTestServer>[1], options?: Parameters<typeof startTestServer>[2]): Promise<TestServer> {
  const server = await startTestServer(t, words, options);
  expect((await server.call('POST', '/api/session', { db: 'latin.db' })).status).toBe(201);
  return server;
}
const startNormal = async (s: TestServer) =>
  (await s.call('POST', '/api/rounds', { mode: 'normal', direction: 'word_to_meaning' })).json as RoundState;

describe('GET /api/databases', () => {
  it('lists the databases, without a session', async () => {
    const s = await startTestServer(t);
    const response = await s.call('GET', '/api/databases');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(response.json).toEqual({ databases: [{ name: 'latin.db', language: 'latin', wordCount: 3 }] });
  });
});

describe('/api/session', () => {
  it('POST starts a session (201) and GET describes it', async () => {
    const s = await startTestServer(t);
    const created = await s.call('POST', '/api/session', { db: 'latin.db' });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ db: 'latin.db', language: 'latin', questionsPerRound: 20, activeRound: null });
    const read = await s.call('GET', '/api/session');
    expect(read.status).toBe(200);
    expect(read.json).toEqual(created.json);
  });

  it.each([
    ['a missing name', {}, 400, 'INVALID_REQUEST'],
    ['a name that is not text', { db: 5 }, 400, 'INVALID_REQUEST'],
    ['a body that is a list', [], 400, 'INVALID_REQUEST'],
    ['a name with a path in it', { db: '../latin.db' }, 400, 'INVALID_DB_NAME'],
    ['a name with a slash', { db: 'a/b.db' }, 400, 'INVALID_DB_NAME'],
    ['a database that does not exist', { db: 'nope.db' }, 404, 'DB_NOT_FOUND'],
  ])('POST refuses %s', async (_label, body, status, code) => {
    const s = await startTestServer(t);
    const response = await s.call('POST', '/api/session', body);
    expect(response.status).toBe(status);
    expect(errorOf(response).code).toBe(code);
  });

  it('hides a database written by a newer version: it is not listed, and starting it says DB_NOT_FOUND', async () => {
    const s = await startTestServer(t);
    const db = t.track(new DatabaseSync(s.file));
    db.exec('PRAGMA user_version = 99');
    db.close();

    const list = await s.call('GET', '/api/databases');
    expect(list.json).toEqual({ databases: [] });
    expect(s.logs.join('\n')).toMatch(/latin\.db: This database uses schema version 99/);

    const response = await s.call('POST', '/api/session', { db: 'latin.db' });
    expect([response.status, errorOf(response).code]).toEqual([404, 'DB_NOT_FOUND']);
  });

  it('GET says 404 NO_SESSION before a session is started', async () => {
    const s = await startTestServer(t);
    const response = await s.call('GET', '/api/session');
    expect(response.status).toBe(404);
    expect(errorOf(response).code).toBe('NO_SESSION');
  });

  it('DELETE ends the session (204), also when there is none', async () => {
    const s = await withSession();
    expect((await s.call('DELETE', '/api/session')).status).toBe(204);
    expect((await s.call('GET', '/api/session')).status).toBe(404);
    expect((await s.call('DELETE', '/api/session')).status).toBe(204);
  });
});

describe('the endpoints that need a session', () => {
  it.each([
    ['GET', '/api/pool', undefined],
    ['POST', '/api/rounds', { mode: 'normal', direction: 'word_to_meaning' }],
    ['GET', '/api/rounds/current', undefined],
    ['POST', '/api/rounds/1/answers', { position: 1, input: 'x' }],
    ['GET', '/api/wrong', undefined],
    ['GET', '/api/words', undefined],
    ['PATCH', '/api/words/1', { headword: 'x' }],
    ['POST', '/api/words/1/done', { done: true }],
    ['GET', '/api/settings', undefined],
    ['PUT', '/api/settings', { questionsPerRound: 5 }],
  ])('%s %s says 404 NO_SESSION', async (method, path, body) => {
    const s = await startTestServer(t);
    const response = await s.call(method, path, body);
    expect(response.status).toBe(404);
    expect(errorOf(response).code).toBe('NO_SESSION');
  });
});

describe('GET /api/pool and /api/settings', () => {
  it('describes the next round', async () => {
    const s = await withSession();
    const response = await s.call('GET', '/api/pool');
    expect(response.status).toBe(200);
    expect(response.json).toEqual({
      nextRoundNumber: 1,
      available: 3,
      retestRoundNumber: 1,
      wrongAvailable: 0,
      questionsPerRound: 20,
      allDone: false,
    });
  });

  it('reads and saves the number of questions per round', async () => {
    const s = await withSession();
    expect((await s.call('GET', '/api/settings')).json).toEqual({ questionsPerRound: 20 });
    const saved = await s.call('PUT', '/api/settings', { questionsPerRound: 7 });
    expect(saved.status).toBe(200);
    expect(saved.json).toEqual({ questionsPerRound: 7 });
    expect((await s.call('GET', '/api/settings')).json).toEqual({ questionsPerRound: 7 });
  });

  it.each([{ questionsPerRound: 0 }, { questionsPerRound: 201 }, { questionsPerRound: 'ten' }, { questionsPerRound: 1.5 }, {}])(
    'PUT refuses %j with 400 INVALID_SETTING',
    async (body) => {
      const s = await withSession();
      const response = await s.call('PUT', '/api/settings', body);
      expect(response.status).toBe(400);
      expect(errorOf(response).code).toBe('INVALID_SETTING');
    },
  );
});

describe('rounds and answers', () => {
  it('runs a whole round over HTTP', async () => {
    const s = await withSession();
    const started = await s.call('POST', '/api/rounds', { mode: 'normal', direction: 'word_to_meaning' });
    expect(started.status).toBe(201);
    let round = started.json as RoundState;
    expect(round).toMatchObject({ number: 1, total: 3, answered: 0 });

    const words = ((await s.call('GET', '/api/words')).json as { words: WordRow[] }).words;
    const results: AnswerResult[] = [];
    while (round.question) {
      const word = words.find((w) => w.headword === round.question!.headword)!;
      const response = await s.call('POST', `/api/rounds/${round.roundId}/answers`, {
        position: round.question.position,
        input: correctInput(word.meanings),
      });
      expect(response.status).toBe(200);
      const result = response.json as AnswerResult;
      results.push(result);
      round = result.round;
    }
    expect(results.map((r) => r.verdict)).toEqual(['perfect', 'perfect', 'perfect']);
    expect(results[2]!.summary).toEqual({ total: 3, correct: 3, percent: 100 });
    expect(results[2]!.stats).toEqual({ totalWords: 3, tested: 3, correct: 3 });
    expect((await s.call('GET', '/api/rounds/current')).status).toBe(404);
    expect(((await s.call('GET', '/api/session')).json as SessionState).stats.correct).toBe(3);
  });

  it('GET /rounds/current continues the round after a reload', async () => {
    const s = await withSession();
    const round = await startNormal(s);
    const current = await s.call('GET', '/api/rounds/current');
    expect(current.status).toBe(200);
    expect(current.json).toEqual(round);
  });

  it('answers with the right codes when something is wrong', async () => {
    const s = await withSession();
    expect(errorOf(await s.call('GET', '/api/rounds/current')).code).toBe('NO_ACTIVE_ROUND');
    const round = await startNormal(s);
    const answers = `/api/rounds/${round.roundId}/answers`;

    const twice = await s.call('POST', '/api/rounds', { mode: 'normal', direction: 'word_to_meaning' });
    expect([twice.status, errorOf(twice).code]).toEqual([409, 'ROUND_IN_PROGRESS']);

    const blank = await s.call('POST', answers, { position: 1, input: '  ' });
    expect([blank.status, errorOf(blank).code]).toEqual([400, 'EMPTY_INPUT']);

    const skipped = await s.call('POST', answers, { position: 2, input: 'x' });
    expect([skipped.status, errorOf(skipped).code]).toEqual([409, 'OUT_OF_ORDER']);

    expect((await s.call('POST', answers, { position: 1, input: 'x' })).status).toBe(200);
    const again = await s.call('POST', answers, { position: 1, input: 'y' });
    expect([again.status, errorOf(again).code]).toEqual([409, 'ALREADY_ANSWERED']);

    const unknown = await s.call('POST', '/api/rounds/999/answers', { position: 1, input: 'x' });
    expect([unknown.status, errorOf(unknown).code]).toEqual([404, 'NO_ACTIVE_ROUND']);
  });

  it.each([
    ['a mode that does not exist', { mode: 'sometimes', direction: 'word_to_meaning' }, 400, 'INVALID_REQUEST'],
    ['a direction that does not exist', { mode: 'normal', direction: 'sideways' }, 400, 'INVALID_REQUEST'],
    ['no body fields', {}, 400, 'INVALID_REQUEST'],
    ['the direction mix for Latin', { mode: 'normal', direction: 'mix' }, 422, 'DIRECTION_UNSUPPORTED'],
    ['the direction meaning to word for Latin', { mode: 'normal', direction: 'meaning_to_word' }, 422, 'DIRECTION_UNSUPPORTED'],
    ['a retest when nothing is wrong', { mode: 'retest', direction: 'word_to_meaning' }, 409, 'POOL_EMPTY'],
  ])('POST /rounds refuses %s', async (_label, body, status, code) => {
    const s = await withSession();
    const response = await s.call('POST', '/api/rounds', body);
    expect([response.status, errorOf(response).code]).toEqual([status, code]);
  });

  it.each([
    ['a position that is not a number', { position: '1', input: 'x' }],
    ['a position of 0', { position: 0, input: 'x' }],
    ['a fractional position', { position: 1.5, input: 'x' }],
    ['an input that is not text', { position: 1, input: 5 }],
    ['a missing input', { position: 1 }],
  ])('POST /rounds/:id/answers refuses %s', async (_label, body) => {
    const s = await withSession();
    const round = await startNormal(s);
    const response = await s.call('POST', `/api/rounds/${round.roundId}/answers`, body);
    expect([response.status, errorOf(response).code]).toEqual([400, 'INVALID_REQUEST']);
  });

  it('refuses a round id that is not a number', async () => {
    const s = await withSession();
    const response = await s.call('POST', '/api/rounds/abc/answers', { position: 1, input: 'x' });
    expect([response.status, errorOf(response).code]).toEqual([400, 'INVALID_REQUEST']);
  });

  it('says 409 POOL_EMPTY for a database without words and 409 ALL_DONE when everything is done', async () => {
    const empty = await withSession([]);
    expect(errorOf(await empty.call('POST', '/api/rounds', { mode: 'normal', direction: 'word_to_meaning' })).code).toBe('POOL_EMPTY');

    const s = await withSession();
    const words = ((await s.call('GET', '/api/words')).json as { words: WordRow[] }).words;
    for (const w of words) await s.call('POST', `/api/words/${w.id}/done`, { done: true });
    const response = await s.call('POST', '/api/rounds', { mode: 'normal', direction: 'word_to_meaning' });
    expect([response.status, errorOf(response).code]).toEqual([409, 'ALL_DONE']);
    expect(((await s.call('GET', '/api/pool')).json as { allDone: boolean }).allDone).toBe(true);
  });
});

describe('words', () => {
  it('lists all words and the wrong ones', async () => {
    const s = await withSession();
    const round = await startNormal(s);
    await s.call('POST', `/api/rounds/${round.roundId}/answers`, { position: 1, input: 'xyzzy' });
    const words = (await s.call('GET', '/api/words')).json as { words: WordRow[] };
    expect(words.words).toHaveLength(3);
    const wrong = (await s.call('GET', '/api/wrong')).json as { words: WordRow[] };
    expect(wrong.words).toHaveLength(1);
    expect(wrong.words[0]).toMatchObject({ wrongMark: true, done: false });
  });

  it('PATCH changes headword and meanings', async () => {
    const s = await withSession();
    const response = await s.call('PATCH', '/api/words/1', { headword: '  Alpha  ', meanings: [['one', 'two'], ['three']] });
    expect(response.status).toBe(200);
    expect(response.json).toEqual({ id: 1, headword: 'Alpha', meanings: [['one', 'two'], ['three']], done: false, wrongMark: false });
  });

  it.each([
    ['a headword another word has', '/api/words/1', { headword: 'B' }, 409, 'HEADWORD_EXISTS'],
    ['meanings that are not valid', '/api/words/1', { meanings: [] }, 400, 'INVALID_MEANINGS'],
    ['meanings of the wrong shape', '/api/words/1', { meanings: 'text' }, 400, 'INVALID_MEANINGS'],
    ['a headword that is not text', '/api/words/1', { headword: 7 }, 400, 'INVALID_REQUEST'],
    ['nothing to change', '/api/words/1', {}, 400, 'INVALID_REQUEST'],
    ['a word that does not exist', '/api/words/999', { headword: 'zzz' }, 404, 'WORD_NOT_FOUND'],
    ['an id that is not a number', '/api/words/one', { headword: 'zzz' }, 400, 'INVALID_REQUEST'],
  ])('PATCH refuses %s', async (_label, path, body, status, code) => {
    const s = await withSession();
    const response = await s.call('PATCH', path, body);
    expect([response.status, errorOf(response).code]).toEqual([status, code]);
  });

  it('POST /done marks a word done and back', async () => {
    const s = await withSession();
    const done = await s.call('POST', '/api/words/1/done', { done: true });
    expect(done.json).toMatchObject({ id: 1, done: true, wrongMark: false });
    const back = await s.call('POST', '/api/words/1/done', { done: false });
    expect(back.json).toMatchObject({ id: 1, done: false });
  });

  it('POST /done refuses a wrong answer as the reason (409 MARK_DONE_NOT_ALLOWED)', async () => {
    const s = await withSession();
    const round = await startNormal(s);
    const wrongWord = round.question!.headword;
    await s.call('POST', `/api/rounds/${round.roundId}/answers`, { position: 1, input: 'xyzzy' });
    const words = ((await s.call('GET', '/api/words')).json as { words: WordRow[] }).words;
    const id = words.find((w) => w.headword === wrongWord)!.id;
    const response = await s.call('POST', `/api/words/${id}/done`, { done: true, questionPosition: 1 });
    expect([response.status, errorOf(response).code]).toEqual([409, 'MARK_DONE_NOT_ALLOWED']);
  });

  it.each([
    ['done that is not a boolean', '/api/words/1/done', { done: 'yes' }, 'INVALID_REQUEST', 400],
    ['a missing done', '/api/words/1/done', {}, 'INVALID_REQUEST', 400],
    ['a position that is not a number', '/api/words/1/done', { done: true, questionPosition: 'x' }, 'INVALID_REQUEST', 400],
    ['a word that does not exist', '/api/words/999/done', { done: true }, 'WORD_NOT_FOUND', 404],
  ])('POST /done refuses %s', async (_label, path, body, code, status) => {
    const s = await withSession();
    const response = await s.call('POST', path, body);
    expect([response.status, errorOf(response).code]).toEqual([status, code]);
  });
});

describe('protection', () => {
  it('refuses another host name on every path, before anything else', async () => {
    const s = await withSession();
    for (const [method, path] of [['GET', '/api/session'], ['GET', '/'], ['POST', '/api/rounds'], ['GET', '/api/databases']] as const) {
      const response = await s.call(method, path, undefined, { Host: 'evil.example.com' });
      expect([response.status, path], path).toEqual([403, path]);
    }
  });

  it('refuses a write that is not JSON, even with valid data', async () => {
    const s = await withSession();
    const response = await s.call('POST', '/api/rounds', '{"mode":"normal","direction":"word_to_meaning"}', { 'Content-Type': 'text/plain' });
    expect([response.status, errorOf(response).code]).toEqual([415, 'UNSUPPORTED_MEDIA_TYPE']);
    expect((await s.call('GET', '/api/rounds/current')).status).toBe(404); // no round was created
  });

  it('answers 400 for broken JSON and 413 for a huge body', async () => {
    const s = await withSession();
    expect((await s.call('POST', '/api/rounds', '{nope')).status).toBe(400);
    const huge = JSON.stringify({ mode: 'normal', direction: 'word_to_meaning', pad: 'x'.repeat(200_000) });
    const response = await s.call('POST', '/api/rounds', huge);
    expect([response.status, errorOf(response).code]).toEqual([413, 'PAYLOAD_TOO_LARGE']);
  });

  it('answers 404 with the standard body for an unknown API path, and never sends CORS headers', async () => {
    const s = await withSession();
    const response = await s.call('GET', '/api/nothing');
    expect([response.status, errorOf(response).code]).toEqual([404, 'NOT_FOUND']);
    expect(Object.keys(response.headers).some((h) => h.startsWith('access-control-'))).toBe(false);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('hides the details of an unexpected failure', async () => {
    const s = await withSession();
    s.ctx.active!.db.close(); // makes the next database call fail with an internal error
    const response = await s.call('GET', '/api/words');
    expect([response.status, errorOf(response).code]).toEqual([500, 'INTERNAL']);
    expect(response.text).not.toMatch(/node:|\.ts|sqlite|not open/i);
    expect(s.logs.join('\n')).toMatch(/Unexpected error/);
    s.ctx.active = null;
  });

  it.skipIf(process.platform === 'win32')('reports DB_NOT_FOUND on every request after the file was removed', async () => {
    const s = await withSession();
    fs.rmSync(s.file);
    const response = await s.call('GET', '/api/words');
    expect([response.status, errorOf(response).code]).toEqual([404, 'DB_NOT_FOUND']);
    expect(errorOf(await s.call('GET', '/api/session')).code).toBe('NO_SESSION');
  });

  it('accepts a host name that the user allowed', async () => {
    const s = await startTestServer(t, undefined, { allowedHosts: ['nas.local'] });
    expect((await s.call('GET', '/api/databases', undefined, { Host: 'nas.local:35000' })).status).toBe(200);
    expect((await s.call('GET', '/api/databases', undefined, { Host: 'other.local' })).status).toBe(403);
  });
});

describe('the web app files', () => {
  it('serves index.html at the root and other files by name', async () => {
    const s = await startTestServer(t);
    writePublic(s, { 'index.html': '<!doctype html><title>Word Quiz</title>', 'assets/app.js': 'console.log(1)', 'assets/app.css': 'body{}' });
    const root = await s.call('GET', '/');
    expect([root.status, root.text]).toEqual([200, '<!doctype html><title>Word Quiz</title>']);
    expect(root.headers['content-type']).toMatch(/text\/html/);
    const script = await s.call('GET', '/assets/app.js');
    expect([script.status, script.text]).toEqual([200, 'console.log(1)']);
    expect((await s.call('GET', '/assets/app.css')).headers['content-type']).toMatch(/text\/css/);
  });

  it('says that the files are missing when there is no index.html', async () => {
    const s = await startTestServer(t);
    const root = await s.call('GET', '/');
    expect(root.status).toBe(200);
    expect(root.text).toMatch(/Word Quiz is running/);
  });

  it('answers 404 for a file that does not exist and never shows hidden files', async () => {
    const s = await startTestServer(t);
    writePublic(s, { 'index.html': 'x', '.secret': 'hidden' });
    expect((await s.call('GET', '/missing.js')).status).toBe(404);
    expect((await s.call('GET', '/.secret')).status).toBe(404);
  });

  it('cannot be tricked into leaving the folder', async () => {
    const s = await startTestServer(t);
    writePublic(s, { 'index.html': 'x' });
    fs.writeFileSync(`${s.home}/outside.txt`, 'private');
    for (const path of ['/../outside.txt', '/%2e%2e/outside.txt', '/..%2foutside.txt', '/assets/../../outside.txt']) {
      const response = await s.call('GET', path);
      expect(response.text, path).not.toContain('private');
    }
  });
});
