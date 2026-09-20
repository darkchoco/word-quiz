import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../src/client/theme';
import type { SessionState } from '../../src/shared/api';

export function renderWithTheme(ui: ReactElement) {
  // In a real browser something (the button that opened a dialog) has focus. In jsdom nothing has,
  // and MUI's focus trap then tries to give focus back to `document` when the dialog closes.
  const opener = document.body.appendChild(document.createElement('button'));
  opener.focus();
  return { user: userEvent.setup(), ...render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>) };
}

export const session = (over: Partial<SessionState> = {}): SessionState => ({
  db: 'latin.db',
  language: 'latin',
  sessionId: 1,
  startedAt: 0,
  questionsPerRound: 20,
  stats: { totalWords: 178, tested: 15, correct: 11 },
  activeRound: null,
  ...over,
});

export const databases = [
  { name: 'latin.db', language: 'latin', wordCount: 178 },
  { name: 'latin_2.db', language: 'latin', wordCount: 40 },
];
