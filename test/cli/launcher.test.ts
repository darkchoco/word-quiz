import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const bytes = fs.readFileSync(new URL('../../release/import.bat', import.meta.url));
const text = bytes.toString('utf8');

describe('release/import.bat', () => {
  it('switches the console to UTF-8 and passes every argument on to import.mjs', () => {
    expect(text).toContain('chcp 65001');
    expect(text).toContain('"%~dp0import.mjs"');
    expect(text).toContain('%*');
    expect(text).toContain('--disable-warning=ExperimentalWarning');
  });

  it('has no byte order mark (cmd.exe would read it as part of the first command)', () => {
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
  });

  it('uses Windows line endings only', () => {
    expect(text.includes('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });
});
