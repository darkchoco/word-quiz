import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { QUESTIONS_PER_ROUND_DEFAULT, type Language } from '../../shared/api';
import { AppError } from '../errors';
import { assertNotTooNew, migrate } from './migrations';
import { dbNameExists } from './names';
import { closeOrphanSessions } from './sessions';
import { transaction } from './transaction';

export interface OpenOptions {
  /** Open without any possibility of writing (used to list databases). */
  readOnly?: boolean;
  /**
   * Close sessions that were left open by a crash. Only the server passes this: the import
   * CLI may open a database while the server is running and must not end a live session.
   */
  recoverSessions?: boolean;
}

function configure(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  // journal_mode is left at its default (DELETE) so that a .db file is a complete backup.
}

function readLanguage(db: DatabaseSync): string | undefined {
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'language'").get() as
      | { value: string }
      | undefined;
    return row?.value;
  } catch {
    return undefined; // not a SQLite file, or no meta table
  }
}

/**
 * Opens an existing Word Quiz database. `node:sqlite` would silently create a missing file,
 * so existence is checked first. Files that are not Word Quiz databases are reported as
 * DB_NOT_FOUND as well.
 */
export function openDatabase(file: string, options: OpenOptions = {}): DatabaseSync {
  const name = path.basename(file);
  if (!fs.existsSync(file)) {
    throw new AppError('DB_NOT_FOUND', `Database file not found: ${name}`);
  }
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(file, { readOnly: options.readOnly === true });
  } catch (cause) {
    throw new AppError('DB_NOT_FOUND', `Cannot open database: ${name}`, { cause });
  }
  try {
    configure(db);
    if (readLanguage(db) === undefined) {
      throw new AppError('DB_NOT_FOUND', `Not a Word Quiz database: ${name}`);
    }
    if (options.readOnly) {
      assertNotTooNew(db);
    } else {
      migrate(db);
      if (options.recoverSessions) closeOrphanSessions(db);
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * Creates a new database file with the current schema, the language and default settings.
 * Never overwrites. Names are compared ignoring case on every operating system, so code that
 * runs on Linux (WSL) refuses exactly what Windows would silently overwrite (TECH-SPEC T13).
 * The exclusive create below is a second line of defence against a race.
 */
export function createDatabase(file: string, language: Language, now: number = Date.now()): DatabaseSync {
  if (dbNameExists(path.dirname(file), path.basename(file))) {
    throw new AppError(
      'INVALID_REQUEST',
      `A database named ${path.basename(file)} already exists (names are compared ignoring case).`,
    );
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.closeSync(fs.openSync(file, 'wx'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new AppError('INVALID_REQUEST', `Database file already exists: ${path.basename(file)}`);
    }
    throw error;
  }
  let db: DatabaseSync | undefined;
  try {
    const created = new DatabaseSync(file);
    db = created;
    configure(created);
    migrate(created);
    transaction(created, () => {
      const insertMeta = created.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
      insertMeta.run('language', language);
      insertMeta.run('created_at', String(now));
      created
        .prepare('INSERT INTO setting (key, value) VALUES (?, ?)')
        .run('questions_per_round', String(QUESTIONS_PER_ROUND_DEFAULT));
    });
    return created;
  } catch (error) {
    db?.close();
    fs.rmSync(file, { force: true });
    throw error;
  }
}
