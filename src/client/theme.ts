import { createTheme } from '@mui/material/styles';

/** The colours of the mockup (docs/word-quiz-mockup.html), light and dark. */
export const tokens = {
  light: {
    bg: '#E9EDF3',
    surface: '#FFFFFF',
    surface2: '#F4F6FA',
    ink: '#16202E',
    muted: '#5A6879',
    line: '#D3DAE3',
    accent: '#2F55B5',
    accentSoft: '#E4EAF8',
    onAccent: '#FFFFFF',
    good: '#1E7A4C',
    goodSoft: '#DDF1E5',
    bad: '#B8382E',
    badSoft: '#F9E1DE',
    warn: '#8A5A00',
    warnSoft: '#FBEDD0',
  },
  dark: {
    bg: '#0B111A',
    surface: '#161F2E',
    surface2: '#1C2738',
    ink: '#E6EBF2',
    muted: '#9AA7B8',
    line: '#2A3648',
    accent: '#88A5F2',
    accentSoft: '#1F2D4F',
    onAccent: '#0B111A',
    good: '#5CC792',
    goodSoft: '#15352A',
    bad: '#F2887F',
    badSoft: '#42211F',
    warn: '#E6B65A',
    warnSoft: '#3B2F13',
  },
} as const;

type Scheme = Record<keyof (typeof tokens)['light'], string>;

declare module '@mui/material/styles' {
  interface TypeBackground {
    /** The slightly darker panel colour (`--surface-2` in the mockup). */
    subtle: string;
  }
}

const scheme = (t: Scheme) => ({
  palette: {
    primary: { main: t.accent, light: t.accentSoft, contrastText: t.onAccent },
    success: { main: t.good, light: t.goodSoft },
    error: { main: t.bad, light: t.badSoft },
    warning: { main: t.warn, light: t.warnSoft },
    text: { primary: t.ink, secondary: t.muted },
    divider: t.line,
    background: { default: t.bg, paper: t.surface, subtle: t.surface2 },
  },
});

export const UI_FONT = '"Noto Sans KR", system-ui, -apple-system, "Segoe UI", "Malgun Gothic", sans-serif';
/** For headwords and the brand: it has the macrons that Latin needs. */
export const WORD_FONT = '"EB Garamond", "Iowan Old Style", Georgia, serif';
export const MONO_FONT = '"IBM Plex Mono", ui-monospace, Consolas, monospace';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: { light: scheme(tokens.light), dark: scheme(tokens.dark) },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: UI_FONT,
    fontSize: 15,
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontSize: '15px', lineHeight: 1.55 },
      },
    },
  },
});
