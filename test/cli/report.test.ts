import { describe, expect, it } from 'vitest';
import type { Plan } from '../../src/cli/plan';
import {
  formatDateTime,
  formatGroups,
  formatTimestamp,
  renderReport,
  type ReportInput,
} from '../../src/cli/report';
import type { ImportEntry, Issue } from '../../src/cli/validate';

const entry = (row: number, headword: string, meanings: string[][] = [['x']], note: string | null = null): ImportEntry => ({
  row,
  headword,
  meanings,
  note,
});
const emptyPlan: Plan = { added: [], updated: [], unchanged: [], missing: [] };
const NOW = new Date(2026, 8, 20, 15, 20, 31); // local time

function report(overrides: Partial<ReportInput> = {}): string {
  return renderReport({
    file: 'data/latin_wortschatz.xlsx',
    sheet: 'Wortschatz',
    target: { name: 'latin.db', kind: 'merge' },
    mode: 'validate',
    now: NOW,
    rowsRead: 0,
    issues: [],
    plan: emptyPlan,
    outcome: 'nothing-to-apply',
    backupPath: null,
    ...overrides,
  });
}

describe('formatting helpers', () => {
  it('formats local time for file names and for the report', () => {
    expect(formatTimestamp(NOW)).toBe('20260920-152031');
    expect(formatDateTime(NOW)).toBe('2026-09-20 15:20:31');
    expect(formatTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
  });

  it('shows meaning groups in brackets', () => {
    expect(formatGroups([['fassen', 'nehmen'], ['erobern']])).toBe('[fassen, nehmen] [erobern]');
    expect(formatGroups([['x']])).toBe('[x]');
  });
});

describe('renderReport: layout', () => {
  it('starts with the title and describes the run', () => {
    const text = report();
    expect(text.split('\n').slice(0, 6)).toEqual([
      'Word Quiz Import Report',
      '=======================',
      'File     : data/latin_wortschatz.xlsx  (sheet: Wortschatz)',
      'Target   : latin.db (merge into existing database)',
      'Mode     : VALIDATE (no changes made)',
      'Time     : 2026-09-20 15:20:31',
    ]);
  });

  it('names a new database as such and marks the apply mode', () => {
    const text = report({ target: { name: 'latin_2.db', kind: 'new' }, mode: 'apply' });
    expect(text).toContain('Target   : latin_2.db (new database)');
    expect(text).toContain('Mode     : APPLY');
  });

  it('ends with exactly one line break', () => {
    const text = report();
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('shows the counts in the summary', () => {
    const issues: Issue[] = [
      { level: 'warning', row: 3, message: 'w1' },
      { level: 'warning', row: 4, message: 'w2' },
      { level: 'error', row: 5, message: 'e1' },
    ];
    const plan: Plan = {
      added: [entry(2, 'a')],
      updated: [{ entry: entry(6, 'b', [['y']]), before: { id: 1, headword: 'b', meanings: [['x']], note: null } }],
      unchanged: [entry(7, 'c'), entry(8, 'd'), entry(9, 'e')],
      missing: [{ id: 9, headword: 'z', meanings: [['q']], note: null }],
    };
    const text = report({ rowsRead: 6, issues, plan });
    expect(text).toContain('  Rows read         : 6\n');
    expect(text).toContain('  Added             : 1\n');
    expect(text).toContain('  Updated           : 1\n');
    expect(text).toContain('  Unchanged         : 3\n');
    expect(text).toContain('  Missing in Excel  : 1     (kept in DB, not deleted)\n');
    expect(text).toContain('  Warnings          : 2\n');
    expect(text).toContain('  Errors            : 1\n');
  });

  it('puts the sections in the order Summary, Errors, Warnings, Updated, Added, Missing', () => {
    const text = report();
    const order = ['Summary', 'Errors', 'Warnings', 'Updated', 'Added', 'Missing in Excel'].map((title) =>
      text.indexOf(`\n${title}\n`),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('says (none) for a section without entries', () => {
    const text = report();
    expect(text).toContain('\nErrors\n  (none)\n');
    expect(text).toContain('\nWarnings\n  (none)\n');
    expect(text).toContain('\nUpdated\n  (none)\n');
  });
});

describe('renderReport: details', () => {
  it('lists issues with their row, and sheet-level problems as "sheet"', () => {
    const text = report({
      issues: [
        { level: 'error', message: 'Required column "단어" not found in the header row.' },
        { level: 'error', row: 12, message: 'duplicate headword "taurus" (first seen on row 3)' },
        { level: 'warning', row: 31, message: '뜻1: unbalanced parenthesis in "sich (setzen"' },
      ],
    });
    expect(text).toContain('Errors\n  sheet     Required column "단어" not found in the header row.\n  row 12    duplicate headword "taurus" (first seen on row 3)\n');
    expect(text).toContain('Warnings\n  row 31    뜻1: unbalanced parenthesis in "sich (setzen"\n');
  });

  it('shows before and after for an updated word, only for what changed', () => {
    const plan: Plan = {
      ...emptyPlan,
      updated: [
        {
          entry: entry(31, 'plēnus, a, um (m. Gen.)', [['voll (von / mit)', 'erfüllt']], null),
          before: { id: 1, headword: 'plēnus, a, um (m. Gen.)', meanings: [['voll (von / mit)']], note: null },
        },
        {
          entry: entry(40, 'taurus', [['Stier']], 'Nomen'),
          before: { id: 2, headword: 'taurus', meanings: [['Stier']], note: null },
        },
      ],
    };
    const text = report({ plan });
    expect(text).toContain(
      'Updated\n' +
        '  row 31    plēnus, a, um (m. Gen.)\n' +
        '            meanings : [voll (von / mit)]  ->  [voll (von / mit), erfüllt]\n' +
        '  row 40    taurus\n' +
        '            note     : (none)  ->  Nomen\n',
    );
    expect(text).not.toContain('meanings : [Stier]');
  });

  it('lists added and missing words', () => {
    const plan: Plan = {
      ...emptyPlan,
      added: [entry(2, 'capere, capiō'), entry(3, 'taurus')],
      missing: [{ id: 5, headword: 'gravis, e', meanings: [['schwer']], note: null }],
    };
    const text = report({ plan });
    expect(text).toContain('Added\n  row 2     capere, capiō\n  row 3     taurus\n');
    expect(text).toContain('Missing in Excel\n  gravis, e\n');
  });

  it('shows at most 30 missing words and counts the rest, while the summary has the full number', () => {
    const missing = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, headword: `word ${i + 1}`, meanings: [['x']], note: null }));
    const text = report({ plan: { ...emptyPlan, missing } });
    expect(text).toContain('  Missing in Excel  : 45     (kept in DB, not deleted)');
    expect(text).toContain('  word 30');
    expect(text).not.toContain('  word 31');
    expect(text).toContain('  ... and 15 more (they stay in the database)');
  });

  it('lists all missing words up to the limit without a summary line', () => {
    const missing = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, headword: `word ${i + 1}`, meanings: [['x']], note: null }));
    const text = report({ plan: { ...emptyPlan, missing } });
    expect(text).toContain('  word 30');
    expect(text).not.toContain('more (they stay');
  });

  it('keeps macrons, umlauts and Korean intact', () => {
    const text = report({ plan: { ...emptyPlan, added: [entry(2, 'Prōmētheus, Prōmēthei', [['Göttersohn']])] } });
    expect(text).toContain('Prōmētheus, Prōmēthei');
    expect(text).toContain('(sheet: Wortschatz)');
  });

  it('shows the backup path once the database was backed up', () => {
    const text = report({ mode: 'apply', outcome: 'applied', backupPath: 'data/backup/latin.20260920-152031.db' });
    expect(text).toContain('Backup   : data/backup/latin.20260920-152031.db\nTime');
    expect(report()).not.toContain('Backup');
  });
});

