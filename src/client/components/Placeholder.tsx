import { Box, Typography } from '@mui/material';
import { TAB_LABELS, type Tab } from '../hooks/useHashRoute';

/** Stands in for the tab contents that later milestones build. */
export function Placeholder({ tab }: { tab: Tab }) {
  return (
    <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
      <Typography component="h2" sx={{ fontSize: 18, color: 'text.primary', mb: 1 }}>
        {TAB_LABELS[tab]}
      </Typography>
      <Typography>This screen is not built yet.</Typography>
    </Box>
  );
}
