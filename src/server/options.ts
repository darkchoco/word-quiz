import { parseArgs } from 'node:util';
import { normalizeAllowedHost } from './hosts';

export const DEFAULT_PORT = 35000;

export interface ServerOptions {
  /** 0 lets the system choose a free port (used by tests). */
  port: number;
  /** Listen on 127.0.0.1 only, so that no other device can connect. */
  localOnly: boolean;
  /** Open the default browser once the server is ready. */
  open: boolean;
  /** Host names to accept in addition to the built-in ones. */
  allowedHosts: string[];
}

export class UsageError extends Error {}

export const USAGE = `Usage: server [options]

Starts Word Quiz and opens it in the browser.

Options:
  --port <n>          Port to listen on (default ${DEFAULT_PORT}, or the PORT environment variable)
  --local-only        Only accept connections from this PC (no phone access)
  --no-open           Do not open the browser
  --allow-host <name> Accept this host name too, for example nas.local (repeatable, or
                      set WORDQUIZ_ALLOWED_HOSTS to a comma separated list)
  -h, --help          Show this help
`;

/** Reads the command line and the environment. Throws UsageError with a readable message. */
export function parseServerOptions(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): ServerOptions & { help: boolean } {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      allowPositionals: false,
      options: {
        port: { type: 'string' },
        'local-only': { type: 'boolean' },
        'no-open': { type: 'boolean' },
        'allow-host': { type: 'string', multiple: true },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (error) {
    throw new UsageError(`${((error as Error).message.split('. ')[0]) ?? 'Invalid arguments'}. Run with --help to see the options.`);
  }

  const rawPort = values.port ?? env['PORT'];
  let port = DEFAULT_PORT;
  if (rawPort !== undefined && rawPort !== '') {
    port = /^\d{1,5}$/.test(rawPort) ? Number(rawPort) : Number.NaN;
    if (!Number.isInteger(port) || port > 65535) {
      throw new UsageError(`"${rawPort}" is not a valid port. Use a number from 0 to 65535.`);
    }
  }

  const listed = [...(env['WORDQUIZ_ALLOWED_HOSTS'] ?? '').split(','), ...(values['allow-host'] ?? []).flatMap((v) => v.split(','))]
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  let allowedHosts: string[];
  try {
    allowedHosts = [...new Set(listed.map(normalizeAllowedHost))];
  } catch (error) {
    throw new UsageError((error as Error).message);
  }

  return {
    port,
    localOnly: values['local-only'] === true,
    open: values['no-open'] !== true,
    allowedHosts,
    help: values.help === true,
  };
}
