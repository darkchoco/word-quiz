import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach } from 'vitest';
import { createApp } from '../../src/server/app';
import { closeActive } from '../../src/server/context';
import { rawRequest, type RawResponse } from './http';
import type { useTempDir } from './tempdir';
import { ABC, makeWorld, type World, type WordSpec } from './world';

export interface TestServer extends World {
  port: number;
  publicDir: string;
  /** A request with a JSON body and a local Host header unless told otherwise. */
  call(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<RawResponse>;
}

const running: http.Server[] = [];
const worlds: World[] = [];

afterEach(async () => {
  for (const server of running.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const world of worlds.splice(0)) closeActive(world.ctx, { end: false });
});

/** An in-process server on a free port for one temporary application folder. */
export async function startTestServer(
  t: ReturnType<typeof useTempDir>,
  words: WordSpec[] = ABC,
  options: { questionsPerRound?: number; allowedHosts?: string[] } = {},
): Promise<TestServer> {
  const world = makeWorld(t, words, options);
  worlds.push(world);
  world.ctx.allowedHosts = options.allowedHosts ?? [];
  const publicDir = path.join(world.home, 'public');
  const app = createApp(world.ctx, publicDir);
  const server = http.createServer(app);
  running.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    ...world,
    port,
    publicDir,
    call: (method, requestPath, body, headers = {}) =>
      rawRequest(port, {
        method,
        path: requestPath,
        headers: {
          Host: `localhost:${port}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      }),
  };
}

/** Writes files into the folder the server serves. */
export function writePublic(server: TestServer, files: Record<string, string>): void {
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(server.publicDir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}
