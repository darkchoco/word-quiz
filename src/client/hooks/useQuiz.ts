import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnswerResult, PoolInfo, Question, RoundState, RoundSummary } from '../../shared/api';
import { api, ApiError } from '../api';
import { useApp } from '../app-context';

export type QuizState =
  | { phase: 'loading' }
  | { phase: 'failed' }
  | { phase: 'idle'; pool: PoolInfo }
  | { phase: 'question'; round: RoundState; question: Question }
  /** After a submission: the answered question, its result, and what happens on Next. */
  | { phase: 'feedback'; total: number; question: Question; result: AnswerResult; done: boolean; asking: boolean }
  | { phase: 'result'; summary: RoundSummary };

export interface Quiz {
  state: QuizState;
  /** What is typed in the answer box (kept while the feedback is shown). */
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  retest: boolean;
  start: () => void;
  submit: () => void;
  next: () => void;
  markDone: () => void;
  answerDoneDialog: (yes: boolean) => void;
  playAgain: () => void;
  reload: () => void;
  cancelRetest: () => void;
}

/**
 * The state machine of the quiz tab: idle -> question -> feedback -> question ... -> result.
 * Everything that must survive a reload lives on the server, so on mount this asks for the
 * current round (`GET /rounds/current`) and continues at its next question.
 */
export function useQuiz(): Quiz {
  const { handleApiError, updateStats, retestRequested, clearRetest } = useApp();
  const [state, setState] = useState<QuizState>({ phase: 'loading' });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const show = useCallback((next: QuizState) => {
    if (alive.current) setState(next);
  }, []);

  /** Shows the round at its next question, or the idle screen if there is nothing to continue. */
  const load = useCallback(async () => {
    try {
      const round = await api.currentRound();
      if (round.question) {
        setInput('');
        show({ phase: 'question', round, question: round.question });
        return;
      }
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'NO_ACTIVE_ROUND')) {
        handleApiError(error);
        show({ phase: 'failed' });
        return;
      }
    }
    try {
      show({ phase: 'idle', pool: await api.pool() });
    } catch (error) {
      handleApiError(error);
      show({ phase: 'failed' });
    }
  }, [handleApiError, show]);

  useEffect(() => {
    void load();
  }, [load]);

  const guarded = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      try {
        await action();
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [],
  );

  const start = useCallback(() => {
    void guarded(async () => {
      try {
        const round = await api.startRound(retestRequested ? 'retest' : 'normal', 'word_to_meaning');
        clearRetest();
        if (round.question) {
          setInput('');
          show({ phase: 'question', round, question: round.question });
        } else await load();
      } catch (error) {
        if (error instanceof ApiError && ['ROUND_IN_PROGRESS', 'POOL_EMPTY', 'ALL_DONE'].includes(error.code)) {
          // the screen is out of date: show what the server says now
          await load();
        } else handleApiError(error);
      }
    });
  }, [guarded, retestRequested, clearRetest, show, load, handleApiError]);

  const submit = useCallback(() => {
    if (state.phase !== 'question' || input.trim() === '' || busy) return;
    const { round, question } = state;
    void guarded(async () => {
      try {
        const result = await api.answer(round.roundId, question.position, input);
        updateStats(result.stats);
        show({ phase: 'feedback', total: round.total, question, result, done: false, asking: result.askDone });
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'ALREADY_ANSWERED' || error.code === 'OUT_OF_ORDER')) await load();
        else handleApiError(error);
      }
    });
  }, [state, input, busy, guarded, updateStats, show, load, handleApiError]);

  const next = useCallback(() => {
    if (state.phase !== 'feedback' || state.asking) return;
    const { result } = state;
    setInput('');
    if (result.round.question) show({ phase: 'question', round: result.round, question: result.round.question });
    else if (result.summary) show({ phase: 'result', summary: result.summary });
    else void load();
  }, [state, show, load]);

  const setDone = useCallback(
    (question: Question, result: AnswerResult) =>
      guarded(async () => {
        try {
          await api.setDone(result.wordId, true, question.position);
          setState((s) => (s.phase === 'feedback' ? { ...s, done: true, asking: false } : s));
        } catch (error) {
          setState((s) => (s.phase === 'feedback' ? { ...s, asking: false } : s));
          handleApiError(error);
        }
      }),
    [guarded, handleApiError],
  );

  const markDone = useCallback(() => {
    if (state.phase === 'feedback' && state.result.canMarkDone && !state.done) void setDone(state.question, state.result);
  }, [state, setDone]);

  const answerDoneDialog = useCallback(
    (yes: boolean) => {
      if (state.phase !== 'feedback') return;
      if (yes) void setDone(state.question, state.result);
      else setState({ ...state, asking: false });
    },
    [state, setDone],
  );

  const playAgain = useCallback(() => {
    setState({ phase: 'loading' });
    void load();
  }, [load]);

  const reload = playAgain;

  return { state, input, setInput, busy, retest: retestRequested, start, submit, next, markDone, answerDoneDialog, playAgain, reload, cancelRetest: clearRetest };
}
