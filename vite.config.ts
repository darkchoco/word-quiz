import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The key ends with a slash: /api.ts is a module of the page, not a request for the server.
// The server of `npm run dev` listens here (scripts/dev.mjs); the page talks to it through the proxy.
const API_PORT = Number(process.env.WQ_API_PORT ?? 35100);

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: { outDir: '../../dist/public', emptyOutDir: true },
  server: { host: '127.0.0.1', proxy: { '/api/': { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: false } } },
});
