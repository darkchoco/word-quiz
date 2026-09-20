import express, { type Express } from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../../src/server/errors';
import { installFallbacks, installGuards } from '../../src/server/middleware';
import { rawRequest } from '../support/http';

const servers: http.Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function start(allowed: string[] = []): Promise<{ port: number; logs: string[] }> {
  const logs: string[] = [];
  const app: Express = express();
  installGuards(app, () => allowed);
  app.post('/api/echo', (req, res) => {
    res.json({ got: req.body });
  });
  app.put('/api/echo', (req, res) => {
    res.json({ got: req.body });
  });
  app.patch('/api/echo', (req, res) => {
    res.json({ got: req.body });
  });
  app.delete('/api/echo', (_req, res) => {
    res.status(204).end();
  });
  app.get('/api/app-error', () => {
    throw new AppError('DB_NOT_FOUND', 'the message');
  });
  app.get('/api/bug', () => {
    throw new Error('secret internal detail /home/user/file.ts');
  });
  app.get('/api/async-bug', async () => {
    throw new Error('secret async detail');
  });
  app.get('/hello', (_req, res) => {
    res.type('text').send('hi');
  });
  installFallbacks(app, (line) => logs.push(line));
  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { port: (server.address() as AddressInfo).port, logs };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

describe('host check', () => {
  it('lets a local host name through', async () => {
    const { port } = await start();
    const response = await rawRequest(port, { path: '/hello', headers: { Host: `localhost:${port}` } });
    expect(response.status).toBe(200);
    expect(response.text).toBe('hi');
  });

  it('refuses another host name with 403 and the standard error body', async () => {
    const { port } = await start();
    const response = await rawRequest(port, { path: '/hello', headers: { Host: 'evil.example.com' } });
    expect(response.status).toBe(403);
    expect(response.json).toEqual({ error: { code: 'FORBIDDEN_HOST', message: 'This host name is not allowed.' } });
  });

  it('checks static pages as well as the API', async () => {
    const { port } = await start();
    expect((await rawRequest(port, { path: '/hello', headers: { Host: 'evil.example.com' } })).status).toBe(403);
    expect((await rawRequest(port, { path: '/api/app-error', headers: { Host: 'evil.example.com' } })).status).toBe(403);
  });

  it('accepts a name that the user added', async () => {
    const { port } = await start(['nas.local']);
    expect((await rawRequest(port, { path: '/hello', headers: { Host: 'nas.local' } })).status).toBe(200);
    expect((await rawRequest(port, { path: '/hello', headers: { Host: 'other.local' } })).status).toBe(403);
  });
});

describe('JSON-only writes', () => {
  it.each(['POST', 'PUT', 'PATCH'])('accepts %s with application/json (and a charset)', async (method) => {
    const { port } = await start();
    for (const contentType of ['application/json', 'application/json; charset=utf-8', 'APPLICATION/JSON']) {
      const response = await rawRequest(port, { method, path: '/api/echo', headers: { 'Content-Type': contentType }, body: '{"a":1}' });
      expect(response.status, `${method} ${contentType}`).toBe(200);
      expect(response.json).toEqual({ got: { a: 1 } });
    }
  });

  it.each(['POST', 'PUT', 'PATCH'])('refuses %s with another content type (415)', async (method) => {
    const { port } = await start();
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonx']) {
      const response = await rawRequest(port, { method, path: '/api/echo', headers: { 'Content-Type': contentType }, body: '{"a":1}' });
      expect(response.status, `${method} ${contentType}`).toBe(415);
      expect(response.json).toMatchObject({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } });
    }
  });

  it('refuses a write without any content type', async () => {
    const { port } = await start();
    const response = await rawRequest(port, { method: 'POST', path: '/api/echo', body: '{"a":1}' });
    expect(response.status).toBe(415);
    const empty = await rawRequest(port, { method: 'POST', path: '/api/echo' });
    expect(empty.status).toBe(415);
  });

  it('does not ask for JSON on GET or DELETE', async () => {
    const { port } = await start();
    expect((await rawRequest(port, { path: '/hello' })).status).toBe(200);
    expect((await rawRequest(port, { method: 'DELETE', path: '/api/echo' })).status).toBe(204);
  });

  it('answers 400 for a body that is not valid JSON', async () => {
    const { port } = await start();
    const response = await rawRequest(port, { method: 'POST', path: '/api/echo', headers: JSON_HEADERS, body: '{bad' });
    expect(response.status).toBe(400);
    expect(response.json).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
  });

  it('answers 413 for a body over 100 KB and accepts one just below', async () => {
    const { port } = await start();
    const big = JSON.stringify({ text: 'x'.repeat(101 * 1024) });
    const refused = await rawRequest(port, { method: 'POST', path: '/api/echo', headers: JSON_HEADERS, body: big });
    expect(refused.status).toBe(413);
    expect(refused.json).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
    const fine = JSON.stringify({ text: 'x'.repeat(90 * 1024) });
    expect((await rawRequest(port, { method: 'POST', path: '/api/echo', headers: JSON_HEADERS, body: fine })).status).toBe(200);
  });
});

describe('answers', () => {
  it('turns an AppError into its status and code', async () => {
    const { port } = await start();
    const response = await rawRequest(port, { path: '/api/app-error' });
    expect(response.status).toBe(404);
    expect(response.json).toEqual({ error: { code: 'DB_NOT_FOUND', message: 'the message' } });
  });

  it.each(['/api/bug', '/api/async-bug'])('hides the details of an unexpected error (%s)', async (path) => {
    const { port, logs } = await start();
    const response = await rawRequest(port, { path });
    expect(response.status).toBe(500);
    expect(response.json).toEqual({ error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } });
    expect(response.text).not.toMatch(/secret|\.ts|stack|at /);
    // the details are in the log for whoever runs the server
    expect(logs.join('\n')).toMatch(/secret/);
  });

  it('answers 404 with the standard body for an unknown API path', async () => {
    const { port } = await start();
    const response = await rawRequest(port, { path: '/api/nothing-here' });
    expect(response.status).toBe(404);
    expect(response.json).toEqual({ error: { code: 'NOT_FOUND', message: 'There is no such API endpoint.' } });
  });

  it('does not cache API answers, and adds no CORS headers or server banner', async () => {
    const { port } = await start();
    const response = await rawRequest(port, { path: '/api/app-error' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(Object.keys(response.headers).filter((h) => h.startsWith('access-control-'))).toEqual([]);
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('gives no CORS permission to a preflight request', async () => {
    const { port } = await start();
    const response = await rawRequest(port, {
      method: 'OPTIONS',
      path: '/api/echo',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-methods']).toBeUndefined();
  });
});
