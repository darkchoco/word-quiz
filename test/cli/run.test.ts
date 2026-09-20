import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { explainError, runImport } from '../../src/cli/run';
import { CliError } from '../../src/cli/errors';
import { createDatabase, openDatabase } from '../../src/server/db/open';
import { getAllWords, getProgress, insertWord, saveProgress } from '../../src/server/db/queries';
import { startSession } from '../../src/server/db/sessions';
import { AppError } from '../../src/server/errors';
import { useTempDir } from '../support/tempdir';
import { HEADER, writeXlsx, type TestCell } from '../support/xlsx';

const t = useTempDir();
const NOW = new Date(2026, 8, 20, 15, 20, 31);

const SAMPLE: TestCell[][] = [
  ['capere, capiō, cēpī, captum', 'fassen, nehmen', 'erobern', null, null, 'Verb'],
  ['taurus', 'Stier', null, null, null, null],
];

interface Setup {
  home: string;
  xlsx: string;
  dataDir: string;
  reports: string;
  run: (argv: string[], now?: Date) => Promise<{ code: number; out: string; err: string }>;
}

function setup(rows: TestCell[][] = SAMPLE): Setup {
  const home = t.dir();
  const xlsx = writeXlsx(path.join(home, 'input.xlsx'), [{ name: 'Wortschatz', rows: [HEADER, ...rows] }]);
  return {
    home,
    xlsx,
    dataDir: path.join(home, 'data'),
    reports: path.join(home, 'reports'),
    run: async (argv, now = NOW) => {
      const out: string[] = [];
      const err: string[] = [];
      const code = await runImport(argv, { home, now, out: (s) => out.push(s), err: (s) => err.push(s) });
      return { code, out: out.join(''), err: err.join('') };
    },
  };
}

const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const dbFile = (s: Setup, name = 'latin.db') => path.join(s.dataDir, name);
const words = (file: string) => getAllWords(t.track(openDatabase(file, { readOnly: true })));

describe('checking a file (the default)', () => {
  it('does not create the database for --new-db, but writes and prints the report', async () => {
    const s = setup();
    const { code, out, err } = await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin']);

    expect(code).toBe(0);
    expect(err).toBe('');
    expect(fs.existsSync(dbFile(s))).toBe(false);
    const reportFile = path.join(s.reports, 'input_20260920-152031.txt');
    const saved = fs.readFileSync(reportFile, 'utf8');
    expect(saved).toContain('Mode     : VALIDATE (no changes made)');
    expect(saved).toContain('Added             : 2');
    expect(saved).toContain('Result: OK to apply. Re-run with --apply to write these changes.');
    // the console shows the same text as the file, plus where the file is
    expect(out).toBe(`${saved}Report saved to: ${reportFile}\n`);
  });

  it('leaves an existing database byte for byte unchanged', async () => {
    const s = setup();
    await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--apply']);
    const before = sha(dbFile(s));
    const mtime = fs.statSync(dbFile(s)).mtimeMs;

    const { code, out } = await s.run([s.xlsx, '--db', 'latin']);
    expect(code).toBe(0);
    expect(out).toContain('Unchanged         : 2');
    expect(sha(dbFile(s))).toBe(before);
    expect(fs.statSync(dbFile(s)).mtimeMs).toBe(mtime);
    expect(fs.existsSync(path.join(s.dataDir, 'backup'))).toBe(false);
  });

  it('exits 0 for warnings only and shows them', async () => {
    const s = setup([['a', 'sich (setzen', null, null, null, null]]);
    const { code, out } = await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin']);
    expect(code).toBe(0);
    expect(out).toContain('Warnings          : 1');
    expect(out).toContain('unbalanced parenthesis');
  });

  it('exits 1 for errors, even without --apply', async () => {
    const s = setup([['a', 'x', null, null, null, null], ['a', 'y', null, null, null, null]]);
    const { code, out } = await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin']);
    expect(code).toBe(1);
    expect(out).toContain('duplicate headword "a" (first seen on row 2)');
    expect(out).toContain('Result: NOT applied. Fix the errors in the Excel file and run again.');
  });

  it('exits 1 when a required column is missing', async () => {
    const home = t.dir();
    const xlsx = writeXlsx(path.join(home, 'bad.xlsx'), [{ name: 'S', rows: [['뜻1', '노트'], ['x', 'y']] }]);
    const out: string[] = [];
    const code = await runImport([xlsx, '--new-db', 'latin', '--lang', 'latin'], { home, now: NOW, out: (s) => out.push(s), err: () => {} });
    expect(code).toBe(1);
    expect(out.join('')).toContain('Required column "단어" not found');
  });
});

