// Smoke-test CLI (M0): proves that the xlsx reader bundles and reads UTF-8 correctly.
// The real import CLI replaces this in M3.
import { readSheet } from 'read-excel-file/node';

const file = process.argv[2];
if (!file) {
  console.error('Usage: import.mjs <file.xlsx>');
  process.exit(2);
}

const rows = await readSheet(file);
console.log(`header: ${JSON.stringify(rows[0])}`);
console.log(`rows: ${rows.length - 1}`);
for (const row of rows.slice(1, 4)) console.log(`sample: ${JSON.stringify(row[0])}`);
