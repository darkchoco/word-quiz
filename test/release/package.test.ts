import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemp, makeDist, runScript, tempDir } from '../support/release';

afterEach(cleanTemp);

const zipOf = (file: string) => unzipSync(new Uint8Array(fs.readFileSync(file)));
const text = (bytes: Uint8Array | undefined) => Buffer.from(bytes ?? []).toString('utf8');

describe('scripts/package.mjs', () => {
  it('zips exactly the program files, at the top of the zip', () => {
    const out = path.join(tempDir(), 'WordQuiz.zip');
    const ran = runScript('package', ['--from', makeDist(), '--out', out]);
    expect(ran.status).toBe(0);
    expect(ran.stdout).toMatch(/WordQuiz\.zip .*MB, 6 files/);
    expect(Object.keys(zipOf(out)).sort()).toEqual([
      'import.bat',
      'import.mjs',
      'public/assets/app-1a2b3c.js',
      'public/index.html',
      'server.mjs',
      'start.bat',
    ]);
  });

  it('never contains user data, dependencies or the lock, and no entry uses a backslash', () => {
    const dist = makeDist();
    // things that must not travel even if they lie next to the program files
    for (const junk of ['data/latin.db', 'reports/r.txt', 'server.lock', 'node_modules/x/index.js']) {
      fs.mkdirSync(path.dirname(path.join(dist, junk)), { recursive: true });
      fs.writeFileSync(path.join(dist, junk), 'x');
    }
    const out = path.join(tempDir(), 'z.zip');
    expect(runScript('package', ['--from', dist, '--out', out]).status).toBe(0);
    const names = Object.keys(zipOf(out));
    expect(names.filter((n) => /^(data|reports|node_modules)\/|server\.lock/.test(n))).toEqual([]);
    expect(names.filter((n) => n.includes('\\'))).toEqual([]);
  });

  it('writes the launchers with CRLF and no BOM, even from an LF source with a BOM', () => {
    const out = path.join(tempDir(), 'z.zip');
    runScript('package', ['--from', makeDist(), '--out', out]);
    const zip = zipOf(out);
    for (const name of ['start.bat', 'import.bat']) {
      const bytes = zip[name]!;
      expect([...bytes.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
      expect(text(bytes).replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
      expect(text(bytes).endsWith('\r\n')).toBe(true);
    }
    expect(text(zip['start.bat'])).toBe('@echo off\r\nnode server.mjs %*\r\npause\r\n');
  });

  it('copies everything else byte for byte', () => {
    const dist = makeDist();
    const out = path.join(tempDir(), 'z.zip');
    runScript('package', ['--from', dist, '--out', out]);
    const zip = zipOf(out);
    for (const name of ['server.mjs', 'import.mjs', 'public/index.html', 'public/assets/app-1a2b3c.js']) {
      expect(Buffer.from(zip[name]!).equals(fs.readFileSync(path.join(dist, ...name.split('/'))))).toBe(true);
    }
  });

  it('creates the folder of the zip if it does not exist', () => {
    const out = path.join(tempDir(), 'a', 'b', 'z.zip');
    expect(runScript('package', ['--from', makeDist(), '--out', out]).status).toBe(0);
    expect(fs.existsSync(out)).toBe(true);
  });

  it.each(['start.bat', 'import.bat', 'server.mjs', 'import.mjs', 'public/index.html'])('stops with a message when %s is missing, and writes no zip', (missing) => {
    const out = path.join(tempDir(), 'z.zip');
    const ran = runScript('package', ['--from', makeDist({ skip: [missing] }), '--out', out]);
    expect(ran.status).toBe(2);
    expect(ran.stderr).toContain(missing);
    expect(ran.stderr).toContain('npm run build');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('stops when the build folder does not exist', () => {
    const ran = runScript('package', ['--from', path.join(tempDir(), 'nothing'), '--out', path.join(tempDir(), 'z.zip')]);
    expect(ran.status).toBe(2);
    expect(ran.stderr).toContain('start.bat');
  });

  it('refuses unknown options', () => {
    const ran = runScript('package', ['--bogus']);
    expect(ran.status).toBe(2);
    expect(ran.stderr).toContain('Usage');
  });
});
