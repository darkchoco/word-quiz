import { hasUnmatchedParens, splitTop, splitTopRaw } from '../shared/grading';
import { validateMeanings } from '../shared/meanings';
import type { Cell } from './xlsx';

export interface Issue {
  level: 'error' | 'warning';
  /** Excel row number (the header is row 1). Absent for problems with the sheet as a whole. */
  row?: number;
  message: string;
}

/** One word of the Excel file that can be imported. */
export interface ImportEntry {
  row: number;
  headword: string;
  meanings: string[][];
  note: string | null;
}

export interface ParseResult {
  entries: ImportEntry[];
  issues: Issue[];
  /** Rows that had any content; empty rows are not counted. */
  rowsRead: number;
}

const HEADWORD_HEADER = '단어';
const NOTE_HEADER = '노트';
const MEANING_HEADERS = ['뜻1', '뜻2', '뜻3', '뜻4'];

const columnLetter = (index: number): string => {
  let n = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
};

interface Columns {
  headword: number;
  meanings: (number | undefined)[]; // index 0 = 뜻1
  note: number | undefined;
}

/**
 * Turns the rows of a worksheet into importable words and a list of problems.
 * Errors block `--apply`; warnings do not. Row numbers are Excel row numbers.
 */
export function parseWorkbookRows(rows: readonly (readonly Cell[])[]): ParseResult {
  const issues: Issue[] = [];
  const header = rows[0];
  if (!header) {
    issues.push({ level: 'error', message: 'The sheet is empty: no header row found.' });
    return { entries: [], issues, rowsRead: 0 };
  }

  const columns = mapHeader(header, issues);
  if (!columns) return { entries: [], issues, rowsRead: 0 };

  const entries: ImportEntry[] = [];
  const firstRowOf = new Map<string, number>();
  let rowsRead = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const excelRow = i + 1;
    const rowIssues: Issue[] = [];
    const add = (level: Issue['level'], message: string) =>
      rowIssues.push({ level, row: excelRow, message });

    const headword = textOf(row[columns.headword], HEADWORD_HEADER, add);
    const meaningCells = MEANING_HEADERS.map((name, n) => {
      const column = columns.meanings[n];
      return column === undefined ? null : textOf(row[column], name, add);
    });
    const note = columns.note === undefined ? null : textOf(row[columns.note], NOTE_HEADER, add);

    const blank = headword === null && note === null && meaningCells.every((c) => c === null);
    if (blank) continue;
    rowsRead++;

    if (headword === null) add('error', `${HEADWORD_HEADER}: the headword is empty`);

    const groups: string[][] = [];
    const filled: number[] = [];
    let hasPipe = false;
    meaningCells.forEach((cell, n) => {
      if (cell === null) return;
      const name = MEANING_HEADERS[n] as string;
      if (cell.includes('|')) {
        hasPipe = true;
        add('error', `${name}: contains "|", which separates meaning groups in the editor: "${cell}"`);
        return;
      }
      const pieces = splitTopRaw(cell);
      if (pieces.length > 1 && pieces.some((p) => p.trim() === '')) {
        add('warning', `${name}: empty synonym removed in "${cell}"`);
      }
      if (hasUnmatchedParens(cell)) {
        add('warning', `${name}: unbalanced parenthesis in "${cell}"`);
      }
      const synonyms = splitTop(cell);
      if (synonyms.length === 0) {
        add('warning', `${name}: no synonyms in "${cell}", column ignored`);
        return;
      }
      groups.push(synonyms);
      filled.push(n);
    });

    const last = filled[filled.length - 1];
    if (last !== undefined) {
      const missing = MEANING_HEADERS.slice(0, last + 1).filter((_, n) => !filled.includes(n));
      if (missing.length > 0) {
        add('warning', `meaning columns have a gap: ${missing.join(', ')} empty but a later column is filled`);
      }
    }

    if (!hasPipe) {
      const problem = validateMeanings(groups);
      if (problem === 'EMPTY') {
        add('error', `no meaning: ${MEANING_HEADERS[0]}~${MEANING_HEADERS[3]} are all empty`);
      } else if (problem !== null) {
        add('error', `the meanings cannot be stored (${problem})`);
      }
    }

    if (headword !== null) {
      const firstRow = firstRowOf.get(headword);
      if (firstRow === undefined) {
        firstRowOf.set(headword, excelRow);
      } else {
        add('error', `duplicate headword "${headword}" (first seen on row ${firstRow})`);
      }
    }

    issues.push(...rowIssues);
    if (rowIssues.every((issue) => issue.level === 'warning') && headword !== null) {
      entries.push({ row: excelRow, headword, meanings: groups, note });
    }
  }

  if (rowsRead === 0) {
    issues.push({ level: 'error', message: 'No data rows found below the header.' });
  }
  return { entries, issues, rowsRead };
}

function mapHeader(header: readonly Cell[], issues: Issue[]): Columns | null {
  const seen = new Map<string, number>();
  header.forEach((cell, index) => {
    if (typeof cell !== 'string') return;
    const name = cell.normalize('NFC').trim();
    if (name === '') return;
    const known = name === HEADWORD_HEADER || name === NOTE_HEADER || MEANING_HEADERS.includes(name);
    if (!known) {
      issues.push({ level: 'warning', message: `Column ${columnLetter(index)} "${name}" is not used and is ignored.` });
    } else if (seen.has(name)) {
      issues.push({
        level: 'warning',
        message: `Column ${columnLetter(index)} "${name}" repeats an earlier column and is ignored.`,
      });
    } else {
      seen.set(name, index);
    }
  });

  const headword = seen.get(HEADWORD_HEADER);
  const firstMeaning = seen.get(MEANING_HEADERS[0] as string);
  if (headword === undefined) {
    issues.push({ level: 'error', message: `Required column "${HEADWORD_HEADER}" not found in the header row.` });
  }
  if (firstMeaning === undefined) {
    issues.push({ level: 'error', message: `Required column "${MEANING_HEADERS[0]}" not found in the header row.` });
  }
  if (headword === undefined || firstMeaning === undefined) return null;

  return {
    headword,
    meanings: MEANING_HEADERS.map((name) => seen.get(name)),
    note: seen.get(NOTE_HEADER),
  };
}

/** Cell text as trimmed NFC, or null for an empty cell. Records what it had to change. */
function textOf(
  cell: Cell | undefined,
  column: string,
  add: (level: Issue['level'], message: string) => void,
): string | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'string') {
    const nfc = cell.normalize('NFC');
    if (nfc !== cell) add('warning', `${column}: text was converted to Unicode NFC form`);
    const trimmed = nfc.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof cell === 'number') {
    add('warning', `${column}: numeric cell ${cell} converted to text`);
    return String(cell);
  }
  add('error', `${column}: unsupported cell type (${cell instanceof Date ? 'date' : typeof cell}), enter it as text`);
  return null;
}