describe('renderReport: result line', () => {
  it('says NOT applied when there are errors', () => {
    expect(report({ outcome: 'not-applied' })).toContain('Result: NOT applied. Fix the errors in the Excel file and run again.\n');
  });

  it('tells how to apply after a clean validation, with a tip for existing databases', () => {
    const merge = report({ outcome: 'ok-to-apply' });
    expect(merge).toContain('Result: OK to apply. Re-run with --apply to write these changes.\n');
    expect(merge).toContain('Tip: stop the Word Quiz server');
    const fresh = report({ outcome: 'ok-to-apply', target: { name: 'x.db', kind: 'new' } });
    expect(fresh).not.toContain('Tip:');
  });

  it('counts what was applied', () => {
    const plan: Plan = { ...emptyPlan, added: [entry(2, 'a'), entry(3, 'b')], updated: [{ entry: entry(4, 'c'), before: { id: 1, headword: 'c', meanings: [['q']], note: null } }] };
    expect(report({ outcome: 'applied', mode: 'apply', plan })).toContain('Result: APPLIED. Added 2, updated 1.\n');
  });

  it('says when there is nothing to do', () => {
    expect(report({ outcome: 'nothing-to-apply' })).toContain('Result: Nothing to apply. The database already matches the Excel file.\n');
  });
});
