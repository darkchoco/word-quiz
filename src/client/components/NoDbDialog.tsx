import { Button, Dialog, DialogActions, DialogTitle } from '@mui/material';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NoDbDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} role="alertdialog" aria-labelledby="no-db-title" maxWidth="xs" fullWidth>
      <DialogTitle id="no-db-title">The selected DB does not exist.</DialogTitle>
      <DialogActions>
        <Button variant="contained" autoFocus onClick={onClose}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
