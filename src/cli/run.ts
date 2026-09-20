import fs from 'node:fs';
import path from 'node:path';
import { findExistingDbName } from '../server/db/names';
import { listDatabases, resolveDatabase } from '../server/db/catalog';
import { openDatabase } from '../server/db/open';
import { getAllWords } from '../server/db/queries';
import { AppError } from '../server/errors';
import { dataDir, reportsDir } from '../server/paths';
import { applyImport, type ApplyTarget } from './apply';
import { parseCliArgs, USAGE, type CliOptions } from './args';
import { CliError } from './errors';
import { buildPlan } from './plan';
import { formatTimestamp, renderReport, type Outcome } from './report';
import { parseWorkbookRows } from './validate';
import { readWorkbook } from './xlsx';

export interface RunEnv {
  /** Application home: the folder that holds data/ and reports/. */
  home: string;
  now: Date;
  out: (text: string) => void;
  err: (text: string) => void;
}

/**
 * Runs the import command and returns the exit code:
 * 0 fine (warnings are allowed), 1 the Excel file has errors, 2 wrong usage or a file or
 * database problem.
 */
export async function runImport(argv: readonly string[], env: RunEnv): Promise<number> {
  try {
    return await execute(argv, env);
  } catch (error) {
    env.err(`${explainError(error)}\n`);
    return 2;
  }
}

/** A message for the user for anything that can go wrong. */
export function explainError(error: unknown): string {
  if (error instanceof CliError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/database is locked|SQLITE_BUSY/i.test(message)) {
    return 'The database is busy. Stop the Word Quiz server and try again.';
  }
  if (error instanceof AppError) return message;
  return `Unexpected error: ${message}`;
}

async function execute(argv: readonly string[], env: RunEnv): Promise<number> {
  const parsed = parseCliArgs(argv);
  if (parsed.kind === 'help') {
    env.out(USAGE);
    return 0;
  }
  const options = parsed.options;
  const dir = dataDir(env.home);
  const target = resolveTarget(options.target, dir);

  const workbook = await readWorkbook(options.file, options.sheet);
  const { entries, issues, rowsRead } = parseWorkbookRows(workbook.rows);
  const existing = target.kind === 'merge' ? readExisting(target.file) : null;
  const plan = buildPlan(entries, existing);

  const errorCount = issues.filter((issue) => issue.level === 'error').length;
  const changes = plan.added.length + plan.updated.length;
  let outcome: Outcome;
  let backupPath: string | null = null;
  if (errorCount > 0) {
    outcome = 'not-applied';
  } else if (changes === 0) {
    outcome = 'nothing-to-apply';
  } else if (!options.apply) {
    outcome = 'ok-to-apply';
  } else {
    backupPath = applyImport(target, plan, env.now).backupPath;
    outcome = 'applied';
  }

  const report = renderReport({
    file: options.file,
    sheet: workbook.sheetName,
    target: { name: path.basename(target.file), kind: target.kind },
    mode: options.apply ? 'apply' : 'validate',
    now: env.now,
    rowsRead,
    issues,
    plan,
    outcome,
    backupPath,
  });
  env.out(report);
  const saved = saveReport(reportPathFor(options, env), report, env);
  if (saved !== null) env.out(`Report saved to: ${saved}\n`);

  return errorCount > 0 ? 1 : 0;
}

function resolveTarget(target: CliOptions['target'], dir: string): ApplyTarget {
  if (target.kind === 'merge') {
    try {
      return { kind: 'merge', file: resolveDatabase(dir, target.name) };
    } catch (error) {
      if (error instanceof AppError && error.code === 'DB_NOT_FOUND') {
        const available = listDatabases(dir).databases.map((d) => d.name);
        throw new CliError(
          `Database not found: ${target.name}. ` +
            (available.length > 0 ? `Available databases: ${available.join(', ')}` : `There are no databases in ${dir} yet.`),
        );
      }
      throw error;
    }
  }
  const existing = findExistingDbName(dir, target.name);
  if (existing !== undefined) {
    throw new CliError(
      `A database named ${existing} already exists (names are compared ignoring case). ` +
        `Use --db ${existing} to merge into it, or choose another name.`,
    );
  }
  return { kind: 'new', file: path.join(dir, target.name), language: target.language };
}

function readExisting(file: string) {
  const db = openDatabase(file, { readOnly: true });
  try {
    return getAllWords(db);
  } finally {
    db.close();
  }
}

function reportPathFor(options: CliOptions, env: RunEnv): string {
  if (options.report !== undefined) return path.resolve(options.report);
  const stem = path.basename(options.file, path.extname(options.file));
  return path.join(reportsDir(env.home), `${stem}_${formatTimestamp(env.now)}.txt`);
}

/**
 * Saves the report as UTF-8. A report that cannot be saved must not hide the result of an
 * import that already happened, so this only warns.
 */
function saveReport(file: string, text: string, env: RunEnv): string | null {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
    return file;
  } catch (error) {
    env.err(`Warning: the report could not be saved to ${file}: ${(error as Error).message}\n`);
    return null;
  }
}
