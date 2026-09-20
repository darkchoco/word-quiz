import { Alert, Box, Button, Chip, FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, Select, Typography } from '@mui/material';
import type { DatabaseInfo } from '../../shared/api';
import { WORD_FONT } from '../theme';

interface Props {
  /** `null` while the list is being loaded. */
  databases: DatabaseInfo[] | null;
  /** Why the list could not be read, if it could not. */
  loadError: string | null;
  selected: string;
  starting: boolean;
  onSelect: (name: string) => void;
  onStart: () => void;
  onRetry: () => void;
}

export function StartScreen({ databases, loadError, selected, starting, onSelect, onStart, onRetry }: Props) {
  const empty = databases !== null && databases.length === 0;
  return (
    <Box sx={{ minHeight: 'var(--wq-min-h, 100dvh)', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.paper' }}>
      <Box
        component="section"
        sx={{
          width: '100%',
          maxWidth: 420,
          display: 'grid',
          gap: 2.5,
        }}
      >
        <Typography component="h1" sx={{ fontFamily: WORD_FONT, fontSize: 36, fontWeight: 600, lineHeight: 1.2 }}>
          Word Quiz
        </Typography>

        <FormControl>
          <FormLabel id="language-label" sx={{ fontSize: 13 }}>
            Language
          </FormLabel>
          <RadioGroup row aria-labelledby="language-label" value="latin" sx={{ columnGap: 2 }}>
            <FormControlLabel value="latin" control={<Radio />} label="Latin" />
            <FormControlLabel
              value="english"
              disabled
              control={<Radio />}
              label={
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                  English <Chip size="small" label="Coming soon" />
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        {loadError !== null ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
            {loadError}
          </Alert>
        ) : empty ? (
          <Alert severity="info">
            No database yet. Create one with the import tool (import.bat), then reload this page.
          </Alert>
        ) : (
          <FormControl fullWidth>
            <FormLabel id="database-label" sx={{ fontSize: 13, mb: 0.5 }}>
              Database
            </FormLabel>
            <Select
              size="small"
              value={databases?.some((d) => d.name === selected) ? selected : ''}
              onChange={(event) => onSelect(event.target.value)}
              disabled={databases === null}
              labelId="database-label"
            >
              {(databases ?? []).map((d) => (
                <MenuItem key={d.name} value={d.name}>
                  {d.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Button variant="contained" size="large" sx={{ fontWeight: 600 }} onClick={onStart} disabled={starting || databases === null || loadError !== null}>
          Start
        </Button>
      </Box>
    </Box>
  );
}
