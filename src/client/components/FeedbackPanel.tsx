import { useEffect, useRef } from 'react';
import { Box, Button } from '@mui/material';
import type { AnswerResult } from '../../shared/api';

interface Props {
  result: AnswerResult;
  done: boolean;
  /** While a dialog is open the focus belongs to it. */
  blocked: boolean;
  busy: boolean;
  onMarkDone: () => void;
  onNext: () => void;
}

const verdictSx = {
  perfect: { bgcolor: 'success.light', color: 'success.main' },
  partial: { bgcolor: 'warning.light', color: 'warning.main' },
  wrong: { bgcolor: 'error.light', color: 'error.main' },
} as const;

/** The verdict, the answer (one coloured block per meaning group), Mark done and Next. */
export function FeedbackPanel({ result, done, blocked, busy, onMarkDone, onNext }: Props) {
  const next = useRef<HTMLButtonElement>(null);
  // Enter goes on to the next question: the focus is on Next as soon as nothing else has it
  useEffect(() => {
    if (!blocked) next.current?.focus({ preventScroll: true });
  }, [blocked]);

  const hits = result.groups.filter((g) => g.hit).length;
  const label = result.verdict === 'perfect' ? 'Perfect' : result.verdict === 'partial' ? `Partial (${hits}/${result.groups.length})` : 'Wrong';
  return (
    <Box aria-live="polite" sx={{ px: { xs: 2, sm: 4 }, pb: { xs: 2, sm: 4 }, display: 'grid', gap: 1.25 }}>
      <Box sx={{ alignSelf: 'flex-start', justifySelf: 'start', fontWeight: 700, fontSize: 13.5, borderRadius: 1, px: 1.25, py: 0.25, ...verdictSx[result.verdict] }}>{label}</Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', alignItems: 'baseline' }}>
        <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', mr: 0.25 }}>
          Answer
        </Box>
        {result.groups.map((group, index) => (
          <Box
            key={index}
            component="span"
            data-hit={group.hit}
            sx={{ display: 'inline-flex', gap: 0.75, alignItems: 'baseline', borderRadius: 1, py: '1px', pl: 1, pr: 1.25, fontWeight: 500, ...(group.hit ? verdictSx.perfect : verdictSx.wrong) }}
          >
            <Box component="i" sx={{ fontStyle: 'normal', fontSize: 12 }} aria-label={group.hit ? 'matched' : 'missed'}>
              {group.hit ? '✓' : '✗'}
            </Box>
            {group.synonyms.join(', ')}
          </Box>
        ))}
      </Box>
      {result.groups.length > 1 && (
        <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>Each colored block is one meaning group. One synonym per group is enough.</Box>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', mt: 0.5 }}>
        <Button variant="outlined" color="inherit" disabled={!result.canMarkDone || done || busy} onClick={onMarkDone} title={result.canMarkDone ? undefined : 'Cannot mark done after a wrong answer'}>
          {done ? 'Done' : 'Mark done'}
        </Button>
        <Button ref={next} variant="contained" onClick={onNext}>
          Next&nbsp;<Box component="kbd" sx={{ fontFamily: 'inherit', fontSize: 11, opacity: 0.8, border: 1, borderColor: 'currentColor', borderRadius: 0.5, px: 0.5 }}>Enter</Box>
        </Button>
      </Box>
    </Box>
  );
}
