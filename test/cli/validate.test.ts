import { describe, expect, it } from 'vitest';
import { parseWorkbookRows } from '../../src/cli/validate';
import type { Cell } from '../../src/cli/xlsx';
import { HEADER } from '../support/xlsx';

const parse = (...dataRows: Cell[][]) => parseWorkbookRows([HEADER, ...dataRows]);
const errors = (result: ReturnType<typeof parse>) => result.issues.filter((i) => i.level === 'error');
const warnings = (result: ReturnType<typeof parse>) => result.issues.filter((i) => i.level === 'warning');
const messages = (issues: { message: string }[]) => issues.map((i) => i.message);

describe('a clean file', () => {
  it('turns each row into a word with meaning groups and a note', () => {
    const result = parse(
      ['capere, capiō, cēpī, captum', 'fassen, nehmen', 'erobern', null, null, 'Verb'],
      ['taurus', 'Stier', null, null, null, null],
    );
    expect(result.issues).toEqual([]);
    expect(result.rowsRead).toBe(2);
    expect(result.entries).toEqual([
      { row: 2, headword: 'capere, capiō, cēpī, captum', meanings: [['fassen', 'nehmen'], ['erobern']], note: 'Verb' },
      { row: 3, headword: 'taurus', meanings: [['Stier']], note: null },
    ]);
  });

  it('keeps commas inside parentheses within one synonym', () => {
    const result = parse(
      ['Prōmētheus', 'Prometheus (Göttersohn, Schöpfer der Menschen)', null, null, null, null],
      ['secundus', 'der (die, das) zweite', 'günstig', null, null, null],
    );
    expect(result.issues).toEqual([]);
    expect(result.entries[0]?.meanings).toEqual([['Prometheus (Göttersohn, Schöpfer der Menschen)']]);
    expect(result.entries[1]?.meanings).toEqual([['der (die, das) zweite'], ['günstig']]);
  });

  it('numbers rows the way Excel does (the header is row 1)', () => {
    const result = parse(['a', 'x', null, null, null, null], ['b', 'y', null, null, null, null]);
    expect(result.entries.map((e) => e.row)).toEqual([2, 3]);
  });

  it('accepts a "|" in the headword or the note, only meanings are checked', () => {
    const result = parse(['a | b', 'x', null, null, null, 'see a | b']);
    expect(result.issues).toEqual([]);
    expect(result.entries[0]?.headword).toBe('a | b');
  });

  it('stores an empty note as null', () => {
    expect(parse(['a', 'x', null, null, null, '   ']).entries[0]?.note).toBeNull();
  });
});

describe('the header row', () => {
  it('finds columns by name, whatever their order', () => {
    const result = parseWorkbookRows([
      ['노트', '뜻2', '뜻1', '단어'],
      ['a note', 'second', 'first', 'word'],
    ]);
    expect(result.issues).toEqual([]);
    expect(result.entries).toEqual([{ row: 2, headword: 'word', meanings: [['first'], ['second']], note: 'a note' }]);
  });

  it('needs only the headword and the first meaning column', () => {
    const result = parseWorkbookRows([['단어', '뜻1'], ['a', 'x']]);
    expect(result.issues).toEqual([]);
    expect(result.entries).toHaveLength(1);
  });

  it('reports a missing 단어 column as an error', () => {
    const result = parseWorkbookRows([['뜻1', '노트'], ['x', 'n']]);
    expect(result.entries).toEqual([]);
    expect(messages(errors(result))).toEqual(['Required column "단어" not found in the header row.']);
  });

  it('reports a missing 뜻1 column as an error', () => {
    const result = parseWorkbookRows([['단어', '뜻2'], ['a', 'x']]);
    expect(messages(errors(result))).toEqual(['Required column "뜻1" not found in the header row.']);
  });

  it('reports both when both are missing', () => {
    expect(errors(parseWorkbookRows([['foo', 'bar']]))).toHaveLength(2);
  });

  it('warns about columns it does not know and ignores them', () => {
    const result = parseWorkbookRows([['단어', '뜻1', '메모'], ['a', 'x', 'ignored']]);
    expect(messages(warnings(result))).toEqual(['Column C "메모" is not used and is ignored.']);
    expect(result.entries).toHaveLength(1);
  });

  it('uses the first of two columns with the same name', () => {
    const result = parseWorkbookRows([['단어', '뜻1', '뜻1'], ['a', 'first', 'second']]);
    expect(messages(warnings(result))).toEqual(['Column C "뜻1" repeats an earlier column and is ignored.']);
    expect(result.entries[0]?.meanings).toEqual([['first']]);
  });

  it('ignores empty header cells silently', () => {
    const result = parseWorkbookRows([['단어', null, '뜻1'], ['a', null, 'x']]);
    expect(result.issues).toEqual([]);
  });

  it('reports an empty sheet', () => {
    const result = parseWorkbookRows([]);
    expect(messages(errors(result))).toEqual(['The sheet is empty: no header row found.']);
  });
});

