import { Box } from '@mui/material';
import type { Stats } from '../../shared/api';
import { MONO_FONT } from '../theme';

const num = { fontFamily: MONO_FONT, fontWeight: 500, color: 'text.primary' } as const;

export function StatusBar({ stats }: { stats: Stats }) {
  return (
    <Box
      component="footer"
      sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1, px: 2, py: 1, fontSize: 13, color: 'text.secondary', bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}
    >
      <span>
        Total words <Box component="b" sx={num}>{stats.totalWords}</Box>
      </span>
      <span>
        Session tested <Box component="b" sx={num}>{stats.tested}</Box> / correct <Box component="b" sx={num}>{stats.correct}</Box>
      </span>
    </Box>
  );
}
