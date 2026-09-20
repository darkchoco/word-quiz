import { parseArgs } from 'node:util';
import type { Language } from '../shared/api';
import { isValidDbName } from '../server/db/names';
import { CliError } from './errors';

export interface CliOptions {
  file: string;
  target: { kind: 'merge'; name: string } | { kind: 'new'; name: string; language: Language };
  apply: boolean;
  sheet: string | undefined;
  report: string | undefined;
}

export type ParsedArgs = { kind: 'help' } | { kind: 'run'; options: CliOptions };

export const USAGE = `Usage:
  import <file.xlsx> --db <name> [--apply] [options]
  import <file.xlsx> --new-db <name> --lang latin [--apply] [options]

Checks a word list in an Excel file and imports it into a Word Quiz database.
Without --apply nothing is changed: the file is only checked and a report is written.

Target (choose one):
  --db <name>        Merge into an existing database, for example --db latin.db
  --new-db <name>    Create a new database, for example --new-db latin_2 (".db" is added)
  --lang <language>  Language of a new database. Required with --new-db. Supported: latin

Options:
  --apply            Write the changes. This only happens when the file has no errors.
  --sheet <name>     Sheet to read (default: the first sheet)
  --report <path>    Where to save the report (default: reports/<file>_<date-time>.txt)
  -h, --help         Show this help

Exit codes: 0 ok, 1 the file has errors, 2 wrong usage or a problem with a file or database.
On Windows start it with import.bat so that the console shows accented letters correctly.
`;

const HINT = 'Run with --help to see how to use it.';

function databaseName(raw: string, option: string): string {
  const name = raw.toLowerCase().endsWith('.db') ? raw : `${raw}.db`;
  if (!isValidDbName(name)) {
    throw new CliError(
      `"${raw}" is not a valid database name for ${option}. Use 1 to 64 letters, digits, "_" or "-" ` +
        `(for example latin_2), and not a Windows device name such as con.`,
    );
  }
  return name;
}

/** Reads the command line. Anything wrong is reported as a CliError that says how to fix it. */
export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        db: { type: 'string' },
        'new-db': { type: 'string' },
        lang: { type: 'string' },
        apply: { type: 'boolean' },
        sheet: { type: 'string' },
        report: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    const firstSentence = (error as Error).message.split('. ')[0] ?? 'Invalid arguments';
    throw new CliError(`${firstSentence}. ${HINT}`, { cause: error });
  }

  const { values, positionals } = parsed;
  if (values.help) return { kind: 'help' };

  if (positionals.length !== 1) {
    throw new CliError(`Give exactly one Excel file to import. ${HINT}`);
  }
  const file = positionals[0] as string;

  if (values.db !== undefined && values['new-db'] !== undefined) {
    throw new CliError(`Use either --db or --new-db, not both. ${HINT}`);
  }
  if (values.db === undefined && values['new-db'] === undefined) {
    throw new CliError(`Choose a target: --db <name> to merge, or --new-db <name> --lang latin. ${HINT}`);
  }

  let target: CliOptions['target'];
  if (values.db !== undefined) {
    if (values.lang !== undefined) throw new CliError(`--lang only goes with --new-db. ${HINT}`);
    target = { kind: 'merge', name: databaseName(values.db, '--db') };
  } else {
    if (values.lang === undefined) throw new CliError(`--new-db needs --lang, for example --lang latin. ${HINT}`);
    if (values.lang !== 'latin') {
      throw new CliError(`Unsupported language "${values.lang}". Supported: latin`);
    }
    target = { kind: 'new', name: databaseName(values['new-db'] as string, '--new-db'), language: 'latin' };
  }

  return {
    kind: 'run',
    options: {
      file,
      target,
      apply: values.apply === true,
      sheet: values.sheet,
      report: values.report,
    },
  };
}