describe('errors that block --apply', () => {
  it('an empty headword', () => {
    const result = parse([null, 'x', null, null, null, null]);
    expect(result.issues).toEqual([{ level: 'error', row: 2, message: '단어: the headword is empty' }]);
    expect(result.entries).toEqual([]);
  });

  it('no meaning at all', () => {
    const result = parse(['a', null, null, null, null, 'only a note']);
    expect(messages(errors(result))).toEqual(['no meaning: 뜻1~뜻4 are all empty']);
    expect(result.entries).toEqual([]);
  });

  it('a "|" in a meaning cell, naming the column', () => {
    const result = parse(['a', 'x | y', null, null, null, null]);
    expect(messages(errors(result))).toEqual([
      '뜻1: contains "|", which separates meaning groups in the editor: "x | y"',
    ]);
    expect(result.entries).toEqual([]);
  });

  it('a duplicate headword, naming both rows', () => {
    const result = parse(['taurus', 'Stier', null, null, null, null], ['gravis', 'schwer', null, null, null, null], ['taurus', 'Bulle', null, null, null, null]);
    expect(result.issues).toEqual([{ level: 'error', row: 4, message: 'duplicate headword "taurus" (first seen on row 2)' }]);
    expect(result.entries.map((e) => e.headword)).toEqual(['taurus', 'gravis']);
  });

  it('a duplicate that only differs in padding or Unicode form', () => {
    const result = parse(['capiū', 'x', null, null, null, null], ['  capiū ', 'y', null, null, null, null]);
    expect(errors(result)).toHaveLength(1);
    expect(errors(result)[0]?.row).toBe(3);
  });

  it('headwords that differ only in case are different words', () => {
    const result = parse(['Taurus', 'x', null, null, null, null], ['taurus', 'y', null, null, null, null]);
    expect(errors(result)).toEqual([]);
    expect(result.entries).toHaveLength(2);
  });

  it('a cell that is neither text nor a number', () => {
    const result = parseWorkbookRows([HEADER, ['a', true as unknown as Cell, null, null, null, null], ['b', new Date(0), null, null, null, null]]);
    // Issues come in row order: everything about row 2, then everything about row 3.
    expect(errors(result).map((i) => [i.row, i.message])).toEqual([
      [2, '뜻1: unsupported cell type (boolean), enter it as text'],
      [2, 'no meaning: 뜻1~뜻4 are all empty'],
      [3, '뜻1: unsupported cell type (date), enter it as text'],
      [3, 'no meaning: 뜻1~뜻4 are all empty'],
    ]);
  });

  it('a sheet with a header but no data rows', () => {
    const result = parseWorkbookRows([HEADER]);
    expect(messages(errors(result))).toEqual(['No data rows found below the header.']);
  });

  it('a sheet with only empty rows below the header', () => {
    const result = parse([null, null, null, null, null, null], [null, null, null, null, null, null]);
    expect(messages(errors(result))).toEqual(['No data rows found below the header.']);
    expect(result.rowsRead).toBe(0);
  });

  it('keeps going after an error so that every problem is reported at once', () => {
    const result = parse([null, 'x', null, null, null, null], ['b', null, null, null, null, null], ['c', 'ok', null, null, null, null]);
    expect(errors(result).map((i) => i.row)).toEqual([2, 3]);
    expect(result.entries.map((e) => e.headword)).toEqual(['c']);
  });
});

describe('warnings that do not block --apply', () => {
  it('a gap between meaning columns', () => {
    const result = parse(['a', 'x', null, 'z', null, null]);
    expect(messages(warnings(result))).toEqual([
      'meaning columns have a gap: 뜻2 empty but a later column is filled',
    ]);
    expect(result.entries[0]?.meanings).toEqual([['x'], ['z']]);
  });

  it('an unbalanced parenthesis in a meaning', () => {
    const result = parse(['a', 'sich (setzen', null, null, null, null]);
    expect(messages(warnings(result))).toEqual(['뜻1: unbalanced parenthesis in "sich (setzen"']);
    expect(result.entries).toHaveLength(1);
  });

  it('an empty synonym', () => {
    const result = parse(['a', 'x,,y', null, null, null, null]);
    expect(messages(warnings(result))).toEqual(['뜻1: empty synonym removed in "x,,y"']);
    expect(result.entries[0]?.meanings).toEqual([['x', 'y']]);
  });

  it('a meaning cell that has commas but no synonyms is ignored like an empty column', () => {
    const result = parse(['a', 'x', ' , ', null, null, null]);
    expect(messages(warnings(result))).toContain('뜻2: no synonyms in ",", column ignored');
    expect(result.entries[0]?.meanings).toEqual([['x']]);
  });

  it('a number in a text column becomes text', () => {
    const result = parse([1984, 'Jahr', null, null, null, null]);
    expect(messages(warnings(result))).toEqual(['단어: numeric cell 1984 converted to text']);
    expect(result.entries[0]?.headword).toBe('1984');
  });

  it('text in decomposed Unicode form is converted to NFC', () => {
    const result = parse(['capiū', 'x', null, null, null, null]);
    expect(messages(warnings(result))).toEqual(['단어: text was converted to Unicode NFC form']);
    expect(result.entries[0]?.headword).toBe('capiū');
  });

  it('warnings are attached to the row they belong to', () => {
    const result = parse(['a', 'x', null, null, null, null], ['b', 'y,,z', null, null, null, null]);
    expect(warnings(result).map((i) => i.row)).toEqual([3]);
  });
});

describe('empty rows', () => {
  it('are skipped without a message and not counted', () => {
    const result = parse(['a', 'x', null, null, null, null], [null, null, null, null, null, null], ['b', 'y', null, null, null, null]);
    expect(result.issues).toEqual([]);
    expect(result.rowsRead).toBe(2);
    expect(result.entries.map((e) => e.row)).toEqual([2, 4]);
  });

  it('include rows that only have whitespace', () => {
    const result = parse(['   ', '  ', null, null, null, null], ['a', 'x', null, null, null, null]);
    expect(result.issues).toEqual([]);
    expect(result.rowsRead).toBe(1);
  });

  it('do not include a row that has only a note', () => {
    const result = parse([null, null, null, null, null, 'stray note']);
    expect(errors(result).map((i) => i.message)).toContain('단어: the headword is empty');
    expect(result.rowsRead).toBe(1);
  });
});