describe('applying a file', () => {
  it('creates the database and afterwards a check reports every word as unchanged', async () => {
    const s = setup();
    const applied = await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--apply']);
    expect(applied.code).toBe(0);
    expect(applied.out).toContain('Result: APPLIED. Added 2, updated 0.');
    expect(words(dbFile(s)).map((w) => w.headword)).toEqual(['capere, capiō, cēpī, captum', 'taurus']);

    const again = await s.run([s.xlsx, '--db', 'latin.db'], new Date(2026, 8, 20, 16, 0, 0));
    expect(again.code).toBe(0);
    expect(again.out).toContain('Added             : 0');
    expect(again.out).toContain('Updated           : 0');
    expect(again.out).toContain('Unchanged         : 2');
    expect(again.out).toContain('Result: Nothing to apply.');
  });

  it('applying the same file again changes nothing and makes no backup', async () => {
    const s = setup();
    await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--apply']);
    const before = sha(dbFile(s));
    const again = await s.run([s.xlsx, '--db', 'latin', '--apply']);
    expect(again.code).toBe(0);
    expect(again.out).toContain('Result: Nothing to apply.');
    expect(sha(dbFile(s))).toBe(before);
    expect(fs.existsSync(path.join(s.dataDir, 'backup'))).toBe(false);
  });

  it('merges: updates changed words, adds new ones, keeps progress, never deletes, and backs up first', async () => {
    const s = setup();
    await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--apply']);
    const db = openDatabase(dbFile(s));
    const taurusId = getAllWords(db).find((w) => w.headword === 'taurus')?.id ?? 0;
    saveProgress(db, taurusId, { streak: 3, wrongMark: false, nextRound: 12, done: true });
    db.close();

    // taurus changes, capere disappears from the file, gravis is new
    const second = writeXlsx(path.join(s.home, 'second.xlsx'), [
      { name: 'Wortschatz', rows: [HEADER, ['taurus', 'Stier', 'Bulle', null, null, null], ['gravis', 'schwer', null, null, null, null]] },
    ]);
    const later = new Date(2026, 8, 21, 9, 0, 0);
    const { code, out } = await s.run([second, '--db', 'latin', '--apply'], later);

    expect(code).toBe(0);
    expect(out).toContain('Added             : 1');
    expect(out).toContain('Updated           : 1');
    expect(out).toContain('Missing in Excel  : 1');
    expect(out).toContain('meanings : [Stier]  ->  [Stier] [Bulle]');
    expect(out).toContain('Result: APPLIED. Added 1, updated 1.');

    const after = words(dbFile(s));
    expect(after.map((w) => w.headword)).toEqual(['capere, capiō, cēpī, captum', 'taurus', 'gravis']);
    expect(after.find((w) => w.headword === 'taurus')?.meanings).toEqual([['Stier'], ['Bulle']]);
    expect(getProgress(t.track(openDatabase(dbFile(s), { readOnly: true })), taurusId)).toEqual({
      streak: 3,
      wrongMark: false,
      nextRound: 12,
      done: true,
    });
    const backups = fs.readdirSync(path.join(s.dataDir, 'backup'));
    expect(backups).toEqual(['latin.20260921-090000.db']);
    expect(out).toContain(`Backup   : ${path.join(s.dataDir, 'backup', 'latin.20260921-090000.db')}`);
  });

  it('writes nothing when the file has errors, whether the target is new or existing', async () => {
    const s = setup();
    await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--apply']);
    const before = sha(dbFile(s));
    const bad = writeXlsx(path.join(s.home, 'bad.xlsx'), [
      { name: 'W', rows: [HEADER, ['taurus', 'Bulle', null, null, null, null], ['taurus', 'again', null, null, null, null]] },
    ]);

    const merge = await s.run([bad, '--db', 'latin', '--apply']);
    expect(merge.code).toBe(1);
    expect(merge.out).toContain('NOT applied');
    expect(sha(dbFile(s))).toBe(before);
    expect(fs.existsSync(path.join(s.dataDir, 'backup'))).toBe(false);

    const fresh = await s.run([bad, '--new-db', 'other', '--lang', 'latin', '--apply']);
    expect(fresh.code).toBe(1);
    expect(fs.existsSync(dbFile(s, 'other.db'))).toBe(false);
  });

  it('does not end a session that the server still has open', async () => {
    const s = setup();
    await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--apply']);
    const db = openDatabase(dbFile(s));
    startSession(db, 5000);
    db.close();
    const changed = writeXlsx(path.join(s.home, 'changed.xlsx'), [{ name: 'W', rows: [HEADER, ['taurus', 'Bulle', null, null, null, null]] }]);
    expect((await s.run([changed, '--db', 'latin', '--apply'])).code).toBe(0);
    const check = t.track(openDatabase(dbFile(s), { readOnly: true }));
    expect(check.prepare('SELECT ended_at FROM session').get()).toEqual({ ended_at: null });
  });
});

