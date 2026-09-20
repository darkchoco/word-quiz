import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CliError } from '../../src/cli/errors';
import { readWorkbook } from '../../src/cli/xlsx';
import { HEADER, writeXlsx } from '../support/xlsx';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();

async function failure(promise: Promise<unknown>): Promise<CliError> {
  try {
    await promise;
  } catch (error) {
    return error as CliError;
  }
  throw new Error('Expected a failure');
}

describe('readWorkbook', () => {
  it('reads strings, numbers and empty cells, and keeps Excel row positions', async () => {
    const file = writeXlsx(path.join(t.dir(), 'words.xlsx'), [
      {
        name: 'Wortschatz',
        rows: [HEADER, ['capiō, cēpī', 'fassen', null, null, null, 'Nomen'], [null, null, null, null, null, null], [42, 'Zahl', null, null, null, null]],
      },
    ]);
    const { sheetName, rows } = await readWorkbook(file);
    expect(sheetName).toBe('Wortschatz');
    expect(rows[0]).toEqual(HEADER);
    expect(rows[1]).toEqual(['capiō, cēpī', 'fassen', null, null, null, 'Nomen']);
    expect(rows[2]?.every((cell) => cell === null)).toBe(true);
    expect(rows[3]?.[0]).toBe(42);
  });

  it('reads the first sheet by default', async () => {
    const file = writeXlsx(path.join(t.dir(), 'words.xlsx'), [
      { name: 'First', rows: [['a']] },
      { name: 'Second', rows: [['b']] },
    ]);
    expect((await readWorkbook(file)).sheetName).toBe('First');
  });

  it('picks a sheet by name, ignoring case', async () => {
    const file = writeXlsx(path.join(t.dir(), 'words.xlsx'), [
      { name: 'First', rows: [['a']] },
      { name: 'Second', rows: [['b']] },
    ]);
    const { sheetName, rows } = await readWorkbook(file, 'second');
    expect(sheetName).toBe('Second');
    expect(rows).toEqual([['b']]);
  });

  it('lists the available sheets when the requested one does not exist', async () => {
    const file = writeXlsx(path.join(t.dir(), 'words.xlsx'), [
      { name: 'First', rows: [['a']] },
      { name: 'Second', rows: [['b']] },
    ]);
    const error = await failure(readWorkbook(file, 'Nope'));
    expect(error).toBeInstanceOf(CliError);
    expect(error.message).toBe('Sheet not found: Nope. Available sheets: First, Second');
  });

  it('says so when the file does not exist', async () => {
    const error = await failure(readWorkbook(path.join(t.dir(), 'missing.xlsx')));
    expect(error).toBeInstanceOf(CliError);
    expect(error.message).toMatch(/^File not found: /);
  });

  it('rejects a file that is not an .xlsx', async () => {
    const file = path.join(t.dir(), 'fake.xlsx');
    fs.writeFileSync(file, 'this is not a zip file');
    const error = await failure(readWorkbook(file));
    expect(error).toBeInstanceOf(CliError);
    expect(error.message).toMatch(/is not a valid \.xlsx file/);
  });

  it('asks to save an old .xls file as .xlsx without trying to read it', async () => {
    const file = path.join(t.dir(), 'old.xls');
    fs.writeFileSync(file, 'binary');
    const error = await failure(readWorkbook(file));
    expect(error.message).toMatch(/Only \.xlsx files are supported/);
    expect(error.message).toMatch(/Save .* as \.xlsx/);
  });

  it('returns no rows for an empty sheet', async () => {
    const file = writeXlsx(path.join(t.dir(), 'empty.xlsx'), [{ name: 'Empty', rows: [] }]);
    expect((await readWorkbook(file)).rows).toEqual([]);
  });
});
