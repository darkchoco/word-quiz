import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          include: ['test/*.test.ts', 'test/{shared,server,cli,release}/**/*.test.ts'],
          environment: 'node',
          // node:sqlite prints an ExperimentalWarning on every load
          execArgv: ['--disable-warning=ExperimentalWarning'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'client',
          include: ['test/client/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['test/client/setup.ts'],
        },
      },
    ],
  },
});
