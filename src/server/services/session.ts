import type { DatabaseInfo, Language, SessionState } from '../../shared/api';
import { listDatabases, resolveDatabase } from '../db/catalog';
import { openDatabase } from '../db/open';
import { getQuestionsPerRound, sessionStats } from '../db/queries';
import { getOpenRoundId, getRoundState } from '../db/rounds';
import { startSession } from '../db/sessions';
import { closeActive, requireSession, type ActiveSession, type AppContext } from '../context';

/** The databases in the data folder. Scan warnings are logged once, not on every request. */
export function listDatabaseInfos(ctx: AppContext): DatabaseInfo[] {
  const { databases, warnings } = listDatabases(ctx.dataDir);
  const text = warnings.join('\n');
  if (text !== ctx.lastScanWarnings) {
    ctx.lastScanWarnings = text;
    for (const warning of warnings) ctx.log(`Database list: ${warning}`);
  }
  return databases;
}

/**
 * Starts a session on the named database. If a session is running it is ended first, so this is
 * also how the database is switched (PRD 4.9). A name that cannot be used leaves the running
 * session untouched.
 */
export function openSession(ctx: AppContext, name: string): SessionState {
  const file = resolveDatabase(ctx.dataDir, name); // throws INVALID_DB_NAME or DB_NOT_FOUND

  // Selecting the database that is already open: end the old session first, so that it gets a
  // proper end time instead of being closed later as if the program had crashed.
  if (ctx.active?.file === file) closeActive(ctx, { end: true });

  const db = openDatabase(file, { recoverSessions: true });
  closeActive(ctx, { end: true });

  const language = (db.prepare("SELECT value FROM meta WHERE key = 'language'").get() as { value: Language }).value;
  const startedAt = ctx.now();
  const sessionId = startSession(db, startedAt);
  ctx.active = { name, file, language, db, sessionId, startedAt };
  ctx.log(`Session started on ${name}.`);
  return buildSessionState(ctx.active);
}

export function getSessionState(ctx: AppContext): SessionState {
  return buildSessionState(requireSession(ctx));
}

/** Ends the session and closes the database. Also called when the server shuts down. */
export function endActiveSession(ctx: AppContext): void {
  if (ctx.active) ctx.log(`Session ended on ${ctx.active.name}.`);
  closeActive(ctx, { end: true });
}

function buildSessionState(active: ActiveSession): SessionState {
  const openRound = getOpenRoundId(active.db, active.sessionId);
  return {
    db: active.name,
    language: active.language,
    sessionId: active.sessionId,
    startedAt: active.startedAt,
    questionsPerRound: getQuestionsPerRound(active.db),
    stats: sessionStats(active.db, active.sessionId),
    activeRound: openRound === undefined ? null : getRoundState(active.db, openRound),
  };
}
