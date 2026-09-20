import { appHome } from '../server/paths';
import { runImport } from './run';

// When the output is piped into something that stops reading early (`| head`, `| more`), the
// write fails with EPIPE. That is not an error of the import, so it must not crash the program.
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code !== 'EPIPE') throw error;
});

process.exitCode = await runImport(process.argv.slice(2), {
  home: appHome(),
  now: new Date(),
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
});
