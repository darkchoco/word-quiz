import { Box, Button, Typography } from '@mui/material';
import type { WordRow } from '../../shared/api';
import { MONO_FONT } from '../theme';
import { MeaningCell } from './MeaningCell';
import { TableFrame } from './TableFrame';

interface Props {
  words: readonly WordRow[];
  onRetest: () => void;
}

/** The wrong words as a table, with the button that starts a retest round of them. */
export function WrongPanel({ words, onRetest }: Props) {
  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
          Wrong words{' '}
          <Box component="span" sx={{ fontFamily: MONO_FONT, fontWeight: 500 }}>
            ({words.length})
          </Box>
        </Typography>
        <Button variant="contained" disabled={words.length === 0} onClick={onRetest}>
          Retest wrong only
        </Button>
      </Box>
      {words.length === 0 ? (
        <Typography role="status" color="text.secondary">
          No wrong words.
        </Typography>
      ) : (
        <TableFrame label="Wrong words">
          <thead>
            <tr>
              <th>Word</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {words.map((word) => (
              <tr key={word.id}>
                <td className="word" lang="la">
                  {word.headword}
                </td>
                <td>
                  <MeaningCell groups={word.meanings} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      )}
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Words marked done are removed from this list.</Typography>
    </Box>
  );
}
