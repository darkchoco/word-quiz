import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { closeActive, createContext, requireSession } from '../../src/server/context';
import { TOUCH_INTERVAL_MS } from '../../src/server/db/sessions';
import { AppError } from '../../src/server/errors';
import { openSession } from '../../src/server/services/session';
import { thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';
import { makeWorld } from '../support/world';

const t = useTempDir();
const sessionRow = (world: ReturnType<typeof makeWorld>) =>
  world.ctx.active!.db.prepare('SELECT started_at, ended_at, last_seen_at FROM session').get() as {
    started_at: number;
    ended_at: number | null;
    last_seen_at: number;
  };

describe('createContext', () => {
  it('starts without a session and with harmless defaults', () => {
    const ctx = createContext({ home: '/somewhere' });
    expect(ctx.active).toBeNull();
    expect(ctx.allowedHosts).toEqual([]);
    expect(ctx.dataDir).toMatch(/somewhere[\\/]data$/);
    expect(typeof ctx.now()).toBe('number');
    expect(() => ctx.log('ignored')).not.toThrow();
  });
});

describe('requireSession', () => {
  it('refuses when no session is running', () => {
    const { ctx } = makeWorld(t);
    const error = thrown(() => requireSession(ctx));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('NO_SESSION');
  });

  it('returns the running session and records activity at most every 30 seconds', () => {
    const world = makeWorld(t);
    const started = world.clock.now;
    openSession(world.ctx, 'latin.db');
    world.clock.now = started + TOUCH_INTERVAL_MS - 1;
    requireSession(world.ctx);
    expect(sessionRow(world).last_seen_at).toBe(started);
    world.clock.now = started + TOUCH_INTERVAL_MS;
    expect(requireSession(world.ctx).name).toBe('latin.db');
    expect(sessionRow(world).last_seen_at).toBe(started + TOUCH_INTERVAL_MS);
  });

  it.skipIf(process.platform === 'win32')(
    'notices that the database file was removed, drops the session and reports DB_NOT_FOUND',
    () => {
      const world = makeWorld(t);
      openSession(world.ctx, 'latin.db');
      const db = world.ctx.active!.db;
      fs.rmSync(world.file);
      const error = thrown(() => requireSession(world.ctx));
      expect((error as AppError).code).toBe('DB_NOT_FOUND');
      expect(world.ctx.active).toBeNull();
      expect(() => db.prepare('SELECT 1').get()).toThrow(); // the connection was closed
      expect((thrown(() => requireSession(world.ctx)) as AppError).code).toBe('NO_SESSION');
    },
  );
});

describe('closeActive', () => {
  it('ends the session at the current time and closes the database', () => {
    const world = makeWorld(t);
    openSession(world.ctx, 'latin.db');
    const db = world.ctx.active!.db;
    world.clock.now += 5000;
    closeActive(world.ctx, { end: true });
    expect(world.ctx.active).toBeNull();
    const check = t.track(new DatabaseSync(world.file, { readOnly: true }));
    expect(check.prepare('SELECT ended_at FROM session').get()).toEqual({ ended_at: world.clock.now });
    expect(() => db.prepare('SELECT 1').get()).toThrow();
  });

  it('can close without recording an end', () => {
    const world = makeWorld(t);
    openSession(world.ctx, 'latin.db');
    closeActive(world.ctx, { end: false });
    const check = t.track(new DatabaseSync(world.file, { readOnly: true }));
    expect(check.prepare('SELECT ended_at FROM session').get()).toEqual({ ended_at: null });
  });

  it('does nothing without a session, and twice is fine', () => {
    const world = makeWorld(t);
    expect(() => closeActive(world.ctx, { end: true })).not.toThrow();
    openSession(world.ctx, 'latin.db');
    closeActive(world.ctx, { end: true });
    expect(() => closeActive(world.ctx, { end: true })).not.toThrow();
  });
});
