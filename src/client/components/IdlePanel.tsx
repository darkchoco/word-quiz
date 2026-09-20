import { Alert, Box, Button, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Typography } from '@mui/material';
import type { PoolInfo } from '../../shared/api';
import { MONO_FONT } from '../theme';

interface Props {
  pool: PoolInfo;
  retest: boolean;
  busy: boolean;
  onStart: () => void;
}

const strong = { fontFamily: MONO_FONT, fontWeight: 500, color: 'text.primary' } as const;

/** Before a round: direction, which round comes next and how many words it can ask. */
export function IdlePanel({ pool, retest, busy, onStart }: Props) {
  const number = retest ? pool.retestRoundNumber : pool.nextRoundNumber;
  const available = retest ? pool.wrongAvailable : pool.available;
  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, display: 'grid', gap: 2.5, maxWidth: 560 }}>
      {retest && (
        <Alert severity="info" icon={false}>
          <b>Retest wrong words</b>
          <Box component="div" sx={{ fontSize: 13 }}>
            The round is built only from words marked wrong. The usual exclusion rules still apply.
          </Box>
        </Alert>
      )}
      <FormControl>
        <FormLabel id="direction-label" sx={{ fontSize: 13 }}>
          Direction
        </FormLabel>
        <RadioGroup row aria-labelledby="direction-label" value="word_to_meaning" sx={{ columnGap: 2 }}>
          <FormControlLabel value="word_to_meaning" control={<Radio />} label="Word → Meaning" />
          <FormControlLabel value="meaning_to_word" disabled control={<Radio />} label="Meaning → Word" />
          <FormControlLabel value="mix" disabled control={<Radio />} label="Mix" />
        </RadioGroup>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Latin supports Word → Meaning only.</Typography>
      </FormControl>
      <Typography color="text.secondary" sx={{ fontSize: 14 }}>
        Round <Box component="b" sx={strong}>{number}</Box> · <Box component="b" sx={strong}>{available}</Box> words available ·{' '}
        <Box component="b" sx={strong}>{pool.questionsPerRound}</Box> questions per round
      </Typography>
      <Box>
        <Button variant="contained" size="large" sx={{ fontWeight: 600 }} disabled={busy} onClick={onStart}>
          Start
        </Button>
      </Box>
    </Box>
  );
}
