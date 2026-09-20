import { strToU8, zipSync } from 'fflate';
import fs from 'node:fs';

export type TestCell = string | number | null;
export interface TestSheet {
  name: string;
  rows: TestCell[][];
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const column = (index: number) => String.fromCharCode(65 + index);

/**
 * Builds a minimal .xlsx (workbook, worksheets, shared strings) without any spreadsheet
 * library. Strings go through the shared string table like a real file; null cells are left out.
 */
export function makeXlsx(sheets: TestSheet[]): Uint8Array {
  const strings: string[] = [];
  const stringIndex = (text: string): number => {
    let index = strings.indexOf(text);
    if (index < 0) {
      strings.push(text);
      index = strings.length - 1;
    }
    return index;
  };

  const sheetXml = (rows: TestCell[][]): string =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows
      .map(
        (row, r) =>
          `<row r="${r + 1}">` +
          row
            .map((value, c) => {
              const ref = `${column(c)}${r + 1}`;
              if (value === null) return '';
              if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
              return `<c r="${ref}" t="s"><v>${stringIndex(value)}</v></c>`;
            })
            .join('') +
          '</row>',
      )
      .join('') +
    '</sheetData></worksheet>';

  const sheetXmls = sheets.map((sheet) => sheetXml(sheet.rows));
  const ns = 'http://schemas.openxmlformats.org';
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="${ns}/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>` +
        sheets
          .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${ns}/package/2006/relationships">` +
        sheets
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="${ns}/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    ),
    'xl/sharedStrings.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="${ns}/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">` +
        strings.map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join('') +
        '</sst>',
    ),
  };
  sheetXmls.forEach((xml, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xml);
  });
  return zipSync(files);
}

/** Writes a workbook to disk and returns the path. */
export function writeXlsx(file: string, sheets: TestSheet[]): string {
  fs.writeFileSync(file, makeXlsx(sheets));
  return file;
}

/** The standard header row of a word list. */
export const HEADER: TestCell[] = ['단어', '뜻1', '뜻2', '뜻3', '뜻4', '노트'];
