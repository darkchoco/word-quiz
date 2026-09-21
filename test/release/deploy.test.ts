import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemp, makeDist, runScript, snapshot, tempDir, write } from '../support/release';

afterEach(cleanTemp);

const deploy = (from: string, target: string, extra: string[] = [], env: Record<string, string> = {}) =>
  runScript('deploy', ['--from', from, '--dir', target, ...extra], env);

/** A program folder that has been used: databases, a backup, a report and something else. */
function usedFolder(): string {
  const target = tempDir('wq-install-');
  write(path.join(target, 'data', 'latin.db'), Buffer.from('SQLite format 3\0 pretend database'));
  write(path.join(target, 'data', 'backup', 'latin-before-merge.db'), 'backup');
  write(path.join(target, 'reports', 'latin-2026-09-20.txt'), 'Zeichen: ā ē ī ō ū\n');
  write(path.join(target, 'notes.txt'), 'mine');
  const old = new Date('2026-01-02T03:04:05Z');
  for (const file of ['data/latin.db', 'data/backup/latin-before-merge.db', 'reports/latin-2026-09-20.txt', 'notes.txt']) {
    fs.utimesSync(path.join(target, file), old, old);
  }
  return target;
}

const userData = (target: string) => {
  const all = snapshot(target);
  return Object.fromEntries(Object.entries(all).filter(([name]) => /^(data|reports)\/|^notes\.txt$/.test(name)));
};

