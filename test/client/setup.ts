import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// A test fails if anything was written with console.error: React reports rendering mistakes,
// missing keys, updates outside act() and unhandled errors this way, and they must not go unnoticed.
const errors: string[] = [];

beforeEach(() => {
  errors.length = 0;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
  });
  // jsdom has no matchMedia; MUI asks for the colour scheme through it.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  if (errors.length > 0) {
    const message = errors.join('\n---\n');
    errors.length = 0;
    throw new Error(`console.error was called during the test:\n${message}`);
  }
});
