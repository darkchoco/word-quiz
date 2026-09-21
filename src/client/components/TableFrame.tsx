import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { WORD_FONT } from '../theme';

/** The look of the tables of the mockup: a rounded frame that scrolls sideways by itself when it is too narrow. */
export function TableFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: '10px' }}>
      <Box
        component="table"
        aria-label={label}
        sx={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 14.5,
          '& th, & td': { p: '10px 14px', textAlign: 'left', borderBottom: 1, borderColor: 'divider', verticalAlign: 'top' },
          '& tr:last-child td': { borderBottom: 0 },
          '& th': { fontSize: 12, letterSpacing: '.06em', color: 'text.secondary', fontWeight: 500, bgcolor: 'background.subtle', whiteSpace: 'nowrap' },
          '& td.word': { fontFamily: WORD_FONT, fontSize: 18, minWidth: 180, fontFeatureSettings: '"locl" 0' },
          '& td.check': { textAlign: 'center', width: 64 },
          // On a phone the Done and Edit columns must stay in view, so the columns get tighter.
          '@media (max-width:599.95px)': {
            '& th, & td': { p: '8px 5px' },
            '& td.word': { minWidth: 72, fontSize: 15 },
            '& td.check': { width: 36, px: 0 },
            '& td .MuiButton-root': { minWidth: 0, px: 0.75, fontSize: 12.5 },
            '& td .MuiCheckbox-root': { p: 0.5 },
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
