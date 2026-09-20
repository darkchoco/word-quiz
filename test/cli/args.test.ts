import { describe, expect, it } from 'vitest';
import { parseCliArgs, USAGE, type ParsedArgs } from '../../src/cli/args';
import { CliError } from '../../src/cli/errors';

function options(argv: string[]) {
  const parsed: ParsedArgs = parseCliArgs(argv);
  if (parsed.kind !== 'run') throw new Error('expected a run');
  return parsed.options;
}
function failure(argv: string[]): string {
  try {
    parseCliArgs(argv);
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    return (error as CliError).message;
  }
  throw new Error('expected an error');
}

describe('valid command lines', () => {
  it('merges into an existing database', () => {
    expect(options(['words.xlsx', '--db', 'latin.db'])).toEqual({
      file: 'words.xlsx',
      target: { kind: 'merge', name: 'latin.db' },
      apply: false,
      sheet: undefined,
      report: undefined,
    });
  });

  it('creates a new database in a given language', () => {
    const o = options(['words.xlsx', '--new-db', 'latin_2', '--lang', 'latin']);
    expect(o.target).toEqual({ kind: 'new', name: 'latin_2.db', language: 'latin' });
  });

  it('accepts every option in any order, and --name=value', () => {
    const o = options(['--apply', '--report=out/r.txt', '--sheet', 'Wortschatz', '--db=latin', 'words.xlsx']);
    expect(o).toMatchObject({ file: 'words.xlsx', apply: true, sheet: 'Wortschatz', report: 'out/r.txt' });
    expect(o.target).toEqual({ kind: 'merge', name: 'latin.db' });
  });

  it('adds .db only when it is missing', () => {
    expect(options(['f.xlsx', '--db', 'latin.db']).target).toMatchObject({ name: 'latin.db' });
    expect(options(['f.xlsx', '--db', 'latin']).target).toMatchObject({ name: 'latin.db' });
  });

  it('shows the help for --help and -h, even when the rest of the command line is incomplete', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['-h'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['f.xlsx', '--db', 'a', '--new-db', 'b', '-h'])).toEqual({ kind: 'help' });
  });

  it('still rejects an unknown option next to --help', () => {
    expect(() => parseCliArgs(['f.xlsx', '--bogus', '-h'])).toThrow(CliError);
  });

  it('has a usage text that names every option', () => {
    for (const word of ['--db', '--new-db', '--lang', '--apply', '--sheet', '--report', '--help', 'import.bat']) {
      expect(USAGE).toContain(word);
    }
  });
});

describe('command lines that are refused', () => {
  it.each([
    [[], 'Give exactly one Excel file'],
    [['a.xlsx', 'b.xlsx', '--db', 'x'], 'Give exactly one Excel file'],
    [['f.xlsx'], 'Choose a target'],
    [['f.xlsx', '--db', 'a', '--new-db', 'b', '--lang', 'latin'], 'either --db or --new-db'],
    [['f.xlsx', '--new-db', 'b'], '--new-db needs --lang'],
    [['f.xlsx', '--db', 'a', '--lang', 'latin'], '--lang only goes with --new-db'],
    [['f.xlsx', '--new-db', 'b', '--lang', 'english'], 'Unsupported language "english"'],
  ])('%j -> %s', (argv, message) => {
    expect(failure(argv as string[])).toContain(message);
  });

  it('rejects an unknown option and points to --help', () => {
    const message = failure(['f.xlsx', '--db', 'a', '--bogus']);
    expect(message).toContain('--bogus');
    expect(message).toContain('--help');
  });

  it('rejects an option that is missing its value', () => {
    expect(failure(['f.xlsx', '--db'])).toContain('--db');
  });

  it.each(['../evil', 'a/b', 'a b', 'con', 'NUL', 'x.txt', '', 'a'.repeat(65), 'latin.DB'])(
    'rejects the database name %j',
    (name) => {
      expect(failure(['f.xlsx', '--new-db', name, '--lang', 'latin'])).toContain('not a valid database name');
      expect(failure(['f.xlsx', '--db', name])).toContain('not a valid database name');
    },
  );
});
