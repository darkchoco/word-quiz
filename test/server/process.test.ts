import { spawn, type ChildProcess } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { lockPath, readLock } from '../../src/server/lock';
import { bundleServer } from '../support/bundle';
import { useTempDir } from '../support/tempdir';
import { makeWorld } from '../support/world';
import fs from 'node:fs';

// These tests start the real bundled server as a separate process and stop it with real signals.
// Windows cannot send those signals from here (and SIGTERM does not exist there).
const describeUnix = process.platform === 'win32' ? describe.skip : describe;

const t = useTempDir();
let bundle: Awaited<ReturnType<typeof bundleServer>>;
const children: ChildProcess[] = [];

beforeAll(async () => {
  bundle = await bundleServer();
}, 60_000);
afterAll(() => bundle?.cleanup());
afterEach(() => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
});

interface Started {
  child: ChildProcess;
  port: number;
  output(): string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

function launch(home: string, args: string[] = ['--port', '0', '--no-open']): Promise<Started> {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', bundle.file, ...args], {
    env: { ...process.env, WORDQUIZ_HOME: home },
  });
  children.push(child);
  let output = '';
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = /On this PC:\s+http:\/\/localhost:(\d+)/.exec(output);
      if (match) resolve({ child, port: Number(match[1]), output: () => output, exited });
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString()));
    void exited.then(() => reject(new Error(`the server exited before it was ready:\n${output}`)));
    setTimeout(() => reject(new Error(`the server did not become ready:\n${output}`)), 15_000);
  });
}

/** Runs the server until it stops on its own and returns what happened. */
async function runToEnd(home: string, args: string[]) {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', bundle.file, ...args], {
    env: { ...process.env, WORDQUIZ_HOME: home },
  });
  children.push(child);
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (c: Buffer) => (stdout += c.toString()));
  child.stderr?.on('data', (c: Buffer) => (stderr += c.toString()));
  const code = await new Promise<number | null>((resolve) => child.on('exit', (c) => resolve(c)));
  return { code, stdout, stderr };
}

const post = (port: number, path: string, body: unknown) =>
  fetch(`http://localhost:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const sessions = (file: string) => {
  const db = t.track(new DatabaseSync(file, { readOnly: true }));
  const rows = db.prepare('SELECT id, started_at, ended_at, last_seen_at FROM session ORDER BY id').all() as {
    id: number;
    started_at: number;
    ended_at: number | null;
    last_seen_at: number;
  }[];
  db.close();
  return rows;
};

describeUnix('stopping the server with a signal', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)('%s ends the session, removes the lock and exits with 0', async (signal) => {
    const world = makeWorld(t);
    const server = await launch(world.home);
    expect((await post(server.port, '/api/session', { db: 'latin.db' })).status).toBe(201);
    expect(readLock(world.home)).toMatchObject({ pid: server.child.pid, port: server.port });

    server.child.kill(signal);
    const { code } = await server.exited;

    expect(code).toBe(0);
    expect(fs.existsSync(lockPath(world.home))).toBe(false);
    const rows = sessions(world.file);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ended_at).not.toBeNull();
    expect(rows[0]!.ended_at!).toBeGreaterThanOrEqual(rows[0]!.started_at);
  }, 30_000);

  it('stops cleanly when no session was started', async () => {
    const world = makeWorld(t);
    const server = await launch(world.home);
    server.child.kill('SIGTERM');
    expect((await server.exited).code).toBe(0);
    expect(fs.existsSync(lockPath(world.home))).toBe(false);
  }, 30_000);

  it('records the end of a session that had a round in progress', async () => {
    const world = makeWorld(t);
    const server = await launch(world.home);
    await post(server.port, '/api/session', { db: 'latin.db' });
    expect((await post(server.port, '/api/rounds', { mode: 'normal', direction: 'word_to_meaning' })).status).toBe(201);
    server.child.kill('SIGTERM');
    await server.exited;
    expect(sessions(world.file)[0]!.ended_at).not.toBeNull();
  }, 30_000);
});

describeUnix('a server that was killed', () => {
  it('leaves the lock and the open session behind, and the next start repairs both', async () => {
    const world = makeWorld(t);
    const first = await launch(world.home);
    await post(first.port, '/api/session', { db: 'latin.db' });
    first.child.kill('SIGKILL');
    await first.exited;

    expect(readLock(world.home)).toMatchObject({ pid: first.child.pid }); // left behind
    expect(sessions(world.file)[0]!.ended_at).toBeNull(); // never ended

    const second = await launch(world.home);
    expect(readLock(world.home)).toMatchObject({ pid: second.child.pid, port: second.port }); // overwritten
    expect((await post(second.port, '/api/session', { db: 'latin.db' })).status).toBe(201);

    const rows = sessions(world.file);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.ended_at).toBe(rows[0]!.last_seen_at); // closed at its last sign of life
    expect(rows[1]!.ended_at).toBeNull();

    second.child.kill('SIGTERM');
    await second.exited;
    expect(sessions(world.file).every((r) => r.ended_at !== null)).toBe(true);
  }, 40_000);
});

describeUnix('a second copy of the server', () => {
  it('says the port is in use, exits with 1 and does not disturb the first one', async () => {
    const world = makeWorld(t);
    const first = await launch(world.home);
    await post(first.port, '/api/session', { db: 'latin.db' });

    const second = await runToEnd(world.home, ['--port', String(first.port), '--no-open']);
    expect(second.code).toBe(1);
    expect(second.stderr).toContain(`Port ${first.port} is already in use`);
    expect(second.stderr).toContain('may already be running');

    expect(readLock(world.home)).toMatchObject({ pid: first.child.pid }); // still the first server's lock
    expect((await fetch(`http://localhost:${first.port}/api/session`)).status).toBe(200);
    expect(sessions(world.file)).toHaveLength(1);

    first.child.kill('SIGTERM');
    await first.exited;
  }, 40_000);
});

describeUnix('the command line', () => {
  it('rejects a bad option with exit code 2 and a message', async () => {
    const world = makeWorld(t);
    const result = await runToEnd(world.home, ['--port', 'abc']);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('not a valid port');
    expect(fs.existsSync(lockPath(world.home))).toBe(false);
  });

  it('prints the usage for --help and exits with 0 without starting', async () => {
    const world = makeWorld(t);
    const result = await runToEnd(world.home, ['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('--local-only');
    expect(fs.existsSync(lockPath(world.home))).toBe(false);
  });

  it('refuses a request for another host name, like a web page from the internet would send', async () => {
    const world = makeWorld(t);
    const server = await launch(world.home);
    const response = await new Promise<number>((resolve, reject) => {
      // fetch cannot set the Host header, so use a raw request
      import('node:http').then(({ default: http }) => {
        const req = http.request({ host: '127.0.0.1', port: server.port, path: '/api/databases', headers: { Host: 'evil.example.com' } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end();
      });
    });
    expect(response).toBe(403);
    server.child.kill('SIGTERM');
    await server.exited;
  }, 30_000);
});
