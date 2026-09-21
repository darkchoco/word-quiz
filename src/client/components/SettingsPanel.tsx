import { Box, Button, TextField, Typography } from '@mui/material';

interface Props {
  value: string;
  error: string | null;
  saved: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

/** The settings form: for now only the number of questions of a round. */
export function SettingsPanel({ value, error, saved, saving, onChange, onSave }: Props) {
  return (
    <Box
      component="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      sx={{ p: { xs: 2, sm: 4 }, display: 'grid', gap: 2, justifyItems: 'start' }}
    >
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
        Settings
      </Typography>
      <TextField
        label="Questions per round"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error !== null}
        helperText={error}
        slotProps={{ htmlInput: { min: 1, max: 200, step: 1, inputMode: 'numeric' }, formHelperText: { role: error ? 'alert' : undefined } }}
        sx={{ maxWidth: 260, width: '100%' }}
      />
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button type="submit" variant="contained" disabled={saving}>
          Save
        </Button>
        {saved && (
          <Typography role="status" sx={{ fontSize: 13.5, color: 'success.main' }}>
            Saved
          </Typography>
        )}
      </Box>
    </Box>
  );
}
