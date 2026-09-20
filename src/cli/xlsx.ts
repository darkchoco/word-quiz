import path from 'node:path';
import readXlsx from 'read-excel-file/node';
import { CliError } from './errors';

/**
 * What a worksheet cell can hold. Empty cells are null. (The parser's own typings declare a
 * date cell as the Date constructor, so the type is declared here instead.)
 */
export type Cell = string | number | boolean | Date | null;

export interface Workbook {
  sheetName: string;
  /** Row 0 is Excel row 1. Empty rows in the middle are kept as rows of nulls. */
  rows: Cell[][];
}

/**
 * Reads one worksheet: the one called `sheet` (ignoring case), or the first one.
 * Problems are reported as CliError with a message that says what to do.
 */
export async function readWorkbook(file: string, sheet?: string): Promise<Workbook> {
  if (path.extname(file).toLowerCase() === '.xls') {
    throw new CliError(`Only .xlsx files are supported. Save "${file}" as .xlsx in Excel first.`);
  }

  let sheets: { sheet: string; data: unknown }[];
  try {
    sheets = (await readXlsx(file)) as { sheet: string; data: unknown }[];
  } catch (error) {
    throw explain(file, error);
  }

  const first = sheets[0];
  if (!first) throw new CliError(`The workbook "${file}" has no sheets.`);

  let chosen = first;
  if (sheet !== undefined) {
    const found = sheets.find((s) => s.sheet.toLowerCase() === sheet.toLowerCase());
    if (!found) {
      throw new CliError(
        `Sheet not found: ${sheet}. Available sheets: ${sheets.map((s) => s.sheet).join(', ')}`,
      );
    }
    chosen = found;
  }
  return { sheetName: chosen.sheet, rows: chosen.data as Cell[][] };
}

function explain(file: string, error: unknown): CliError {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ENOENT') return new CliError(`File not found: ${file}`, { cause: error });
  if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
    return new CliError(`Cannot read "${file}". Close the file in Excel and try again.`, {
      cause: error,
    });
  }
  if ((error as Error).name === 'InvalidInputError') {
    return new CliError(`"${file}" is not a valid .xlsx file. Only .xlsx files are supported.`, {
      cause: error,
    });
  }
  return new CliError(`Cannot read "${file}": ${(error as Error).message}`, { cause: error });
}
