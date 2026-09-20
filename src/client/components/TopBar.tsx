import { Box, Button, Typography } from '@mui/material';
import { MONO_FONT, WORD_FONT } from '../theme';

const LANGUAGE_NAMES: Record<string, string> = { latin: 'Latin' };

interface Props {
  language: string;
  db: string;
  onSwitchDb: () => void;
}

export function TopBar({ language, db, onSwitchDb }: Props) {
  return (
    <Box
      component="header"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2, py: 1, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography sx={{ fontFamily: WORD_FONT, fontSize: 20, fontWeight: 600 }}>Word Quiz</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {LANGUAGE_NAMES[language] ?? language} ▸{' '}
          <Box component="code" sx={{ fontFamily: MONO_FONT, color: 'text.primary' }}>
            {db}
          </Box>
        </Typography>
        <Button size="small" variant="outlined" onClick={onSwitchDb} sx={{ flexShrink: 0 }}>
          Switch DB
        </Button>
      </Box>
    </Box>
  );
}
