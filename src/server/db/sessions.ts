import type { DatabaseSync } from 'node:sqlite';

/** `last_seen_at` is refreshed at most this often, to avoid a write on every request. */
export const TOUCH_INTERVAL_MS = 30_000;

export function startSession(db: DatabaseSync, now: number = Date.now()): number {
  const result = db
    .prepare('INSERT INTO session (started_at, last_seen_at) VALUES (?, ?)')
    .run(now, now);
  return Number(result.lastInsertRowid);
}

/** Refreshes `last_seen_at` unless it was refreshed recently. Returns whether it wrote. */
export function touchSession(db: DatabaseSync, sessionId: number, now: number = Date.now()): boolean {
  const result = db
    .prepare(
      'UPDATE session SET last_seen_at = ? WHERE id = ? AND ended_at IS NULL AND ? - last_seen_at >= ?',
    )
    .run(now, sessionId, now, TOUCH_INTERVAL_MS);
  return Number(result.changes) > 0;
}

export function endSession(db: DatabaseSync, sessionId: number, now: number = Date.now()): void {
  db.prepare('UPDATE session SET ended_at = ? WHERE id = ? AND ended_at IS NULL').run(now, sessionId);
}

/**
 * Closes sessions that were never ended (crash, killed console) using their last activity
 * time. Only the server calls this, because a second process (the import CLI) that opens
 * the same database must not close a session that is still alive.
 * Returns the number of sessions closed.
 */
export function closeOrphanSessions(db: DatabaseSync): number {
  const result = db.prepare('UPDATE session SET ended_at = last_seen_at WHERE ended_at IS NULL').run();
  return Number(result.changes);
}
