import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { browserCommand, openBrowser } from '../../src/server/browser';
import { lockPath, readLock, removeLock, writeLock } from '../../src/server/lock';
import { lanUrls } from '../../src/server/network';
import { useTempDir } from '../support/tempdir';

const t = useTempDir();

describe('server.lock', () => {
  it('records the process, port and start time', () => {
    const home = t.dir();
    writeLock(home, { pid: 123, port: 35000, startedAt: 42 });
    expect(path.basename(lockPath(home))).toBe('server.lock');
    expect(readLock(home)).toEqual({ pid: 123, port: 35000, startedAt: 42 });
  });

  it('overwrites a lock that was left behind', () => {
    const home = t.dir();
    writeLock(home, { pid: 1, port: 1, startedAt: 1 });
    writeLock(home, { pid: 2, port: 2, startedAt: 2 });
    expect(readLock(home)).toEqual({ pid: 2, port: 2, startedAt: 2 });
  });

  it('is removed by its owner', () => {
    const home = t.dir();
    writeLock(home, { pid: process.pid, port: 1, startedAt: 1 });
    removeLock(home);
    expect(fs.existsSync(lockPath(home))).toBe(false);
  });

  it('is not removed when another process owns it', () => {
    const home = t.dir();
    writeLock(home, { pid: process.pid + 1, port: 1, startedAt: 1 });
    removeLock(home);
    expect(readLock(home)).toMatchObject({ pid: process.pid + 1 });
  });

  it('a damaged lock can be removed, and removing a missing lock is fine', () => {
    const home = t.dir();
    fs.writeFileSync(lockPath(home), 'not json');
    expect(readLock(home)).toBeNull();
    removeLock(home);
    expect(fs.existsSync(lockPath(home))).toBe(false);
    expect(() => removeLock(home)).not.toThrow();
  });

  it('reads nothing when the file is missing or has the wrong shape', () => {
    const home = t.dir();
    expect(readLock(home)).toBeNull();
    fs.writeFileSync(lockPath(home), '{"pid":"x"}');
    expect(readLock(home)).toBeNull();
  });
});

describe('opening the browser', () => {
  it.each([
    ['win32', 'cmd', ['/c', 'start', '', 'http://localhost:35000']],
    ['darwin', 'open', ['http://localhost:35000']],
    ['linux', 'xdg-open', ['http://localhost:35000']],
    ['freebsd', 'xdg-open', ['http://localhost:35000']],
  ] as const)('on %s runs %s', (platform, command, args) => {
    expect(browserCommand('http://localhost:35000', platform)).toEqual({ command, args: [...args] });
  });

  it('starts the command detached and lets go of it', () => {
    const child = { on: vi.fn(), unref: vi.fn() };
    const spawnFn = vi.fn(() => child);
    openBrowser('http://localhost:1', 'linux', spawnFn as never);
    expect(spawnFn).toHaveBeenCalledWith('xdg-open', ['http://localhost:1'], expect.objectContaining({ detached: true, stdio: 'ignore' }));
    expect(child.unref).toHaveBeenCalled();
  });

  it('never throws, even if the command cannot be started', () => {
    const failing = () => {
      throw new Error('no such command');
    };
    expect(() => openBrowser('http://localhost:1', 'linux', failing as never)).not.toThrow();
    const child = { on: vi.fn((event: string, handler: () => void) => event === 'error' && handler()), unref: vi.fn() };
    expect(() => openBrowser('http://localhost:1', 'linux', (() => child) as never)).not.toThrow();
  });
});

describe('addresses for a phone', () => {
  const nic = (address: string, extra: Partial<os.NetworkInterfaceInfo> = {}): os.NetworkInterfaceInfo =>
    ({ address, family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null, ...extra }) as os.NetworkInterfaceInfo;

  it('lists private IPv4 addresses only', () => {
    const urls = lanUrls(35000, {
      lo: [nic('127.0.0.1', { internal: true })],
      wifi: [nic('192.168.0.5'), nic('fe80::1', { family: 'IPv6' } as never)],
      eth: [nic('10.1.2.3')],
      docker: [nic('172.17.0.1')],
      vpn: [nic('100.64.0.9')],
      public: [nic('8.8.8.8')],
      link: [nic('169.254.3.4')],
      edge: [nic('172.32.0.1')],
    });
    expect(urls).toEqual(['http://192.168.0.5:35000', 'http://10.1.2.3:35000', 'http://172.17.0.1:35000']);
  });

  it('gives nothing when there is no network, and no duplicates', () => {
    expect(lanUrls(35000, {})).toEqual([]);
    expect(lanUrls(35000, { a: [nic('192.168.0.5')], b: [nic('192.168.0.5')] })).toEqual(['http://192.168.0.5:35000']);
    expect(lanUrls(35000, { a: undefined })).toEqual([]);
  });
});
