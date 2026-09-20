import { Box, Typography } from '@mui/material';

export function AllDoneNotice() {
  return (
    <Box role="status" sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600, mb: 1 }}>
        All words are done
      </Typography>
      <Typography color="text.secondary">All words are marked done. Nothing is left to practice.</Typography>
    </Box>
  );
}
