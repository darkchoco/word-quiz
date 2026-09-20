import fs from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import type { Language } from '../shared/api';
import { endSession, touchSession } from './db/sessions';
import { dataDir } from './paths';
import { AppError } from './errors';

/** The one session the server is running (single user: PC and phone share it). */
export interface ActiveSession {
  name: string;
  file: string;
  language: Language;
  db: DatabaseSync;
  sessionId: number;
  startedAt: number;
}

export interface AppContext {
  home: string;
  dataDir: string;
  /** Milliseconds since the epoch. Replaced in tests. */
  now: () => number;
  active: ActiveSession | null;
  /** Extra host names the host check accepts (`--allow-host`). */
  allowedHosts: string[];
  log: (line: string) => void;
  /** The last database scan warnings that were logged, so that they are not repeated. */
  lastScanWarnings: string;
}

export function createContext(options: {
  home: string;
  now?: () => number;
  allowedHosts?: string[];
  log?: (line: string) => void;
}): AppContext {
  return {
    home: options.home,
    dataDir: dataDir(options.home),
    now: options.now ?? Date.now,
    active: null,
    allowedHosts: options.allowedHosts ?? [],
    log: options.log ?? (() => {}),
    lastScanWarnings: '',
  };
}

/**
 * Ends the active session (when `end` is true) and closes its database. Does nothing if there
 * is no session. Never throws: this is also used while shutting down.
 */
export function closeActive(ctx: AppContext, options: { end: boolean }): void {
  const active = ctx.active;
  if (!active) return;
  ctx.active = null;
  try {
    if (options.end) endSession(active.db, active.sessionId, ctx.now());
  } catch (error) {
    ctx.log(`Could not record the end of the session: ${(error as Error).message}`);
  }
  try {
    active.db.close();
  } catch {
    // already closed
  }
}

/**
 * The active session, or an error. Every request that needs a database goes through here, which
 * also records that the session is still in use (at most every 30 seconds) and notices when the
 * database file has been removed.
 */
export function requireSession(ctx: AppContext): ActiveSession {
  const active = ctx.active;
  if (!active) throw new AppError('NO_SESSION', 'No database is selected. Start a session first.');
  if (!fs.existsSync(active.file)) {
    closeActive(ctx, { end: false });
    throw new AppError('DB_NOT_FOUND', 'The selected DB does not exist.');
  }
  touchSession(active.db, active.sessionId, ctx.now());
  return active;
}
