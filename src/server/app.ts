import express, { type Express } from 'express';
import type { AppContext } from './context';
import { installFallbacks, installGuards } from './middleware';
import { createApiRouter } from './routes';

/**
 * The web application: request guards, the API under /api, the web app files and the fallbacks.
 * `publicDir` holds the built client. Until it exists the root page says that the server is up.
 */
export function createApp(ctx: AppContext, publicDir: string): Express {
  const app = express();
  installGuards(app, () => ctx.allowedHosts);
  app.use('/api', createApiRouter(ctx));
  app.use(express.static(publicDir, { index: 'index.html', dotfiles: 'ignore' }));
  app.get('/', (_req, res) => {
    res
      .type('text/plain')
      .send('Word Quiz is running, but its web app files were not found. Reinstall the program.\n');
  });
  installFallbacks(app, ctx.log);
  return app;
}
