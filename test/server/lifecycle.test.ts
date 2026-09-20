import fs from 'node:fs';
import http from 'node:http';
import type os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { readLock } from '../../src/server/lock';
import { PortInUseError, startServer, type RunningServer } from '../../src/server/start';
import { rawRequest } from '../support/http';
import { useTempDir } from '../support/tempdir';
import { makeWorld } from '../support/world';
import { afterEach } from 'vitest';

const t = useTempDir();
const started: RunningServer[] = [];
afterEach(async () => {
  for (const server of started.splice(0)) await server.shutdown();
});

async function start(overrides: Partial<Parameters<typeof startServer>[0]> = {}) {
  const world = makeWorld(t);
  const logs: string[] = [];
  const opened: string[] = [];
  const server = await startServer({
    home: world.home,
    port: 0,
    localOnly: false,
    allowedHosts: [],
    log: (line) => logs.push(line),
    openBrowser: (url) => opened.push(url),
    interfaces: {},
    ...overrides,
  });
  started.push(server);
  return { world, server, logs, opened };
}

const get = (port: number, path = '/api/databases') => rawRequest(port, { path, headers: { Host: `localhost:${port}` } });

describe('startServer', () => {
  it('listens, writes the lock, prints where to connect and opens the browser once', async () => {
    const { world, server, logs, opened } = await start();
    expect(server.port).toBeGreaterThan(0);
    expect(server.url).toBe(`http://localhost:${server.port}`);
    expect((await get(server.port)).status).toBe(200);
    expect(readLock(world.home)).toMatchObject({ pid: process.pid, port: server.port });
    expect(logs[0]).toBe('Word Quiz is running.');
    expect(logs.join('\n')).toContain(`On this PC:  http://localhost:${server.port}`);
    expect(opened).toEqual([server.url]);
  });

  it('shows the address for a phone unless the server is local only', async () => {
    const interfaces = { wifi: [{ address: '192.168.0.5', family: 'IPv4', internal: false }] } as unknown as ReturnType<typeof os.networkInterfaces>;
    const open = await start({ interfaces });
    expect(open.logs.join('\n')).toContain(`From a phone on the same network:  http://192.168.0.5:${open.server.port}`);
    const local = await start({ interfaces, localOnly: true });
    expect(local.logs.join('\n')).not.toContain('192.168.0.5');
  });

  it('listens on all interfaces, or on 127.0.0.1 only when asked', async () => {
    expect((await start()).server.host).toBe('0.0.0.0');
    const local = await start({ localOnly: true });
    expect(local.server.host).toBe('127.0.0.1');
    expect((await get(local.server.port)).status).toBe(200);
  });

  it('does not open the browser when told not to', async () => {
    const { opened } = await start({ open: false });
    expect(opened).toEqual([]);
  });

  it('uses the allowed host names it was given', async () => {
    const { server } = await start({ allowedHosts: ['nas.local'] });
    const ok = await rawRequest(server.port, { path: '/api/databases', headers: { Host: 'nas.local' } });
    expect(ok.status).toBe(200);
  });

  it('reports a port that is already in use and leaves the other server alone', async () => {
    const first = await start();
    const world = makeWorld(t);
    const opened = vi.fn();
    await expect(
      startServer({ home: world.home, port: first.server.port, localOnly: false, allowedHosts: [], openBrowser: opened, interfaces: {} }),
    ).rejects.toBeInstanceOf(PortInUseError);
    expect(readLock(world.home)).toBeNull(); // the second copy wrote no lock
    expect(readLock(first.world.home)).toMatchObject({ port: first.server.port });
    expect(opened).not.toHaveBeenCalled();
    expect((await get(first.server.port)).status).toBe(200);
  });
});

describe('shutting down', () => {
  it('ends the session with the current time, closes the database and removes the lock', async () => {
    const { world, server } = await start();
    const created = await rawRequest(server.port, {
      method: 'POST',
      path: '/api/session',
      headers: { Host: `localhost:${server.port}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ db: 'latin.db' }),
    });
    expect(created.status).toBe(201);
    const db = server.ctx.active!.db;

    server.shutdownSync();

    expect(readLock(world.home)).toBeNull();
    expect(server.ctx.active).toBeNull();
    expect(() => db.prepare('SELECT 1').get()).toThrow();
    const check = t.track(new DatabaseSync(world.file, { readOnly: true }));
    const row = check.prepare('SELECT ended_at FROM session').get() as { ended_at: number | null };
    expect(row.ended_at).not.toBeNull();
  });

  it('can be repeated, also after the server stopped', async () => {
    const { server } = await start();
    await server.shutdown();
    expect(() => server.shutdownSync()).not.toThrow();
    await expect(server.shutdown()).resolves.toBeUndefined();
  });

  it('stops answering', async () => {
    const { server } = await start();
    const { port } = server;
    await server.shutdown();
    await expect(get(port)).rejects.toThrow();
  });

  it('works without a session', async () => {
    const { world, server } = await start();
    await server.shutdown();
    expect(readLock(world.home)).toBeNull();
    expect(fs.existsSync(`${world.home}/server.lock`)).toBe(false);
  });

  it('does not wait for an idle keep-alive connection', async () => {
    const { server } = await start();
    const agent = new http.Agent({ keepAlive: true });
    await new Promise<void>((resolve) => {
      http.get({ host: '127.0.0.1', port: server.port, path: '/api/databases', headers: { Host: `localhost:${server.port}` }, agent }, (res) => {
        res.resume();
        res.on('end', () => resolve());
      });
    });
    const began = Date.now();
    await server.shutdown();
    agent.destroy();
    expect(Date.now() - began).toBeLessThan(2000);
  });
});
