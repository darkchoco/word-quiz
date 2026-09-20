// Development: the real server (bundled by esbuild) and the Vite dev server together.
//   npm run dev        server on WQ_API_PORT (default 35100) with home .wq-home, page on 35101
//   npm run dev:seed   imports the sample word list into .wq-home as latin.db first
// Both are stopped when this script ends (Ctrl+C).
import { build } from 'esbuild';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = path.join(root, '.wq-home');
const apiPort = Number(process.env.WQ_API_PORT ?? 35100);
const pagePort = Number(process.env.WQ_PAGE_PORT ?? 35101);
let stopping = false;
const seed = process.argv.includes('--seed');
const nodeFlags = ['--disable-warning=ExperimentalWarning'];
const banner =
  "import { createRequire as __wqCreateRequire } from 'node:module'; const require = __wqCreateRequire(import.meta.url);";

fs.mkdirSync(home, { recursive: true });
for (const [entry, out] of [['src/server/index.ts', 'server.mjs'], ['src/cli/index.ts', 'import.mjs']]) {
  await build({ entryPoints: [path.join(root, entry)], outfile: path.join(home, out), bundle: true, platform: 'node', format: 'esm', target: 'node22', banner: { js: banner }, logLevel: 'warning' });
}

if (seed) {
  const sample = path.join(root, 'data', 'latin_wortschatz.xlsx');
  if (!fs.existsSync(sample)) {
    console.error(`Sample word list not found: ${sample}`);
    process.exit(2);
  }
  if (fs.existsSync(path.join(home, 'data', 'latin.db'))) {
    console.log('latin.db already exists in .wq-home; delete .wq-home to start over.');
  } else {
    const result = spawnSync(process.execPath, [...nodeFlags, path.join(home, 'import.mjs'), sample, '--new-db', 'latin', '--lang', 'latin', '--apply', '--report', path.join(home, 'seed-report.txt')], { env: { ...process.env, WORDQUIZ_HOME: home }, stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status ?? 2);
  }
}

const server = spawn(process.execPath, [...nodeFlags, path.join(home, 'server.mjs'), '--port', String(apiPort), '--no-open'], { env: { ...process.env, WORDQUIZ_HOME: home }, stdio: 'inherit' });
server.on('exit', (code) => {
  if (!stopping) {
    console.error(`The server stopped (exit code ${code}).`);
    stop(code ?? 1);
  }
});

const { createServer } = await import('vite');
const vite = await createServer({ configFile: path.join(root, 'vite.config.ts'), server: { port: pagePort, strictPort: true } });
await vite.listen();
vite.printUrls();


function stop(code = 0) {
  stopping = true;
  server.kill('SIGTERM');
  void vite.close().finally(() => process.exit(code));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
