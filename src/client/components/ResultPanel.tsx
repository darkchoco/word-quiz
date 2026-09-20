import { Box, Button, Typography } from '@mui/material';
import type { RoundSummary } from '../../shared/api';
import { WORD_FONT } from '../theme';

export function ResultPanel({ summary, onAgain }: { summary: RoundSummary; onAgain: () => void }) {
  return (
    <Box sx={{ minHeight: 'var(--wq-min-h, 50dvh)', display: 'grid', placeItems: 'center', p: 2 }}>
      <Box sx={{ textAlign: 'center', display: 'grid', gap: 1.5, justifyItems: 'center' }}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>
          Round complete
        </Typography>
        <Box sx={{ fontFamily: WORD_FONT, fontSize: 64, fontWeight: 600, lineHeight: 1 }}>{summary.percent}%</Box>
        <div>
          {summary.correct} of {summary.total} correct
        </div>
        <Button variant="contained" size="large" sx={{ fontWeight: 600, mt: 1 }} onClick={onAgain}>
          Play again
        </Button>
      </Box>
    </Box>
  );
}
