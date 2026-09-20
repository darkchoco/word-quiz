import { Box, ButtonBase } from '@mui/material';
import { TABS, TAB_LABELS, type Tab } from '../hooks/useHashRoute';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

/** Plain buttons with `aria-current`: this is navigation between views, not a widget with panels. */
export function TabsBar({ active, onChange }: Props) {
  return (
    <Box component="nav" aria-label="Menu" sx={{ display: 'flex', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', px: 1 }}>
      {TABS.map((tab) => (
        <ButtonBase
          key={tab}
          onClick={() => onChange(tab)}
          aria-current={tab === active ? 'page' : undefined}
          sx={{
            flex: { xs: 1, sm: '0 0 auto' },
            px: 2,
            py: 1.25,
            fontSize: 14,
            fontWeight: 500,
            color: tab === active ? 'primary.main' : 'text.secondary',
            borderBottom: 2,
            borderColor: tab === active ? 'primary.main' : 'transparent',
          }}
        >
          {TAB_LABELS[tab]}
        </ButtonBase>
      ))}
    </Box>
  );
}
