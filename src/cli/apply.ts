import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { Language } from '../shared/api';
import { createDatabase, openDatabase } from '../server/db/open';
import { insertWord, updateWordContent } from '../server/db/queries';
import { transaction } from '../server/db/transaction';
import type { Plan } from './plan';
import { formatTimestamp } from './report';

export type ApplyTarget =
  | { kind: 'merge'; file: string }
  | { kind: 'new'; file: string; language: Language };

export interface ApplyResult {
  added: number;
  updated: number;
  /** Where the database was saved before it was changed. Null for a new database or no changes. */
  backupPath: string | null;
}

/**
 * Writes a plan to the database. All changes happen in one transaction: if anything fails
 * nothing is written, and a database created for this import is deleted again.
 *
 * The database is opened without session recovery because the server may be running and
 * must keep its live session.
 */
export function applyImport(target: ApplyTarget, plan: Plan, now: Date): ApplyResult {
  const added = plan.added.length;
  const updated = plan.updated.length;
  if (added === 0 && updated === 0) return { added: 0, updated: 0, backupPath: null };

  const nowMs = now.getTime();
  if (target.kind === 'new') {
    const db = createDatabase(target.file, target.language, nowMs);
    try {
      write(db, plan, nowMs);
    } catch (error) {
      db.close();
      fs.rmSync(target.file, { force: true }); // no half-filled database is left behind
      throw error;
    }
    db.close();
    return { added, updated, backupPath: null };
  }

  const db = openDatabase(target.file);
  try {
    const backupPath = backup(db, target.file, now);
    write(db, plan, nowMs);
    return { added, updated, backupPath };
  } finally {
    db.close();
  }
}

function write(db: DatabaseSync, plan: Plan, nowMs: number): void {
  transaction(db, () => {
    for (const entry of plan.added) {
      insertWord(db, { headword: entry.headword, meanings: entry.meanings, note: entry.note }, nowMs);
    }
    for (const { entry, before } of plan.updated) {
      updateWordContent(db, before.id, { meanings: entry.meanings, note: entry.note }, nowMs);
    }
  });
}

/**
 * Saves a consistent copy to `backup/<name>.<yyyyMMdd-HHmmss>.db` next to the database.
 * VACUUM INTO is used instead of copying the file, because a copy could catch the file in the
 * middle of a write by the server. It refuses to overwrite, so an existing backup is never
 * replaced; a name clash within the same second gets a numeric suffix.
 */
function backup(db: DatabaseSync, file: string, now: Date): string {
  const dir = path.join(path.dirname(file), 'backup');
  fs.mkdirSync(dir, { recursive: true });
  const base = `${path.basename(file, '.db')}.${formatTimestamp(now)}`;
  for (let attempt = 1; attempt < 1000; attempt++) {
    const candidate = path.join(dir, attempt === 1 ? `${base}.db` : `${base}-${attempt}.db`);
    if (fs.existsSync(candidate)) continue;
    db.prepare('VACUUM INTO ?').run(candidate);
    return candidate;
  }
  throw new Error(`Could not find a free backup name for ${base}`);
}
