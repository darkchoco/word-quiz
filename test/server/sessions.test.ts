import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/server/db/open';
import {
  closeOrphanSessions,
  endSession,
  startSession,
  TOUCH_INTERVAL_MS,
  touchSession,
} from '../../src/server/db/sessions';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();
const freshDb = () => t.track(createDatabase(path.join(t.dir(), 'latin.db'), 'latin'));
const row = (db: ReturnType<typeof freshDb>, id: number) =>
  db.prepare('SELECT started_at, ended_at, last_seen_at FROM session WHERE id = ?').get(id);

describe('sessions', () => {
  it('starts with last_seen_at equal to started_at and no end', () => {
    const db = freshDb();
    const id = startSession(db, 5000);
    expect(row(db, id)).toEqual({ started_at: 5000, ended_at: null, last_seen_at: 5000 });
  });

  it('gives every session its own id', () => {
    const db = freshDb();
    expect(startSession(db, 1)).not.toBe(startSession(db, 2));
  });

  it('touches at most once per interval', () => {
    const db = freshDb();
    const id = startSession(db, 0);
    expect(touchSession(db, id, TOUCH_INTERVAL_MS - 1)).toBe(false);
    expect(row(db, id)).toMatchObject({ last_seen_at: 0 });
    expect(touchSession(db, id, TOUCH_INTERVAL_MS)).toBe(true);
    expect(row(db, id)).toMatchObject({ last_seen_at: TOUCH_INTERVAL_MS });
    expect(touchSession(db, id, TOUCH_INTERVAL_MS + 1)).toBe(false);
  });

  it('does not touch a session that has ended', () => {
    const db = freshDb();
    const id = startSession(db, 0);
    endSession(db, id, 10);
    expect(touchSession(db, id, 10 * TOUCH_INTERVAL_MS)).toBe(false);
  });

  it('ends a session once and keeps the first end time', () => {
    const db = freshDb();
    const id = startSession(db, 0);
    endSession(db, id, 100);
    endSession(db, id, 999);
    expect(row(db, id)).toMatchObject({ ended_at: 100 });
  });

  it('closes only open sessions, at their last activity time', () => {
    const db = freshDb();
    const finished = startSession(db, 0);
    endSession(db, finished, 50);
    const crashed = startSession(db, 100);
    touchSession(db, crashed, 100 + TOUCH_INTERVAL_MS);

    expect(closeOrphanSessions(db)).toBe(1);
    expect(row(db, finished)).toMatchObject({ ended_at: 50 });
    expect(row(db, crashed)).toMatchObject({ ended_at: 100 + TOUCH_INTERVAL_MS });
    expect(closeOrphanSessions(db)).toBe(0);
  });
});
