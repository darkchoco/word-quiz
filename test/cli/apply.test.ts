import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyImport } from '../../src/cli/apply';
import type { Plan } from '../../src/cli/plan';
import type { ImportEntry } from '../../src/cli/validate';
import { createDatabase, openDatabase } from '../../src/server/db/open';
import { getAllWords, getProgress, insertWord, saveProgress } from '../../src/server/db/queries';
import { startSession } from '../../src/server/db/sessions';
import { AppError } from '../../src/server/errors';
import { thrown } from '../support/seed';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();
const NOW = new Date(2026, 8, 20, 15, 20, 31);

const entry = (row: number, headword: string, meanings: string[][] = [['x']], note: string | null = null): ImportEntry => ({
  row,
  headword,
  meanings,
  note,
});
const plan = (parts: Partial<Plan> = {}): Plan => ({ added: [], updated: [], unchanged: [], missing: [], ...parts });
const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** A database with two words, one of them with learning progress. Returns its path. */
function existingDb(): { file: string; dir: string } {
  const dir = t.dir();
  const file = path.join(dir, 'latin.db');
  const db = createDatabase(file, 'latin');
  insertWord(db, { headword: 'taurus', meanings: [['Stier']], note: 'old' }, 1000);
  const id = insertWord(db, { headword: 'gravis', meanings: [['schwer']] }, 1000);
  saveProgress(db, id, { streak: 2, wrongMark: true, nextRound: 9, done: false });
  db.close();
  return { file, dir };
}

