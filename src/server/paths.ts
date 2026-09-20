import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Application home: WORDQUIZ_HOME if set, otherwise the directory of the running file.
 * Deployed as C:\WordQuiz on Windows; a scratch directory in development and tests.
 */
export function appHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env['WORDQUIZ_HOME'];
  if (override) return path.resolve(override);
  return path.dirname(fileURLToPath(import.meta.url));
}

export const dataDir = (home: string = appHome()): string => path.join(home, 'data');
export const reportsDir = (home: string = appHome()): string => path.join(home, 'reports');
