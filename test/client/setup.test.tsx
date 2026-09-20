import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('the client test setup', () => {
  it('renders into jsdom and has jest-dom matchers', () => {
    render(<button type="button">Start</button>);
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('provides matchMedia', () => {
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
  });
});
