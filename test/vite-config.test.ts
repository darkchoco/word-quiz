import { describe, expect, it } from 'vitest';
import config from '../vite.config';

describe('vite.config', () => {
  // `/api` as a proxy prefix also catches the module `/api.ts` of the page, so the dev page
  // stayed empty (M5). The prefix has to end with a slash.
  it('proxies only paths below /api/', () => {
    const proxy = config.server?.proxy ?? {};
    expect(Object.keys(proxy)).toEqual(['/api/']);
  });
});
