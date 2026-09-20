import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { appHome, dataDir, reportsDir } from '../src/server/paths';

describe('appHome', () => {
  it('prefers WORDQUIZ_HOME and resolves it to an absolute path', () => {
    expect(appHome({ WORDQUIZ_HOME: '/tmp/wq' })).toBe(path.resolve('/tmp/wq'));
  });

  it('falls back to the directory of the running file', () => {
    const here = path.dirname(fileURLToPath(new URL('../src/server/paths.ts', import.meta.url)));
    expect(appHome({})).toBe(here);
  });

  it('ignores an empty WORDQUIZ_HOME', () => {
    expect(appHome({ WORDQUIZ_HOME: '' })).toBe(appHome({}));
  });

  it('builds data and reports directories with path.join', () => {
    expect(dataDir('/x')).toBe(path.join('/x', 'data'));
    expect(reportsDir('/x')).toBe(path.join('/x', 'reports'));
  });
});

describe('node:sqlite', () => {
  it('runs an in-memory database', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t (w TEXT)');
    db.prepare('INSERT INTO t (w) VALUES (?)').run('capiō, cēpī');
    const row = db.prepare('SELECT w FROM t').get() as { w: string } | undefined;
    expect(row?.w).toBe('capiō, cēpī');
    db.close();
  });
});
