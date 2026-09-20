import { useEffect, useRef } from 'react';
import { Box, Button, LinearProgress, TextField, Typography } from '@mui/material';
import { WORD_FONT } from '../theme';

interface Props {
  headword: string;
  /** 1-based number of this question, and how many the round has. */
  position: number;
  total: number;
  /** Position the progress bar shows: the question itself counts once it is answered. */
  progress: number;
  value: string;
  /** After the submission the answer stays visible but cannot be changed. */
  locked: boolean;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function QuestionPanel({ headword, position, total, progress, value, locked, busy, onChange, onSubmit }: Props) {
  const input = useRef<HTMLInputElement>(null);
  // a new question starts with the cursor in the answer box
  useEffect(() => {
    if (!locked) input.current?.focus();
  }, [position, locked]);

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 13, color: 'text.secondary' }}>
        <span>Word → Meaning</span>
        <LinearProgress
          variant="determinate"
          value={total > 0 ? (progress / total) * 100 : 0}
          aria-label="Round progress"
          sx={{ flex: 1, height: 4, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.subtle' }}
        />
        <span aria-label="Question number">
          {position} / {total}
        </span>
      </Box>
      <Typography
        lang="la"
        component="div"
        sx={{ fontFamily: WORD_FONT, fontWeight: 500, fontSize: 'clamp(28px, 6vw, 42px)', lineHeight: 1.2, mt: 1.5, overflowWrap: 'anywhere', textWrap: 'balance', fontFeatureSettings: '"locl" 0' }}
      >
        {headword}
      </Typography>
      <Box
        component="form"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}
      >
        <TextField
          fullWidth
          size="small"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter the meaning (separate with commas)"
          disabled={false}
          inputRef={input}
          slotProps={{
            htmlInput: {
              'aria-label': 'Meaning',
              autoCapitalize: 'off',
              autoCorrect: 'off',
              autoComplete: 'off',
              spellCheck: false,
              enterKeyHint: 'send',
              readOnly: locked,
              maxLength: 1000,
            },
          }}
        />
        <Button type="submit" variant="contained" disabled={locked || busy || value.trim() === ''}>
          Submit
        </Button>
      </Box>
    </Box>
  );
}
