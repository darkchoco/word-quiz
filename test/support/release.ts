import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const repoRoot = path.resolve(__dirname, '../..');

const made: string[] = [];

/** A fresh empty folder that `cleanTemp` removes. */
export function tempDir(prefix = 'wq-release-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

export function cleanTemp(): void {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

export function write(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/**
 * A small stand-in for `dist/`. The launchers deliberately have LF line breaks and a BOM, as if
 * they came from a checkout that did not convert them: the scripts must fix that.
 */
export function makeDist(over: { skip?: string[]; assets?: Record<string, string> } = {}): string {
  const dir = tempDir('wq-dist-');
  const files: Record<string, string | Buffer> = {
    'start.bat': '﻿@echo off\nnode server.mjs %*\npause\n',
    'import.bat': '@echo off\nnode import.mjs %*\n',
    'server.mjs': '// server bundle\nexport const answer = 42;\n',
    'import.mjs': Buffer.from([0x23, 0x21, 0x00, 0xff, 0xfe, 0x0a]), // not text: must be copied as it is
    'public/index.html': '<!doctype html><title>Word Quiz</title>\n',
    ...Object.fromEntries(Object.entries(over.assets ?? { 'public/assets/app-1a2b3c.js': 'console.log(1);\n' })),
  };
  for (const [name, content] of Object.entries(files)) {
    if (over.skip?.includes(name)) continue;
    write(path.join(dir, ...name.split('/')), content);
  }
  return dir;
}

export interface Ran {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Runs one of the scripts the way `node scripts/x.mjs` does. */
export function runScript(script: 'deploy' | 'package', args: string[], env: Record<string, string> = {}): Ran {
  const result = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', `${script}.mjs`), ...args], {
    encoding: 'utf8',
    env: { ...process.env, DEPLOY_DIR: '', ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Every file below `dir` with a hash of its content and its modification time, to see what changed. */
export function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 16);
        out[path.relative(dir, full).split(path.sep).join('/')] = `${hash} ${fs.statSync(full).mtimeMs}`;
      }
    }
  };
  if (fs.existsSync(dir)) visit(dir);
  return out;
}
