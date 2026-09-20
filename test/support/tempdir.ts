import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach } from 'vitest';

/**
 * Temporary directories and databases for one test file. Everything is cleaned up after each
 * test; databases are closed first because Windows cannot delete a file that is still open.
 */
export function useTempDir() {
  const dirs: string[] = [];
  const dbs: DatabaseSync[] = [];

  afterEach(() => {
    for (const db of dbs.splice(0)) {
      try {
        db.close();
      } catch {
        // already closed by the test
      }
    }
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  return {
    dir(): string {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wq-test-'));
      dirs.push(dir);
      return dir;
    },
    track<T extends DatabaseSync>(db: T): T {
      dbs.push(db);
      return db;
    },
  };
}
