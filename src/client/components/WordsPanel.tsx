import { Box, Button, Checkbox, TextField, Typography } from '@mui/material';
import type { WordRow } from '../../shared/api';
import { formatMeanings } from '../../shared/meanings';
import { MONO_FONT } from '../theme';
import { MeaningCell } from './MeaningCell';
import { TableFrame } from './TableFrame';

/** A word being edited: what is typed so far, and why the last save did not work. */
export interface WordEdit {
  id: number;
  headword: string;
  meanings: string;
  error: string | null;
  saving: boolean;
}

interface Props {
  /** The words that match the search. */
  words: readonly WordRow[];
  total: number;
  query: string;
  edit: WordEdit | null;
  onQuery: (query: string) => void;
  onToggleDone: (word: WordRow, done: boolean) => void;
  onEdit: (word: WordRow) => void;
  onChangeEdit: (change: Partial<Pick<WordEdit, 'headword' | 'meanings'>>) => void;
  onSave: () => void;
  onCancel: () => void;
}

const inputProps = { fontSize: 14.5 } as const;

/** The word list: search box, table with the done check boxes, and the inline editor of one row. */
export function WordsPanel({ words, total, query, edit, onQuery, onToggleDone, onEdit, onChangeEdit, onSave, onCancel }: Props) {
  const filtered = words.length !== total;
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
          Words{' '}
          <Box component="span" sx={{ fontFamily: MONO_FONT, fontWeight: 500, fontSize: 14 }}>
            ({filtered ? `${words.length} of ${total}` : total})
          </Box>
        </Typography>
        <TextField
          size="small"
          placeholder="Search words"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          slotProps={{ htmlInput: { 'aria-label': 'Search words' } }}
          sx={{ flex: '0 1 220px', minWidth: 0 }}
        />
      </Box>
      {words.length === 0 ? (
        <Typography role="status" color="text.secondary">
          No words match.
        </Typography>
      ) : (
        <TableFrame label="Words">
          <thead>
            <tr>
              <th>Word</th>
              <th>Meaning</th>
              <th>Done</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {words.map((word) =>
              edit?.id === word.id ? (
                <tr key={word.id}>
                  <td className="word">
                    <TextField
                      size="small"
                      fullWidth
                      autoFocus
                      value={edit.headword}
                      onChange={(event) => onChangeEdit({ headword: event.target.value })}
                      onKeyDown={keys}
                      slotProps={{ htmlInput: { 'aria-label': 'Word', lang: 'la', style: inputProps } }}
                    />
                  </td>
                  <td>
                    <TextField
                      size="small"
                      fullWidth
                      value={edit.meanings}
                      onChange={(event) => onChangeEdit({ meanings: event.target.value })}
                      onKeyDown={keys}
                      error={edit.error !== null}
                      slotProps={{ htmlInput: { 'aria-label': 'Meaning', style: inputProps } }}
                    />
                    {edit.error && (
                      <Typography role="alert" sx={{ fontSize: 12.5, color: 'error.main', mt: 0.5 }}>
                        {edit.error}
                      </Typography>
                    )}
                  </td>
                  <td className="check">
                    <Checkbox checked={word.done} disabled slotProps={{ input: { 'aria-label': `Done: ${word.headword}` } }} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" variant="contained" disabled={edit.saving} onClick={onSave}>
                      Save
                    </Button>{' '}
                    <Button size="small" variant="outlined" disabled={edit.saving} onClick={onCancel}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={word.id}>
                  <td className="word" lang="la">
                    {word.headword}
                    {word.wrongMark && !word.done && (
                      <Box
                        component="span"
                        lang="en"
                        sx={{ fontFamily: 'inherit', fontSize: 11.5, color: 'error.main', border: 1, borderColor: 'error.main', borderRadius: 999, px: 0.75, ml: 0.75, whiteSpace: 'nowrap', verticalAlign: 'middle' }}
                      >
                        wrong
                      </Box>
                    )}
                  </td>
                  <td>
                    <MeaningCell groups={word.meanings} />
                  </td>
                  <td className="check">
                    <Checkbox
                      checked={word.done}
                      onChange={(event) => onToggleDone(word, event.target.checked)}
                      slotProps={{ input: { 'aria-label': `Done: ${word.headword}` } }}
                    />
                  </td>
                  <td>
                    <Button size="small" variant="outlined" aria-label={`Edit ${word.headword}`} onClick={() => onEdit(word)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </TableFrame>
      )}
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
        Separate meaning groups with <kbd>|</kbd> and synonyms within a group with commas. Words can only be added or removed with the import CLI.
      </Typography>
    </Box>
  );
}

/** What the editor shows for a word. */
export const editOf = (word: WordRow): WordEdit => ({ id: word.id, headword: word.headword, meanings: formatMeanings(word.meanings), error: null, saving: false });
