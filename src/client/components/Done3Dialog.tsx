import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { WORD_FONT } from '../theme';

interface Props {
  open: boolean;
  headword: string;
  busy?: boolean;
  onAnswer: (yes: boolean) => void;
}

export function Done3Dialog({ open, headword, busy = false, onAnswer }: Props) {
  return (
    <Dialog open={open} onClose={() => onAnswer(false)} aria-labelledby="done3-title" aria-describedby="done3-text" maxWidth="xs" fullWidth>
      <DialogTitle id="done3-title">
        <Box component="span" lang="la" sx={{ fontFamily: WORD_FONT, fontSize: 19, fontFeatureSettings: '"locl" 0' }}>
          {headword}
        </Box>{' '}
        answered correctly 3 times in a row
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="done3-text">Mark this word as done?</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button autoFocus disabled={busy} onClick={() => onAnswer(false)}>
          No
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => onAnswer(true)}>
          Yes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
