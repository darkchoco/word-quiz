import { describe, expect, it } from 'vitest';
import { isAllowedHost, normalizeAllowedHost } from '../../src/server/hosts';

describe('isAllowedHost: accepted', () => {
  it.each([
    'localhost',
    'localhost:35000',
    'LOCALHOST:35000',
    '127.0.0.1',
    '127.0.0.1:35000',
    '127.5.6.7',
    '10.0.0.1',
    '10.255.255.255:80',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.9:35000',
    '192.168.255.1',
    '[::1]',
    '[::1]:35000',
    'MYPC',
    'my-pc',
    'my-pc:35000',
    'a',
  ])('%s', (host) => expect(isAllowedHost(host)).toBe(true));
});

describe('isAllowedHost: refused', () => {
  it.each([
    ['evil.example.com', 'a public name'],
    ['evil.example.com:35000', 'a public name with a port'],
    ['localhost.evil.com', 'a public name that starts with localhost'],
    ['nas.local', 'a name with a dot that was not added'],
    ['8.8.8.8', 'a public address'],
    ['172.15.0.1', 'just below the private 172 range'],
    ['172.32.0.1', 'just above the private 172 range'],
    ['192.169.0.1', 'not the private 192.168 range'],
    ['100.64.0.1', 'shared address space (VPN), not private'],
    ['169.254.1.1', 'link local'],
    ['0.0.0.0', 'unspecified'],
    ['256.1.1.1', 'not an address'],
    ['1.2.3', 'not an address'],
    ['2130706433', 'a number that some programs read as 127.0.0.1'],
    ['12345', 'digits only'],
    ['localhost.', 'trailing dot'],
    ['a..b', 'empty label'],
    ['', 'empty'],
    ['[fe80::1]', 'another IPv6 address'],
    ['[::1', 'unclosed bracket'],
    ['[::1]x', 'garbage after the bracket'],
    ['localhost:abc', 'port is not a number'],
    ['localhost:0', 'port 0'],
    ['localhost:70000', 'port too large'],
    ['localhost:', 'empty port'],
    ['local host', 'a space'],
    ['localhost\r\nX: 1', 'control characters'],
    ['-bad', 'starts with a hyphen'],
    ['bad-', 'ends with a hyphen'],
    ['ünicode', 'non-ASCII'],
    ['a'.repeat(64), 'a label longer than 63 characters'],
  ])('%j (%s)', (host) => expect(isAllowedHost(host)).toBe(false));

  it('refuses a missing header', () => {
    expect(isAllowedHost(undefined)).toBe(false);
  });
});

describe('isAllowedHost: names added by the user', () => {
  it('accepts an added name, with or without a port, ignoring case', () => {
    expect(isAllowedHost('nas.local', ['nas.local'])).toBe(true);
    expect(isAllowedHost('NAS.Local:35000', ['nas.local'])).toBe(true);
  });

  it('accepts only the names that were added', () => {
    expect(isAllowedHost('other.local', ['nas.local'])).toBe(false);
    expect(isAllowedHost('evil.nas.local', ['nas.local'])).toBe(false);
    expect(isAllowedHost('nas.local.evil.com', ['nas.local'])).toBe(false);
  });

  it('still applies the built-in rules', () => {
    expect(isAllowedHost('localhost', ['nas.local'])).toBe(true);
    expect(isAllowedHost('8.8.8.8', ['nas.local'])).toBe(false);
  });

  it('does not let an added name make a malformed header valid', () => {
    expect(isAllowedHost('nas.local:abc', ['nas.local'])).toBe(false);
  });
});

describe('normalizeAllowedHost', () => {
  it('lower-cases and drops a port', () => {
    expect(normalizeAllowedHost(' NAS.local ')).toBe('nas.local');
    expect(normalizeAllowedHost('nas.local:35000')).toBe('nas.local');
  });

  it.each(['', 'a b', 'http://nas.local', 'nas..local', '-x', 'x.', '/x', 'nas.local/'])('rejects %j', (raw) => {
    expect(() => normalizeAllowedHost(raw)).toThrow(/not a valid host name/);
  });
});