describe('problems with the command, the file or the database', () => {
  it('refuses --new-db for a name that exists, ignoring case, and leaves that database alone', async () => {
    const s = setup();
    await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--apply']);
    const before = sha(dbFile(s));
    for (const name of ['Latin', 'LATIN.db', 'latin']) {
      const { code, err } = await s.run([s.xlsx, '--new-db', name, '--lang', 'latin', '--apply']);
      expect(code, name).toBe(2);
      expect(err).toContain('already exists');
      // the hint uses the spelling of the file that exists, not the one that was typed
      expect(err).toContain('A database named latin.db already exists');
      expect(err).toContain('--db latin.db');
    }
    expect(sha(dbFile(s))).toBe(before);
    expect(fs.readdirSync(s.dataDir)).toEqual(['latin.db']);
  });

  it('says which databases exist when --db names one that does not', async () => {
    const s = setup();
    createDatabase(dbFile(s), 'latin').close();
    const { code, err } = await s.run([s.xlsx, '--db', 'nope']);
    expect(code).toBe(2);
    expect(err).toBe('Database not found: nope.db. Available databases: latin.db\n');
  });

  it('says so when there are no databases at all', async () => {
    const s = setup();
    const { code, err } = await s.run([s.xlsx, '--db', 'latin']);
    expect(code).toBe(2);
    expect(err).toContain('Database not found: latin.db.');
    expect(err).toContain('no databases');
  });

  it('exits 2 for a missing Excel file, without creating anything', async () => {
    const s = setup();
    const { code, err } = await s.run([path.join(s.home, 'missing.xlsx'), '--new-db', 'latin', '--lang', 'latin']);
    expect(code).toBe(2);
    expect(err).toMatch(/^File not found: /);
    expect(fs.existsSync(s.dataDir)).toBe(false);
    expect(fs.existsSync(s.reports)).toBe(false);
  });

  it('exits 2 for an unknown sheet and lists the sheets', async () => {
    const s = setup();
    const { code, err } = await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--sheet', 'Nope']);
    expect(code).toBe(2);
    expect(err).toBe('Sheet not found: Nope. Available sheets: Wortschatz\n');
  });

  it('reads another sheet when asked to', async () => {
    const home = t.dir();
    const xlsx = writeXlsx(path.join(home, 'two.xlsx'), [
      { name: 'Empty', rows: [] },
      { name: 'Words', rows: [HEADER, ['taurus', 'Stier', null, null, null, null]] },
    ]);
    const out: string[] = [];
    const code = await runImport([xlsx, '--new-db', 'latin', '--lang', 'latin', '--sheet', 'Words'], { home, now: NOW, out: (s) => out.push(s), err: () => {} });
    expect(code).toBe(0);
    expect(out.join('')).toContain('(sheet: Words)');
  });

  it('exits 2 for an old .xls file', async () => {
    const s = setup();
    const old = path.join(s.home, 'old.xls');
    fs.writeFileSync(old, 'x');
    const { code, err } = await s.run([old, '--new-db', 'latin', '--lang', 'latin']);
    expect(code).toBe(2);
    expect(err).toContain('Only .xlsx files are supported');
  });

  it('exits 2 for a wrong command line and points to --help', async () => {
    const s = setup();
    const { code, err } = await s.run([s.xlsx]);
    expect(code).toBe(2);
    expect(err).toContain('Choose a target');
    expect(err).toContain('--help');
  });

  it('prints the usage for --help and exits 0', async () => {
    const s = setup();
    const { code, out } = await s.run(['--help']);
    expect(code).toBe(0);
    expect(out).toContain('Usage:');
  });
});

