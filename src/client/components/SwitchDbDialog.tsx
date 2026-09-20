import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

interface Props {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSwitch: () => void;
}

export function SwitchDbDialog({ open, busy = false, onCancel, onSwitch }: Props) {
  return (
    <Dialog open={open} onClose={onCancel} aria-labelledby="switch-db-title" aria-describedby="switch-db-text" maxWidth="xs" fullWidth>
      <DialogTitle id="switch-db-title">Switch DB?</DialogTitle>
      <DialogContent>
        <DialogContentText id="switch-db-text">The current session will end and a new session will start.</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" disabled={busy} onClick={onSwitch}>
          Switch
        </Button>
      </DialogActions>
    </Dialog>
  );
}
