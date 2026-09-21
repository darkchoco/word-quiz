import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const file = path.resolve(__dirname, '../../release/start.bat');
const raw = fs.readFileSync(file);
const text = raw.toString('utf8');
const lines = text.split('\r\n');

/** The one-line JavaScript of `node -e "..."` that decides whether this Node is new enough. */
function versionCheck(): string {
  const match = /node -e "([^"]+)"/.exec(text);
  if (!match) throw new Error('the version check is missing from start.bat');
  return match[1]!;
}

/** Runs the check as if the running Node had this version; returns the exit code it asks for. */
function exitCodeFor(version: string): number | undefined {
  let code: number | undefined;
  const process = {
    versions: { node: version },
    exit: (value: number) => {
      code = value;
    },
  };
  vm.runInNewContext(versionCheck(), { process });
  return code;
}

describe('the Node version check of start.bat', () => {
  it.each(['22.13.0', '22.13.1', '22.14.0', '22.100.0', '23.0.0', '24.14.0', '30.0.0'])('lets %s through', (version) => {
    expect(exitCodeFor(version)).toBe(0);
  });

  it.each(['22.12.0', '22.12.99', '22.9.0', '22.0.0', '21.9.9', '20.19.0', '18.20.4'])('refuses %s', (version) => {
    expect(exitCodeFor(version)).toBe(1);
  });
});

describe('start.bat', () => {
  it('uses CRLF on every line and has no byte order mark', () => {
    expect(raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(text.endsWith('\r\n')).toBe(true);
  });

  it('switches the console to UTF-8 before anything is printed, and works in its own folder', () => {
    expect(lines[0]).toBe('@echo off');
    expect(lines[1]).toMatch(/^chcp 65001 >/);
    expect(lines[2]).toBe('cd /d "%~dp0"');
  });

  it('says so when Node.js is not installed, and when it is too old', () => {
    expect(text).toMatch(/where node .*Node\.js was not found.*22\.13.*pause.*exit \/b 1/);
    expect(text).toMatch(/Node\.js 22\.13 or later is required.*node -v.*pause.*exit \/b 1/);
  });

  it('starts the server with the warning switched off and passes its own arguments on', () => {
    expect(lines).toContain('node --disable-warning=ExperimentalWarning server.mjs %*');
  });

  it('ends with pause, so an error message does not vanish with the window', () => {
    expect(lines.filter((line) => line !== '').at(-1)).toBe('pause');
  });

  it('does not open the browser itself (the server does that once it listens)', () => {
    expect(text).not.toMatch(/\bstart\s+""|\bstart\s+http/i);
  });
});