describe('scripts/deploy.mjs', () => {
  it('creates the folder (also several levels deep) and puts the program files in it', () => {
    const target = path.join(tempDir(), 'a', 'WordQuiz');
    const ran = deploy(makeDist(), target);
    expect(ran.status).toBe(0);
    expect(ran.stdout).toContain('Deployed 6 files');
    expect(Object.keys(snapshot(target)).sort()).toEqual([
      'import.bat',
      'import.mjs',
      'public/assets/app-1a2b3c.js',
      'public/index.html',
      'server.mjs',
      'start.bat',
    ]);
  });

  it('writes the launchers with CRLF and no BOM, and everything else byte for byte', () => {
    const dist = makeDist();
    const target = tempDir('wq-install-');
    deploy(dist, target);
    const start = fs.readFileSync(path.join(target, 'start.bat'));
    expect([...start.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(start.toString('utf8')).toBe('@echo off\r\nnode server.mjs %*\r\npause\r\n');
    for (const name of ['server.mjs', 'import.mjs', 'public/index.html']) {
      expect(fs.readFileSync(path.join(target, ...name.split('/'))).equals(fs.readFileSync(path.join(dist, ...name.split('/'))))).toBe(true);
    }
  });

  it('leaves data, backups, reports and other files alone, however often it runs', () => {
    const dist = makeDist();
    const target = usedFolder();
    const before = userData(target);
    expect(Object.keys(before)).toHaveLength(4);
    for (let run = 0; run < 2; run++) {
      expect(deploy(dist, target).status).toBe(0);
      expect(userData(target)).toEqual(before); // same content and same modification time
    }
  });

  it('replaces public as a whole: old hashed files go, new ones come', () => {
    const target = usedFolder();
    deploy(makeDist({ assets: { 'public/assets/app-OLD.js': 'old', 'public/assets/style-OLD.css': 'old' } }), target);
    expect(fs.existsSync(path.join(target, 'public', 'assets', 'app-OLD.js'))).toBe(true);
    deploy(makeDist({ assets: { 'public/assets/app-NEW.js': 'new' } }), target);
    expect(fs.readdirSync(path.join(target, 'public', 'assets'))).toEqual(['app-NEW.js']);
  });

  it('is the same result the second time', () => {
    const dist = makeDist();
    const target = tempDir('wq-install-');
    deploy(dist, target);
    const first = Object.fromEntries(Object.entries(snapshot(target)).map(([name, value]) => [name, value.split(' ')[0]]));
    deploy(dist, target);
    const second = Object.fromEntries(Object.entries(snapshot(target)).map(([name, value]) => [name, value.split(' ')[0]]));
    expect(second).toEqual(first);
  });

  describe('when server.lock exists', () => {
    const lockText = `${JSON.stringify({ pid: 4242, port: 35000, startedAt: Date.UTC(2026, 8, 22, 10, 30) })}\n`;

    it('stops with exit code 1, tells who runs, and changes nothing', () => {
      const target = usedFolder();
      deploy(makeDist({ assets: { 'public/assets/old.js': 'old' } }), target);
      write(path.join(target, 'server.lock'), lockText);
      const before = snapshot(target);
      const ran = deploy(makeDist({ assets: { 'public/assets/new.js': 'new' } }), target);
      expect(ran.status).toBe(1);
      expect(ran.stderr).toContain('server.lock');
      expect(ran.stderr).toContain('pid 4242');
      expect(ran.stderr).toContain('port 35000');
      expect(ran.stderr).toContain('2026-09-22T10:30:00.000Z');
      expect(ran.stderr).toContain('--force');
      expect(snapshot(target)).toEqual(before);
    });

    it('goes on with --force, and still does not touch the lock or the user data', () => {
      const target = usedFolder();
      write(path.join(target, 'server.lock'), lockText);
      const data = userData(target);
      const lock = snapshot(target)['server.lock'];
      const ran = deploy(makeDist(), target, ['--force']);
      expect(ran.status).toBe(0);
      expect(ran.stderr).toContain('--force');
      expect(fs.existsSync(path.join(target, 'server.mjs'))).toBe(true);
      expect(snapshot(target)['server.lock']).toBe(lock);
      expect(userData(target)).toEqual(data);
    });

    it('also stops for a lock that cannot be read', () => {
      const target = tempDir('wq-install-');
      write(path.join(target, 'server.lock'), 'not json');
      const ran = deploy(makeDist(), target);
      expect(ran.status).toBe(1);
      expect(fs.existsSync(path.join(target, 'server.mjs'))).toBe(false);
    });
  });

  it('refuses an incomplete build, and creates nothing', () => {
    const target = path.join(tempDir(), 'WordQuiz');
    const ran = deploy(makeDist({ skip: ['server.mjs'] }), target);
    expect(ran.status).toBe(2);
    expect(ran.stderr).toContain('server.mjs');
    expect(fs.existsSync(target)).toBe(false);
  });

  it.each([
    ['the build folder itself', (dist: string) => dist],
    ['a folder inside the build folder', (dist: string) => path.join(dist, 'sub')],
    ['a folder that contains the build folder', (dist: string) => path.dirname(dist)],
  ])('refuses %s as the target, and deletes nothing', (_name, targetOf) => {
    const dist = makeDist();
    const before = snapshot(dist);
    const ran = deploy(dist, targetOf(dist));
    expect(ran.status).toBe(2);
    expect(ran.stderr).toContain('contain each other');
    expect(snapshot(dist)).toEqual(before);
  });

  it('takes the target from DEPLOY_DIR, and --dir wins over it', () => {
    const viaEnv = path.join(tempDir(), 'env');
    const viaOption = path.join(tempDir(), 'option');
    expect(runScript('deploy', ['--from', makeDist()], { DEPLOY_DIR: viaEnv }).status).toBe(0);
    expect(fs.existsSync(path.join(viaEnv, 'server.mjs'))).toBe(true);
    expect(runScript('deploy', ['--from', makeDist(), '--dir', viaOption], { DEPLOY_DIR: viaEnv }).status).toBe(0);
    expect(fs.existsSync(path.join(viaOption, 'server.mjs'))).toBe(true);
  });

  it('refuses unknown options', () => {
    const ran = runScript('deploy', ['--nonsense']);
    expect(ran.status).toBe(2);
    expect(ran.stderr).toContain('Usage');
  });
});
