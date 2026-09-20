import { Box, Button, Typography } from '@mui/material';
import { useQuiz } from '../hooks/useQuiz';
import { AllDoneNotice } from './AllDoneNotice';
import { Done3Dialog } from './Done3Dialog';
import { EmptyPoolNotice } from './EmptyPoolNotice';
import { FeedbackPanel } from './FeedbackPanel';
import { IdlePanel } from './IdlePanel';
import { QuestionPanel } from './QuestionPanel';
import { ResultPanel } from './ResultPanel';

/** The quiz tab: connects the state of `useQuiz` to the panels. */
export function QuizPage() {
  const quiz = useQuiz();
  const { state } = quiz;

  switch (state.phase) {
    case 'loading':
      return null;
    case 'failed':
      return (
        <Box sx={{ p: 4, display: 'grid', gap: 2, justifyItems: 'start' }}>
          <Typography>The quiz could not be loaded.</Typography>
          <Button variant="outlined" onClick={quiz.reload}>
            Retry
          </Button>
        </Box>
      );
    case 'idle': {
      const { pool } = state;
      if (pool.allDone) return <AllDoneNotice />;
      if (quiz.retest ? pool.wrongAvailable === 0 : pool.available === 0) return <EmptyPoolNotice retest={quiz.retest} onBack={quiz.cancelRetest} />;
      return <IdlePanel pool={pool} retest={quiz.retest} busy={quiz.busy} onStart={quiz.start} />;
    }
    case 'question':
      return (
        <QuestionPanel
          headword={state.question.headword}
          position={state.question.position}
          total={state.round.total}
          progress={state.question.position - 1}
          value={quiz.input}
          locked={false}
          busy={quiz.busy}
          onChange={quiz.setInput}
          onSubmit={quiz.submit}
        />
      );
    case 'feedback':
      return (
        <>
          <QuestionPanel
            headword={state.question.headword}
            position={state.question.position}
            total={state.total}
            progress={state.question.position}
            value={quiz.input}
            locked
            busy={quiz.busy}
            onChange={quiz.setInput}
            onSubmit={quiz.submit}
          />
          <FeedbackPanel result={state.result} done={state.done} blocked={state.asking} busy={quiz.busy} onMarkDone={quiz.markDone} onNext={quiz.next} />
          <Done3Dialog open={state.asking} headword={state.question.headword} busy={quiz.busy} onAnswer={quiz.answerDoneDialog} />
        </>
      );
    case 'result':
      return <ResultPanel summary={state.summary} onAgain={quiz.playAgain} />;
  }
}
