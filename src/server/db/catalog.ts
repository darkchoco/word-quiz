import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseInfo, Language } from '../../shared/api';
import { AppError } from '../errors';
import { isValidDbName } from './names';
import { openDatabase } from './open';
import { countWords } from './queries';

const SUPPORTED_LANGUAGES: readonly string[] = ['latin'] satisfies Language[];

export interface ScanResult {
  databases: DatabaseInfo[];
  /** Files that were skipped or look suspicious. The caller decides how to show them. */
  warnings: string[];
}

/**
 * Lists the Word Quiz databases in `dataDir`. Files that are not usable databases are left
 * out and reported in `warnings`; a missing directory gives an empty list.
 */
export function listDatabases(dataDir: string): ScanResult {
  const warnings: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dataDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { databases: [], warnings };
    throw error;
  }

  const files = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.db'));
  const candidates: string[] = [];
  for (const file of files) {
    if (isValidDbName(file.name)) candidates.push(file.name);
    else warnings.push(`${file.name}: ignored because the file name is not allowed`);
  }

  const byLowerName = new Map<string, string[]>();
  for (const name of candidates) {
    const key = name.toLowerCase();
    byLowerName.set(key, [...(byLowerName.get(key) ?? []), name]);
  }
  for (const names of byLowerName.values()) {
    if (names.length > 1) {
      warnings.push(`${names.join(', ')}: names differ only in case and collide on Windows`);
    }
  }

  const databases: DatabaseInfo[] = [];
  for (const name of candidates) {
    try {
      const db = openDatabase(path.join(dataDir, name), { readOnly: true });
      try {
        const language = db.prepare("SELECT value FROM meta WHERE key = 'language'").get() as
          | { value: string }
          | undefined;
        if (!language || !SUPPORTED_LANGUAGES.includes(language.value)) {
          warnings.push(`${name}: unsupported language "${language?.value ?? ''}"`);
          continue;
        }
        databases.push({
          name,
          language: language.value as Language,
          wordCount: countWords(db),
        });
      } finally {
        db.close();
      }
    } catch (error) {
      if (error instanceof AppError) warnings.push(`${name}: ${error.message}`);
      else throw error;
    }
  }

  databases.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.name.localeCompare(b.name));
  return { databases, warnings };
}

/**
 * Turns a name sent by the client into a file path. Only a valid name that appears in the
 * scan result is accepted, so no client input ever becomes part of a path (TECH-SPEC T9).
 */
export function resolveDatabase(dataDir: string, name: string): string {
  if (!isValidDbName(name)) {
    throw new AppError('INVALID_DB_NAME', 'The database name is not valid.');
  }
  const found = listDatabases(dataDir).databases.find((info) => info.name === name);
  if (!found) {
    throw new AppError('DB_NOT_FOUND', 'The selected DB does not exist.');
  }
  return path.join(dataDir, found.name);
}
