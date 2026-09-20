import { Box, Button, Typography } from '@mui/material';

export function ServerUnreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <Box sx={{ minHeight: 'var(--wq-min-h, 100dvh)', display: 'grid', placeItems: 'center', p: 2 }}>
      <Box role="alert" sx={{ maxWidth: 420, p: 4, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, textAlign: 'center', display: 'grid', gap: 2 }}>
        <Typography component="h1" sx={{ fontSize: 20, fontWeight: 600 }}>
          Cannot reach the server
        </Typography>
        <Typography color="text.secondary">Check that the Word Quiz window is still open, then try again.</Typography>
        <Button variant="contained" onClick={onRetry}>
          Retry
        </Button>
      </Box>
    </Box>
  );
}
