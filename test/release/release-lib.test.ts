import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

// The scripts are plain .mjs files that node runs directly, so they are loaded here at run time.
const libUrl = pathToFileURL(path.resolve(__dirname, '../../scripts/lib/release.mjs')).href;
const lib = (await import(libUrl)) as {
  toCrlf: (text: string) => string;
  BATCH_FILES: string[];
  BUNDLE_FILES: string[];
  PROGRAM_FILES: string[];
};

describe('toCrlf', () => {
  it.each([
    ['LF', 'a\nb\n', 'a\r\nb\r\n'],
    ['CRLF stays as it is', 'a\r\nb\r\n', 'a\r\nb\r\n'],
    ['a mix', 'a\r\nb\nc\r\nd\n', 'a\r\nb\r\nc\r\nd\r\n'],
    ['no final line break', 'a\nb', 'a\r\nb'],
    ['a single line', 'pause', 'pause'],
    ['empty lines', 'a\n\n\nb\n', 'a\r\n\r\n\r\nb\r\n'],
    ['empty text', '', ''],
  ])('%s', (_name, input, expected) => {
    expect(lib.toCrlf(input)).toBe(expected);
  });

  it('removes a byte order mark', () => {
    expect(lib.toCrlf('﻿@echo off\n')).toBe('@echo off\r\n');
  });

  it('does not touch anything but line breaks (percent signs, quotes, non-ASCII text)', () => {
    const line = 'echo "100%% ā ē ī ō ū ä ö ü" & pause';
    expect(lib.toCrlf(`${line}\n`)).toBe(`${line}\r\n`);
  });

  it('gives the same result when it is applied twice', () => {
    const once = lib.toCrlf('a\nb\r\nc\n');
    expect(lib.toCrlf(once)).toBe(once);
    expect(once.match(/\n/g)).toHaveLength(once.match(/\r\n/g)!.length);
  });
});

describe('what a release consists of', () => {
  it('names the two launchers and the two bundles', () => {
    expect(lib.BATCH_FILES).toEqual(['start.bat', 'import.bat']);
    expect(lib.BUNDLE_FILES).toEqual(['server.mjs', 'import.mjs']);
    expect(lib.PROGRAM_FILES).toEqual(['start.bat', 'import.bat', 'server.mjs', 'import.mjs']);
  });
});
