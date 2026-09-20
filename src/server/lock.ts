import fs from 'node:fs';
import path from 'node:path';

export interface LockInfo {
  pid: number;
  port: number;
  startedAt: number;
}

/**
 * `server.lock` in the application folder says that a server is running. The deploy script
 * refuses to replace program files while it exists (TECH-SPEC 8.5, T16).
 */
export const lockPath = (home: string): string => path.join(home, 'server.lock');

export function writeLock(home: string, info: LockInfo): void {
  fs.writeFileSync(lockPath(home), `${JSON.stringify(info)}\n`, 'utf8');
}

export function readLock(home: string): LockInfo | null {
  try {
    const value = JSON.parse(fs.readFileSync(lockPath(home), 'utf8')) as Partial<LockInfo>;
    if (typeof value.pid === 'number' && typeof value.port === 'number' && typeof value.startedAt === 'number') {
      return { pid: value.pid, port: value.port, startedAt: value.startedAt };
    }
  } catch {
    // missing or unreadable
  }
  return null;
}

/** Removes the lock, but not one that another process wrote in the meantime. */
export function removeLock(home: string, pid: number = process.pid): void {
  const lock = readLock(home);
  if (lock !== null && lock.pid !== pid) return;
  fs.rmSync(lockPath(home), { force: true });
}
