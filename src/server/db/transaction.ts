import type { DatabaseSync } from 'node:sqlite';
import { translateSqliteError } from '../errors';

/**
 * Runs `fn` inside BEGIN IMMEDIATE ... COMMIT and rolls back if it throws.
 *
 * Transactions do NOT nest: `DatabaseSync.isTransaction` is not available on the minimum
 * supported Node version, so callers must not call this from inside another transaction.
 * Use `savepoint` for code that may run both inside and outside a transaction.
 * SQLite constraint failures are translated to AppError.
 */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  let result: T;
  try {
    result = fn();
    db.exec('COMMIT');
  } catch (error) {
    rollbackQuietly(db, 'ROLLBACK');
    throw translateSqliteError(error);
  }
  return result;
}

/**
 * Like `transaction`, but uses a SAVEPOINT so it also works inside an open transaction
 * (outside one, SQLite starts a transaction implicitly).
 */
export function savepoint<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('SAVEPOINT wq_sp');
  let result: T;
  try {
    result = fn();
    db.exec('RELEASE wq_sp');
  } catch (error) {
    rollbackQuietly(db, 'ROLLBACK TO wq_sp');
    rollbackQuietly(db, 'RELEASE wq_sp');
    throw translateSqliteError(error);
  }
  return result;
}

function rollbackQuietly(db: DatabaseSync, sql: string): void {
  try {
    db.exec(sql);
  } catch {
    // The failure that brought us here may already have ended the transaction.
  }
}
