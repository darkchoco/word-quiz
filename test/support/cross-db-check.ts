// Dev-only, run by scripts/win-db-check.sh: one half of a cross-platform round trip. Creates or
// verifies a database at a path that both WSL and a Windows node.exe can reach (/mnt/c), using the
// real application code (createDatabase/openDatabase), never opened by both sides at once
// (TECH-SPEC 8.5, "OS를 넘나드는 DB 접근").
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDatabase, openDatabase } from '../../src/server/db/open';
import { getAllWords, insertWord } from '../../src/server/db/queries';

const mode = process.argv[2];
const file = process.argv[3];
const WORDS: { headword: string; meanings: string[][] }[] = [
  { headword: 'Prōmētheus, Prōmēthei', meanings: [['Prometheus']] },
  { headword: 'lītus, lītoris n', meanings: [['Ufer', 'Küste']] },
];

if (mode === 'create' && file) {
  fs.rmSync(file, { force: true }); // a previous run may have left this behind
  const db = createDatabase(file, 'latin');
  for (const w of WORDS) insertWord(db, w);
  db.close();
  console.log(`created ${file} with ${WORDS.length} words`);
} else if (mode === 'verify' && file) {
  const db = openDatabase(file, { readOnly: true });
  const words = getAllWords(db).map((w) => w.headword);
  db.close();
  assert.deepEqual(words, WORDS.map((w) => w.headword));
  console.log(`verified ${file}: macrons intact, ${words.length} words read read-only`);
} else {
  console.error(`Usage: cross-db-check.mjs <create|verify> <db file>`);
  process.exit(2);
}
