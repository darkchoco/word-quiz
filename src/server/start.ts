import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { createApp } from './app';
import { createContext, type AppContext } from './context';
import { removeLock, writeLock } from './lock';
import { lanUrls } from './network';
import type { ServerOptions } from './options';
import { endActiveSession } from './services/session';

export class PortInUseError extends Error {
  constructor(readonly port: number) {
    super(`Port ${port} is already in use.`);
  }
}

export interface StartOptions extends Omit<ServerOptions, 'open'> {
  home: string;
  open?: boolean;
  publicDir?: string;
  log?: (line: string) => void;
  now?: () => number;
  /** Called with the address once the server is ready. */
  openBrowser?: (url: string) => void;
  /** Network interfaces for the phone address (replaced in tests). */
  interfaces?: Parameters<typeof lanUrls>[1];
}

export interface RunningServer {
  url: string;
  port: number;
  host: string;
  ctx: AppContext;
  /** Records the end of the session and removes the lock. Fast, synchronous and safe to repeat. */
  shutdownSync(): void;
  /** `shutdownSync` and then stops accepting connections. */
  shutdown(): Promise<void>;
}

/**
 * Starts listening. Only after this succeeded is the lock file written and the browser opened,
 * so a second copy that finds the port taken changes nothing.
 * Rejects with PortInUseError if the port is busy.
 */
export async function startServer(options: StartOptions): Promise<RunningServer> {
  const log = options.log ?? (() => {});
  const ctx = createContext({
    home: options.home,
    allowedHosts: options.allowedHosts,
    log,
    ...(options.now ? { now: options.now } : {}),
  });
  const app = createApp(ctx, options.publicDir ?? path.join(options.home, 'public'));
  const server = http.createServer(app);
  const host = options.localOnly ? '127.0.0.1' : '0.0.0.0';

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(error.code === 'EADDRINUSE' ? new PortInUseError(options.port) : error);
    });
    server.listen(options.port, host, () => {
      server.removeAllListeners('error');
      resolve();
    });
  });

  const port = (server.address() as AddressInfo).port;
  const url = `http://localhost:${port}`;
  writeLock(options.home, { pid: process.pid, port, startedAt: ctx.now() });

  log('Word Quiz is running.');
  log(`  On this PC:  ${url}`);
  if (!options.localOnly) {
    for (const lan of lanUrls(port, options.interfaces)) log(`  From a phone on the same network:  ${lan}`);
  }
  log('Close this window or press Ctrl+C to stop.');
  if (options.open !== false) options.openBrowser?.(url);

  let stopped = false;
  const shutdownSync = (): void => {
    if (stopped) return;
    stopped = true;
    endActiveSession(ctx);
    removeLock(options.home);
  };
  const shutdown = async (): Promise<void> => {
    shutdownSync();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  };

  return { url, port, host, ctx, shutdownSync, shutdown };
}
