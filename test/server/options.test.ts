import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, parseServerOptions, UsageError, USAGE } from '../../src/server/options';

const parse = (argv: string[], env: NodeJS.ProcessEnv = {}) => parseServerOptions(argv, env);
const failure = (argv: string[], env: NodeJS.ProcessEnv = {}): string => {
  try {
    parse(argv, env);
  } catch (error) {
    expect(error).toBeInstanceOf(UsageError);
    return (error as Error).message;
  }
  throw new Error('expected a usage error');
};

describe('defaults', () => {
  it('listens on 35000 on all interfaces, opens the browser and adds no hosts', () => {
    expect(parse([])).toEqual({ port: DEFAULT_PORT, localOnly: false, open: true, allowedHosts: [], help: false });
    expect(DEFAULT_PORT).toBe(35000);
  });
});

describe('port', () => {
  it('comes from --port or PORT, and --port wins', () => {
    expect(parse(['--port', '8080']).port).toBe(8080);
    expect(parse([], { PORT: '9000' }).port).toBe(9000);
    expect(parse(['--port', '8080'], { PORT: '9000' }).port).toBe(8080);
    expect(parse(['--port=8081']).port).toBe(8081);
  });

  it('accepts 0 (a free port chosen by the system, for tests) and 65535', () => {
    expect(parse(['--port', '0']).port).toBe(0);
    expect(parse(['--port', '65535']).port).toBe(65535);
  });

  it.each(['abc', '65536', '1.5', ' 80', '0x50', '99999999', '-1'])('rejects the port %j', (value) => {
    // "--port=value" reaches our own check even for values that look like an option
    expect(failure([`--port=${value}`])).toContain('not a valid port');
  });

  it('rejects a value that looks like another option', () => {
    expect(failure(['--port', '-1'])).toContain('--port');
  });

  it('ignores an empty PORT variable', () => {
    expect(parse([], { PORT: '' }).port).toBe(DEFAULT_PORT);
  });

  it('rejects an invalid PORT variable', () => {
    expect(failure([], { PORT: 'abc' })).toContain('not a valid port');
  });
});

describe('flags', () => {
  it('--local-only, --no-open and --help', () => {
    expect(parse(['--local-only']).localOnly).toBe(true);
    expect(parse(['--no-open']).open).toBe(false);
    expect(parse(['--help']).help).toBe(true);
    expect(parse(['-h']).help).toBe(true);
  });

  it('rejects an unknown option and positional arguments', () => {
    expect(failure(['--bogus'])).toContain('--bogus');
    expect(failure(['--bogus'])).toContain('--help');
    expect(failure(['extra'])).toMatch(/extra|positional/i);
    expect(failure(['--port'])).toContain('--port');
  });

  it('has a usage text that names every option', () => {
    for (const word of ['--port', '--local-only', '--no-open', '--allow-host', 'WORDQUIZ_ALLOWED_HOSTS', '--help']) {
      expect(USAGE).toContain(word);
    }
  });
});

describe('allowed host names', () => {
  it('reads --allow-host (repeatable, comma separated) and the environment variable', () => {
    expect(parse(['--allow-host', 'nas.local']).allowedHosts).toEqual(['nas.local']);
    expect(parse(['--allow-host', 'a.local', '--allow-host', 'b.local,c.local']).allowedHosts).toEqual(['a.local', 'b.local', 'c.local']);
    expect(parse([], { WORDQUIZ_ALLOWED_HOSTS: 'nas.local, other.lan' }).allowedHosts).toEqual(['nas.local', 'other.lan']);
  });

  it('combines both, cleans them up and removes duplicates', () => {
    const options = parse(['--allow-host', 'NAS.local:35000'], { WORDQUIZ_ALLOWED_HOSTS: 'nas.local' });
    expect(options.allowedHosts).toEqual(['nas.local']);
  });

  it('ignores empty entries', () => {
    expect(parse([], { WORDQUIZ_ALLOWED_HOSTS: ' , ,' }).allowedHosts).toEqual([]);
  });

  it('rejects something that is not a host name', () => {
    expect(failure(['--allow-host', 'http://nas.local'])).toContain('not a valid host name');
    expect(failure([], { WORDQUIZ_ALLOWED_HOSTS: 'a b' })).toContain('not a valid host name');
  });
});
