import './fonts';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { theme } from './theme';

// The gallery of components exists only in development and in `vite build --mode shots` (used by
// scripts/shots.sh). In a normal production build both conditions are constant `false`, so the import
// below is removed together with everything in it.
const Gallery = import.meta.env.DEV || import.meta.env.MODE === 'shots' ? lazy(() => import('./dev/Gallery').then((m) => ({ default: m.Gallery }))) : null;
const showGallery = Gallery !== null && window.location.hash.startsWith('#/dev');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        {showGallery ? (
          <Suspense fallback={null}>
            <Gallery />
          </Suspense>
        ) : (
          <App />
        )}
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
