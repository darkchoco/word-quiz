import { Box, Button, Typography } from '@mui/material';

interface Props {
  retest: boolean;
  onBack: () => void;
}

/** A round that cannot be started because nothing can be asked. */
export function EmptyPoolNotice({ retest, onBack }: Props) {
  return (
    <Box role="status" sx={{ p: { xs: 2, sm: 4 }, display: 'grid', gap: 2, justifyItems: 'start' }}>
      <Typography>{retest ? 'There are no wrong words to retest.' : 'No words are available for this round.'}</Typography>
      {retest && (
        <Button variant="outlined" onClick={onBack}>
          Back to the quiz
        </Button>
      )}
    </Box>
  );
}
