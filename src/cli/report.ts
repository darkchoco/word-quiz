import type { Plan } from './plan';
import type { Issue } from './validate';

export type Outcome = 'ok-to-apply' | 'not-applied' | 'applied' | 'nothing-to-apply';

export interface ReportInput {
  file: string;
  sheet: string;
  target: { name: string; kind: 'merge' | 'new' };
  mode: 'validate' | 'apply';
  now: Date;
  rowsRead: number;
  issues: readonly Issue[];
  plan: Plan;
  outcome: Outcome;
  /** Where the database was backed up before the changes, if it was. */
  backupPath: string | null;
}

const two = (n: number): string => String(n).padStart(2, '0');

/** Local time as yyyyMMdd-HHmmss, used in file names. */
export function formatTimestamp(d: Date): string {
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
}

/** Local time as yyyy-MM-dd HH:mm:ss, used inside the report. */
export function formatDateTime(d: Date): string {
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

/** Meaning groups as shown to the user: `[fassen, nehmen] [erobern]`. */
export function formatGroups(groups: readonly (readonly string[])[]): string {
  return groups.map((group) => `[${group.join(', ')}]`).join(' ');
}

/**
 * The list of words that are only in the database is informational and can be very long, for
 * example when a second Excel file is merged into a database that holds the first one. The
 * summary always has the full count.
 */
const MAX_MISSING_SHOWN = 30;

const LABEL_WIDTH = 10;
const rowLabel = (row: number | undefined): string =>
  (row === undefined ? 'sheet' : `row ${row}`).padEnd(LABEL_WIDTH);

/**
 * The text of an import report. The same text goes to the console and to the report file.
 * It ends with exactly one line break.
 */
export function renderReport(input: ReportInput): string {
  const { plan, issues } = input;
  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  const lines: string[] = [];
  const section = (title: string, body: string[]): void => {
    lines.push('', title, ...(body.length > 0 ? body : ['  (none)']));
  };

  lines.push('Word Quiz Import Report', '=======================');
  lines.push(`File     : ${input.file}  (sheet: ${input.sheet})`);
  lines.push(
    `Target   : ${input.target.name} (${input.target.kind === 'merge' ? 'merge into existing database' : 'new database'})`,
  );
  lines.push(`Mode     : ${input.mode === 'validate' ? 'VALIDATE (no changes made)' : 'APPLY'}`);
  if (input.backupPath !== null) lines.push(`Backup   : ${input.backupPath}`);
  lines.push(`Time     : ${formatDateTime(input.now)}`);

  lines.push('', 'Summary');
  lines.push(`  Rows read         : ${input.rowsRead}`);
  lines.push(`  Added             : ${plan.added.length}`);
  lines.push(`  Updated           : ${plan.updated.length}`);
  lines.push(`  Unchanged         : ${plan.unchanged.length}`);
  lines.push(`  Missing in Excel  : ${plan.missing.length}     (kept in DB, not deleted)`);
  lines.push(`  Warnings          : ${warnings.length}`);
  lines.push(`  Errors            : ${errors.length}`);

  const issueLine = (issue: Issue): string => `  ${rowLabel(issue.row)}${issue.message}`;
  section('Errors', errors.map(issueLine));
  section('Warnings', warnings.map(issueLine));

  const indent = ' '.repeat(2 + LABEL_WIDTH);
  section(
    'Updated',
    plan.updated.flatMap(({ entry, before }) => {
      const out = [`  ${rowLabel(entry.row)}${entry.headword}`];
      if (JSON.stringify(entry.meanings) !== JSON.stringify(before.meanings)) {
        out.push(`${indent}meanings : ${formatGroups(before.meanings)}  ->  ${formatGroups(entry.meanings)}`);
      }
      if ((entry.note ?? '') !== (before.note ?? '')) {
        out.push(`${indent}note     : ${before.note ?? '(none)'}  ->  ${entry.note ?? '(none)'}`);
      }
      return out;
    }),
  );
  section('Added', plan.added.map((entry) => `  ${rowLabel(entry.row)}${entry.headword}`));
  const shownMissing = plan.missing.slice(0, MAX_MISSING_SHOWN).map((word) => `  ${word.headword}`);
  if (plan.missing.length > MAX_MISSING_SHOWN) {
    shownMissing.push(`  ... and ${plan.missing.length - MAX_MISSING_SHOWN} more (they stay in the database)`);
  }
  section('Missing in Excel', shownMissing);

  lines.push('');
  switch (input.outcome) {
    case 'not-applied':
      lines.push('Result: NOT applied. Fix the errors in the Excel file and run again.');
      break;
    case 'ok-to-apply':
      lines.push('Result: OK to apply. Re-run with --apply to write these changes.');
      if (input.target.kind === 'merge') {
        lines.push('Tip: stop the Word Quiz server before applying if you can. Changes are also safe while it runs.');
      }
      break;
    case 'applied':
      lines.push(`Result: APPLIED. Added ${plan.added.length}, updated ${plan.updated.length}.`);
      break;
    case 'nothing-to-apply':
      lines.push('Result: Nothing to apply. The database already matches the Excel file.');
      break;
  }
  return `${lines.join('\n')}\n`;
}
