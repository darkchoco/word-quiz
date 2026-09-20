import { Router, type Request } from 'express';
import type { Direction, RoundMode } from '../shared/api';
import type { AppContext } from './context';
import { AppError } from './errors';
import { getCurrentRound, getPoolInfo, startRound, submitAnswer } from './services/round';
import { endActiveSession, getSessionState, listDatabaseInfos, openSession } from './services/session';
import { getSettings, putSettings } from './services/settings';
import { listWords, listWrong, patchWord, setDone } from './services/words';

const invalid = (message: string): AppError => new AppError('INVALID_REQUEST', message);

/** The JSON body as an object. Anything else (missing, a list, a number) is a bad request. */
function bodyOf(req: Request): Record<string, unknown> {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('The request body must be a JSON object.');
  }
  return body as Record<string, unknown>;
}

/** A whole number from the URL, such as a word id. */
function idParam(value: string | string[] | undefined, what: string): number {
  if (typeof value !== 'string' || !/^\d{1,15}$/.test(value)) throw invalid(`The ${what} in the URL is not a valid number.`);
  return Number(value);
}

const isPosition = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;

/** All API endpoints (TECH-SPEC 5.1). Handlers only translate between HTTP and the services. */
export function createApiRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/databases', (_req, res) => {
    res.json({ databases: listDatabaseInfos(ctx) });
  });

  router.post('/session', (req, res) => {
    const { db } = bodyOf(req);
    if (typeof db !== 'string') throw invalid('"db" must be the name of a database.');
    res.status(201).json(openSession(ctx, db));
  });

  router.get('/session', (_req, res) => {
    res.json(getSessionState(ctx));
  });

  router.delete('/session', (_req, res) => {
    endActiveSession(ctx);
    res.status(204).end();
  });

  router.get('/pool', (_req, res) => {
    res.json(getPoolInfo(ctx));
  });

  router.post('/rounds', (req, res) => {
    const { mode, direction } = bodyOf(req);
    if (mode !== 'normal' && mode !== 'retest') throw invalid('"mode" must be "normal" or "retest".');
    if (direction !== 'word_to_meaning' && direction !== 'meaning_to_word' && direction !== 'mix') {
      throw invalid('"direction" must be "word_to_meaning", "meaning_to_word" or "mix".');
    }
    res.status(201).json(startRound(ctx, { mode: mode as RoundMode, direction: direction as Direction }));
  });

  router.get('/rounds/current', (_req, res) => {
    res.json(getCurrentRound(ctx));
  });

  router.post('/rounds/:id/answers', (req, res) => {
    const roundId = idParam(req.params['id'], 'round id');
    const { position, input } = bodyOf(req);
    if (!isPosition(position)) throw invalid('"position" must be a whole number of at least 1.');
    if (typeof input !== 'string') throw invalid('"input" must be text.');
    res.json(submitAnswer(ctx, roundId, { position, input }));
  });

  router.get('/wrong', (_req, res) => {
    res.json({ words: listWrong(ctx) });
  });

  router.get('/words', (_req, res) => {
    res.json({ words: listWords(ctx) });
  });

  router.patch('/words/:id', (req, res) => {
    const id = idParam(req.params['id'], 'word id');
    const { headword, meanings } = bodyOf(req);
    res.json(patchWord(ctx, id, { headword, meanings }));
  });

  router.post('/words/:id/done', (req, res) => {
    const id = idParam(req.params['id'], 'word id');
    const { done, questionPosition } = bodyOf(req);
    if (typeof done !== 'boolean') throw invalid('"done" must be true or false.');
    if (questionPosition !== undefined && !isPosition(questionPosition)) {
      throw invalid('"questionPosition" must be a whole number of at least 1.');
    }
    res.json(setDone(ctx, id, questionPosition === undefined ? { done } : { done, questionPosition }));
  });

  router.get('/settings', (_req, res) => {
    res.json(getSettings(ctx));
  });

  router.put('/settings', (req, res) => {
    res.json(putSettings(ctx, bodyOf(req)['questionsPerRound']));
  });

  return router;
}
