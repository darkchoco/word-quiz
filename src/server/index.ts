// Smoke-test server (M0): proves that the single-file bundle runs with node:sqlite,
// including on Windows. The real server replaces this in M4.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { appHome, dataDir } from './paths';

function readPort(): number {
  const i = process.argv.indexOf('--port');
  const raw = i >= 0 ? process.argv[i + 1] : process.env['PORT'];
  const port = Number(raw ?? 35000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${raw}`);
    process.exit(2);
  }
  return port;
}

const port = readPort();
const home = appHome();
let db: DatabaseSync | undefined;
let sqliteVersion = 'unknown';
const dbFile = path.join(dataDir(home), 'smoke.db');

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const body = JSON.stringify({
      ok: true,
      platform: process.platform,
      node: process.version,
      sqlite: sqliteVersion,
      appHome: home,
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(body);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Word Quiz may already be running.`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, '0.0.0.0', () => {
  // Open a real DB file only after listen succeeded, so a second instance never touches it.
  fs.mkdirSync(dataDir(home), { recursive: true });
  db = new DatabaseSync(dbFile);
  db.exec('CREATE TABLE IF NOT EXISTS smoke (id INTEGER PRIMARY KEY, word TEXT NOT NULL)');
  db.prepare('INSERT INTO smoke (word) VALUES (?)').run('capiō, cēpī');
  const row = db.prepare('SELECT COUNT(*) AS n, sqlite_version() AS v FROM smoke').get() as
    | { n: number; v: string }
    | undefined;
  sqliteVersion = row?.v ?? 'unknown';
  console.log(`Listening on ${port} (home: ${home}, sqlite ${sqliteVersion}, rows ${row?.n})`);
});

function shutdown(): void {
  server.close();
  // On Windows an open DB file cannot be deleted, so close before removing.
  db?.close();
  fs.rmSync(dbFile, { force: true });
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