describe('a new database', () => {
  it('is created and filled with the words, each with default progress', () => {
    const file = path.join(t.dir(), 'latin_2.db');
    const result = applyImport(
      { kind: 'new', file, language: 'latin' },
      plan({ added: [entry(2, 'capere', [['fassen', 'nehmen'], ['erobern']], 'Verb'), entry(3, 'taurus', [['Stier']])] }),
      NOW,
    );
    expect(result).toEqual({ added: 2, updated: 0, backupPath: null });

    const db = t.track(openDatabase(file, { readOnly: true }));
    expect(getAllWords(db)).toEqual([
      { id: 1, headword: 'capere', meanings: [['fassen', 'nehmen'], ['erobern']], note: 'Verb' },
      { id: 2, headword: 'taurus', meanings: [['Stier']], note: null },
    ]);
    expect(getProgress(db, 1)).toEqual({ streak: 0, wrongMark: false, nextRound: 1, done: false });
    expect(db.prepare("SELECT value FROM meta WHERE key = 'language'").get()).toEqual({ value: 'latin' });
  });

  it('is deleted again when writing fails half way, leaving nothing behind', () => {
    const dir = t.dir();
    const file = path.join(dir, 'latin_2.db');
    const broken = plan({ added: [entry(2, 'ok'), entry(3, 'broken', [])] }); // empty meanings are refused
    const error = thrown(() => applyImport({ kind: 'new', file, language: 'latin' }, broken, NOW));
    expect((error as AppError).code).toBe('INVALID_MEANINGS');
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('refuses a name that only differs in case and leaves the existing database alone', () => {
    const { file, dir } = existingDb();
    const before = sha(file);
    const error = thrown(() =>
      applyImport({ kind: 'new', file: path.join(dir, 'Latin.db'), language: 'latin' }, plan({ added: [entry(2, 'a')] }), NOW),
    );
    expect((error as AppError).code).toBe('INVALID_REQUEST');
    expect(fs.readdirSync(dir)).toEqual(['latin.db']);
    expect(sha(file)).toBe(before);
  });
});

describe('merging into an existing database', () => {
  it('updates meanings and note, adds new words and keeps the learning progress', () => {
    const { file } = existingDb();
    const before = getAllWords(t.track(openDatabase(file, { readOnly: true })));
    const taurusId = before.find((w) => w.headword === 'taurus')?.id ?? 0;
    const gravisId = before.find((w) => w.headword === 'gravis')?.id ?? 0;

    const result = applyImport(
      { kind: 'merge', file },
      plan({
        added: [entry(4, 'capere', [['fassen']])],
        updated: [
          { entry: entry(2, 'taurus', [['Stier', 'Bulle']], 'new'), before: { id: taurusId, headword: 'taurus', meanings: [['Stier']], note: 'old' } },
          { entry: entry(3, 'gravis', [['schwer', 'gewichtig']], null), before: { id: gravisId, headword: 'gravis', meanings: [['schwer']], note: null } },
        ],
      }),
      NOW,
    );
    expect(result.added).toBe(1);
    expect(result.updated).toBe(2);

    const db = t.track(openDatabase(file, { readOnly: true }));
    const words = getAllWords(db);
    expect(words.map((w) => w.headword)).toEqual(['taurus', 'gravis', 'capere']);
    expect(words[0]).toMatchObject({ meanings: [['Stier', 'Bulle']], note: 'new' });
    expect(words[1]).toMatchObject({ meanings: [['schwer', 'gewichtig']], note: null });
    // progress of the updated word is exactly what it was
    expect(getProgress(db, gravisId)).toEqual({ streak: 2, wrongMark: true, nextRound: 9, done: false });
    // the new word starts fresh
    expect(getProgress(db, words[2]?.id ?? 0)).toEqual({ streak: 0, wrongMark: false, nextRound: 1, done: false });
    // created_at stays, updated_at moves
    expect(db.prepare('SELECT created_at, updated_at FROM word WHERE headword = ?').get('taurus')).toEqual({
      created_at: 1000,
      updated_at: NOW.getTime(),
    });
  });

  it('never deletes words that are missing from the Excel file, and keeps their progress and content', () => {
    const { file } = existingDb();
    const db0 = t.track(openDatabase(file, { readOnly: true }));
    const gravis = getAllWords(db0).find((w) => w.headword === 'gravis');
    applyImport({ kind: 'merge', file }, plan({ added: [entry(2, 'capere')], missing: [gravis as never] }), NOW);

    const db = t.track(openDatabase(file, { readOnly: true }));
    const after = getAllWords(db);
    expect(after.map((w) => w.headword)).toEqual(['taurus', 'gravis', 'capere']);
    expect(after.find((w) => w.headword === 'gravis')).toEqual(gravis);
    // a word without its progress row would silently drop out of every round
    expect(getProgress(db, gravis?.id ?? 0)).toEqual({ streak: 2, wrongMark: true, nextRound: 9, done: false });
    expect(db.prepare('SELECT COUNT(*) AS n FROM word_progress').get()).toEqual({ n: 3 });
  });

  it('saves the state before the change in backup/<name>.<timestamp>.db', () => {
    const { file, dir } = existingDb();
    const result = applyImport({ kind: 'merge', file }, plan({ added: [entry(2, 'capere')] }), NOW);

    expect(result.backupPath).toBe(path.join(dir, 'backup', 'latin.20260920-152031.db'));
    expect(fs.existsSync(result.backupPath ?? '')).toBe(true);
    const saved = t.track(new DatabaseSync(result.backupPath ?? '', { readOnly: true }));
    expect(saved.prepare('SELECT COUNT(*) AS n FROM word').get()).toEqual({ n: 2 });
    expect(saved.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
    const now = t.track(openDatabase(file, { readOnly: true }));
    expect(now.prepare('SELECT COUNT(*) AS n FROM word').get()).toEqual({ n: 3 });
  });

  it('gives a second backup in the same second a numeric suffix instead of overwriting', () => {
    const { file, dir } = existingDb();
    const first = applyImport({ kind: 'merge', file }, plan({ added: [entry(2, 'a')] }), NOW);
    const second = applyImport({ kind: 'merge', file }, plan({ added: [entry(3, 'b')] }), NOW);
    expect(path.basename(first.backupPath ?? '')).toBe('latin.20260920-152031.db');
    expect(path.basename(second.backupPath ?? '')).toBe('latin.20260920-152031-2.db');
    expect(fs.readdirSync(path.join(dir, 'backup')).sort()).toEqual(['latin.20260920-152031-2.db', 'latin.20260920-152031.db']);
    // the first backup still has the original two words, the second has three
    expect(new DatabaseSync(first.backupPath ?? '', { readOnly: true }).prepare('SELECT COUNT(*) AS n FROM word').get()).toEqual({ n: 2 });
  });

  it('writes nothing when a later entry fails, so the database stays as it was', () => {
    const { file } = existingDb();
    const before = getAllWords(t.track(openDatabase(file, { readOnly: true })));
    const taurus = before.find((w) => w.headword === 'taurus');
    const broken = plan({
      updated: [{ entry: entry(2, 'taurus', [['changed']]), before: taurus as never }],
      added: [entry(3, 'broken', [])],
    });
    const error = thrown(() => applyImport({ kind: 'merge', file }, broken, NOW));
    expect((error as AppError).code).toBe('INVALID_MEANINGS');
    expect(getAllWords(t.track(openDatabase(file, { readOnly: true })))).toEqual(before);
  });

  it('does not end a session that is still open (the server may be running)', () => {
    const { file } = existingDb();
    const db = openDatabase(file);
    startSession(db, 5000);
    db.close();
    applyImport({ kind: 'merge', file }, plan({ added: [entry(2, 'capere')] }), NOW);
    const check = t.track(openDatabase(file, { readOnly: true }));
    expect(check.prepare('SELECT ended_at FROM session').get()).toEqual({ ended_at: null });
  });

  it('reports a database that does not exist', () => {
    const file = path.join(t.dir(), 'missing.db');
    const error = thrown(() => applyImport({ kind: 'merge', file }, plan({ added: [entry(2, 'a')] }), NOW));
    expect((error as AppError).code).toBe('DB_NOT_FOUND');
    expect(fs.existsSync(file)).toBe(false);
  });
});

describe('when there is nothing to change', () => {
  it('does not open, back up or touch the database', () => {
    const { file, dir } = existingDb();
    const before = sha(file);
    const result = applyImport({ kind: 'merge', file }, plan({ unchanged: [entry(2, 'taurus')] }), NOW);
    expect(result).toEqual({ added: 0, updated: 0, backupPath: null });
    expect(fs.existsSync(path.join(dir, 'backup'))).toBe(false);
    expect(sha(file)).toBe(before);
  });

  it('does not even need the database to exist', () => {
    const file = path.join(t.dir(), 'missing.db');
    expect(applyImport({ kind: 'merge', file }, plan(), NOW)).toEqual({ added: 0, updated: 0, backupPath: null });
  });
});
