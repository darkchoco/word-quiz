import { openBrowser } from './browser';
import { parseServerOptions, UsageError, USAGE } from './options';
import { appHome } from './paths';
import { PortInUseError, startServer, type RunningServer } from './start';

const log = (line: string): void => console.log(line);

async function main(): Promise<number> {
  let options;
  try {
    options = parseServerOptions(process.argv.slice(2), process.env);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  // Ctrl+C, closing the console window (SIGHUP on Windows) and a normal stop request all end the
  // session the same way. The handlers are installed BEFORE the server starts, so that a signal
  // that arrives right after the "running" message is never handled by the default action. The
  // session is recorded synchronously first: Windows ends the process about ten seconds after the
  // console window is closed.
  let running: RunningServer | undefined;
  const stop = (signal: string) => () => {
    log(`Stopping (${signal}).`);
    void (running ? running.shutdown() : Promise.resolve()).finally(() => process.exit(0));
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const) process.on(signal, stop(signal));
  process.on('exit', () => running?.shutdownSync());
  process.on('uncaughtException', (error) => {
    console.error(`Unexpected error: ${error.stack ?? error.message}`);
    running?.shutdownSync();
    process.exit(1);
  });

  try {
    running = await startServer({ ...options, home: appHome(), log, openBrowser });
  } catch (error) {
    if (error instanceof PortInUseError) {
      console.error(`Port ${error.port} is already in use. Word Quiz may already be running.`);
      if (options.open) openBrowser(`http://localhost:${error.port}`);
      return 1;
    }
    throw error;
  }
  return -1; // keep running
}

const code = await main();
if (code >= 0) process.exitCode = code;
