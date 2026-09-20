import { Button, CssBaseline, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { theme, tokens } from '../../src/client/theme';

describe('theme tokens (docs/word-quiz-mockup.html)', () => {
  it('has the light colours of the mockup', () => {
    expect(tokens.light).toMatchObject({
      bg: '#E9EDF3', surface: '#FFFFFF', surface2: '#F4F6FA', ink: '#16202E', muted: '#5A6879', line: '#D3DAE3',
      accent: '#2F55B5', accentSoft: '#E4EAF8', onAccent: '#FFFFFF',
      good: '#1E7A4C', goodSoft: '#DDF1E5', bad: '#B8382E', badSoft: '#F9E1DE', warn: '#8A5A00', warnSoft: '#FBEDD0',
    });
  });

  it('has the dark colours of the mockup', () => {
    expect(tokens.dark).toMatchObject({
      bg: '#0B111A', surface: '#161F2E', surface2: '#1C2738', ink: '#E6EBF2', muted: '#9AA7B8', line: '#2A3648',
      accent: '#88A5F2', accentSoft: '#1F2D4F', onAccent: '#0B111A',
      good: '#5CC792', goodSoft: '#15352A', bad: '#F2887F', badSoft: '#42211F', warn: '#E6B65A', warnSoft: '#3B2F13',
    });
  });
});

/** The generated theme has more fields at run time than `createTheme` declares. */
const generated = theme as unknown as {
  colorSchemes: Record<'light' | 'dark', { palette: { primary: { main: string }; text: { primary: string }; background: { default: string; paper: string; subtle: string }; divider: string } }>;
  colorSchemeSelector: string;
  vars: unknown;
};

describe('theme', () => {
  it('maps the light tokens into the MUI palette', () => {
    const light = generated.colorSchemes.light;
    expect(light.palette.primary.main).toBe('#2F55B5');
    expect(light.palette.text.primary).toBe('#16202E');
    expect(light.palette.background.default).toBe('#E9EDF3');
    expect(light.palette.background.paper).toBe('#FFFFFF');
    expect(light.palette.background.subtle).toBe('#F4F6FA');
    expect(light.palette.divider).toBe('#D3DAE3');
  });

  it('maps the dark tokens into the MUI palette', () => {
    const dark = generated.colorSchemes.dark;
    expect(dark.palette.primary.main).toBe('#88A5F2');
    expect(dark.palette.background.default).toBe('#0B111A');
    expect(dark.palette.background.paper).toBe('#161F2E');
  });

  it('follows the colour scheme of the system without any script', () => {
    expect(generated.colorSchemeSelector).toBe('media');
    expect(generated.vars).toBeTruthy();
  });

  it('keeps button labels as written ("Start", not "START")', () => {
    expect(theme.typography.button.textTransform).toBe('none');
    render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Button variant="contained">Start</Button>
      </ThemeProvider>,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    expect(getComputedStyle(button).textTransform).toBe('none');
  });
});
