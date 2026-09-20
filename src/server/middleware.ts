import express, { type ErrorRequestHandler, type Express, type Response } from 'express';
import { ERROR_STATUS, type ApiErrorBody, type ErrorCode } from '../shared/api';
import { AppError } from './errors';
import { isAllowedHost } from './hosts';

export type LogFn = (line: string) => void;

/** The JSON limit for request bodies (TECH-SPEC 9). */
export const JSON_LIMIT = '100kb';

export function sendError(res: Response, code: ErrorCode, message: string): void {
  const body: ApiErrorBody = { error: { code, message } };
  res.status(ERROR_STATUS[code]).json(body);
}

const JSON_TYPE = /^application\/json(\s*;.*)?$/i;

/**
 * Everything that must happen before a request reaches a route:
 * host check, no caching of API answers, JSON-only writes, body parsing with a size limit.
 * No CORS headers are ever sent, so a page from another site cannot use the API.
 */
export function installGuards(app: Express, getAllowedHosts: () => readonly string[]): void {
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    if (!isAllowedHost(req.headers.host, getAllowedHosts())) {
      sendError(res, 'FORBIDDEN_HOST', 'This host name is not allowed.');
      return;
    }
    next();
  });

  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // A browser can only send a cross-site request with this content type after a permission
  // check (preflight) that this server never grants. Everything else is a "simple" request that
  // could be sent by any web page, so writes must be JSON.
  app.use((req, res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && !JSON_TYPE.test(req.headers['content-type'] ?? '')) {
      sendError(res, 'UNSUPPORTED_MEDIA_TYPE', 'Send the request body as application/json.');
      return;
    }
    next();
  });

  app.use(express.json({ limit: JSON_LIMIT, strict: true }));
}

/** The last things in the chain: unknown API paths and every error. */
export function installFallbacks(app: Express, log: LogFn): void {
  app.use('/api', (_req, res) => {
    sendError(res, 'NOT_FOUND', 'There is no such API endpoint.');
  });

  app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not found\n');
  });

  const onError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof AppError) {
      sendError(res, error.code, error.message);
      return;
    }
    const type = (error as { type?: string }).type;
    const status = (error as { status?: number }).status;
    if (type === 'entity.too.large') {
      sendError(res, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
      return;
    }
    if (type === 'entity.parse.failed' || (typeof status === 'number' && status >= 400 && status < 500)) {
      sendError(res, 'INVALID_REQUEST', 'The request body is not valid JSON.');
      return;
    }
    // Anything else is a bug. The details stay in the server log; the client learns nothing about them.
    log(`Unexpected error: ${(error as Error)?.stack ?? String(error)}`);
    sendError(res, 'INTERNAL', 'Something went wrong on the server.');
  };
  app.use(onError);
}
