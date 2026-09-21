import { Box } from '@mui/material';

/** Meaning groups of a word, separated by a grey slash; the synonyms of a group by commas. */
export function MeaningCell({ groups }: { groups: readonly (readonly string[])[] }) {
  return (
    <>
      {groups.map((group, index) => (
        <span key={index}>
          {index > 0 && (
            <Box component="span" aria-hidden sx={{ color: 'text.secondary' }}>
              {' / '}
            </Box>
          )}
          {group.join(', ')}
        </span>
      ))}
    </>
  );
}