describe('the report file', () => {
  it('goes where --report says, creating folders, in UTF-8 without a byte order mark', async () => {
    const s = setup([['Prōmētheus, Prōmēthei', 'Göttersohn', null, null, null, null]]);
    const target = path.join(s.home, 'somewhere', 'else', 'r.txt');
    const { out } = await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--report', target]);
    const bytes = fs.readFileSync(target);
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    const text = bytes.toString('utf8');
    expect(text).toContain('Prōmētheus, Prōmēthei');
    expect(text).toContain('(sheet: Wortschatz)');
    expect(out).toContain(`Report saved to: ${target}`);
    expect(fs.existsSync(s.reports)).toBe(false); // the default folder was not used
  });

  it('names the default file after the Excel file and the time of the run', async () => {
    const s = setup();
    await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin'], new Date(2027, 0, 5, 7, 8, 9));
    expect(fs.readdirSync(s.reports)).toEqual(['input_20270105-070809.txt']);
  });

  it('does not hide the result when the report cannot be saved', async () => {
    const s = setup();
    const blocker = path.join(s.home, 'blocker');
    fs.writeFileSync(blocker, 'a file where a folder is needed');
    const { code, out, err } = await s.run([s.xlsx, '--new-db', 'latin', '--lang', 'latin', '--apply', '--report', path.join(blocker, 'r.txt')]);
    expect(code).toBe(0);
    expect(out).toContain('Result: APPLIED');
    expect(out).not.toContain('Report saved to');
    expect(err).toContain('Warning: the report could not be saved');
    expect(fs.existsSync(dbFile(s))).toBe(true);
  });
});

describe('explainError', () => {
  it('passes user messages through and adds a hint for a busy database', () => {
    expect(explainError(new CliError('File not found: x'))).toBe('File not found: x');
    expect(explainError(new Error('database is locked'))).toBe('The database is busy. Stop the Word Quiz server and try again.');
    expect(explainError(new AppError('DB_TOO_NEW', 'too new'))).toBe('too new');
    expect(explainError(new Error('boom'))).toBe('Unexpected error: boom');
    expect(explainError('text')).toBe('Unexpected error: text');
  });
});

describe('the sample words used above', () => {
  it('insertWord and the import agree on how a headword is stored', () => {
    const dir = t.dir();
    const db = t.track(createDatabase(path.join(dir, 'latin.db'), 'latin'));
    insertWord(db, { headword: '  capiū  ', meanings: [['x']] });
    expect(getAllWords(db)[0]?.headword).toBe('capiū');
  });
});
