import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/client/App';
import { AppContext, type AppContextValue } from '../../src/client/app-context';
import { QuizPage } from '../../src/client/components/QuizPage';
import { errorReply, fakeFetch } from './fake-fetch';
import { answerResult, pool, round, stats } from './quiz-data';
import { renderWithTheme, session } from './render';

afterEach(() => vi.unstubAllGlobals());

const noRound = errorReply(404, 'NO_ACTIVE_ROUND');

function context(over: Partial<AppContextValue> = {}): AppContextValue {
  return {
    session: session(),
    setSession: vi.fn(),
    handleApiError: vi.fn(),
    switchDb: vi.fn(),
    updateStats: vi.fn(),
    retestRequested: false,
    requestRetest: vi.fn(),
    clearRetest: vi.fn(),
    ...over,
  };
}

const page = (ctx = context()) =>
  renderWithTheme(
    <AppContext.Provider value={ctx}>
      <QuizPage />
    </AppContext.Provider>,
  );

const type = async (user: ReturnType<typeof renderWithTheme>['user'], text: string) => {
  await user.type(await screen.findByRole('textbox', { name: 'Meaning' }), `${text}{Enter}`);
};

describe('the whole round', () => {
  it('idle -> Start -> answer -> feedback -> Next -> ... -> result -> Play again', async () => {
    const answers = [
      { body: answerResult({ verdict: 'perfect', stats: stats(1, 1), round: round(1, 2, ['taurus', 'canis']) }) },
      {
        body: answerResult({
          verdict: 'partial',
          groups: [{ synonyms: ['Hund'], hit: true }, { synonyms: ['Köter'], hit: false }],
          stats: stats(2, 1),
          round: round(2, 2, ['taurus', 'canis']),
          summary: { total: 2, correct: 1, percent: 50 },
        }),
      },
    ];
    const { calls } = fakeFetch({
      'GET /api/rounds/current': noRound,
      'GET /api/pool': { body: pool({ nextRoundNumber: 12, available: 143 }) },
      'POST /api/rounds': { body: round(0, 2, ['taurus', 'canis']) },
      'POST /api/rounds/7/answers': answers,
    });
    const ctx = context();
    const { user } = page(ctx);

    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(calls.find((c) => c.path === '/api/rounds')?.body).toEqual({ mode: 'normal', direction: 'word_to_meaning' });
    expect(await screen.findByText('taurus')).toHaveAttribute('lang', 'la');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    const bar = () => screen.getByRole('progressbar', { name: 'Round progress' }).getAttribute('aria-valuenow');
    expect(bar()).toBe('0');

    await type(user, 'Stier');
    expect(calls.find((c) => c.path.endsWith('/answers'))?.body).toEqual({ position: 1, input: 'Stier' });
    expect(await screen.findByText('Perfect')).toBeInTheDocument();
    expect(ctx.updateStats).toHaveBeenLastCalledWith(stats(1, 1));
    // the answer stays visible and the focus is on Next, so Enter goes on
    expect(bar()).toBe('50');
    expect(screen.getByRole('textbox', { name: 'Meaning' })).toHaveValue('Stier');
    expect(screen.getByRole('button', { name: /^Next/ })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(await screen.findByText('canis')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Meaning' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Meaning' })).toHaveValue('');

    await type(user, 'Hund');
    expect(await screen.findByText('Partial (1/2)')).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith('/answers') && (c.body as { position: number }).position === 2)).toBeDefined();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Round complete')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 correct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play again' }));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  it('a wrong answer cannot be marked done', async () => {
    fakeFetch({
      'GET /api/rounds/current': noRound,
      'GET /api/pool': { body: pool() },
      'POST /api/rounds': { body: round(0) },
      'POST /api/rounds/7/answers': { body: answerResult({ verdict: 'wrong', canMarkDone: false, groups: [{ synonyms: ['Stier'], hit: false }], round: round(1) }) },
    });
    const { user } = page();
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await type(user, 'Kuh');
    expect(await screen.findByText('Wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeDisabled();
  });

  it('Mark done sends the position of the question and then says Done', async () => {
    const { calls } = fakeFetch({
      'GET /api/rounds/current': noRound,
      'GET /api/pool': { body: pool() },
      'POST /api/rounds': { body: round(0) },
      'POST /api/rounds/7/answers': { body: answerResult({ wordId: 42, round: round(1) }) },
      'POST /api/words/42/done': { body: { id: 42, headword: 'taurus', meanings: [['Stier']], done: true, wrongMark: false } },
    });
    const { user } = page();
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    await type(user, 'Stier');
    await user.click(await screen.findByRole('button', { name: 'Mark done' }));
    expect(await screen.findByRole('button', { name: 'Done' })).toBeDisabled();
    expect(calls.find((c) => c.path === '/api/words/42/done')?.body).toEqual({ done: true, questionPosition: 1 });
  });

  it('does not send a blank answer', async () => {
    const { calls } = fakeFetch({ 'GET /api/rounds/current': { body: round(0) } });
    const { user } = page();
    await user.type(await screen.findByRole('textbox', { name: 'Meaning' }), '   {Enter}');
    expect(calls.some((c) => c.path.endsWith('/answers'))).toBe(false);
  });
});

describe('three Perfect answers in a row', () => {
  const routes = (finished: boolean) => ({
    'GET /api/rounds/current': { body: round(0, 1) },
    'POST /api/rounds/7/answers': {
      body: answerResult({
        askDone: true,
        wordId: 42,
        round: round(1, 1),
        summary: finished ? { total: 1, correct: 1, percent: 100 } : null,
      }),
    },
    'POST /api/words/42/done': { body: { id: 42, headword: 'taurus', meanings: [['Stier']], done: true, wrongMark: false } },
  });

  it('Yes marks the word done, with the position of the question', async () => {
    const { calls } = fakeFetch(routes(true));
    const { user } = page();
    await type(user, 'Stier');
    expect(await screen.findByRole('dialog', { name: /taurus answered correctly 3 times in a row/ })).toBeInTheDocument();
    // the round is over, but the result waits until the question is closed
    expect(screen.queryByText('Round complete')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.find((c) => c.path === '/api/words/42/done')?.body).toEqual({ done: true, questionPosition: 1 });
    expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Next/ })).toHaveFocus());
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Round complete')).toBeInTheDocument();
  });

  it('No keeps the word and sends nothing', async () => {
    const { calls } = fakeFetch(routes(false));
    const { user } = page();
    await type(user, 'Stier');
    await user.click(await screen.findByRole('button', { name: 'No' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.path.includes('/done'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Next/ })).toHaveFocus());
  });

  it('Next does nothing while the question is open', async () => {
    fakeFetch(routes(true));
    const { user } = page();
    await type(user, 'Stier');
    await screen.findByRole('dialog');
    // the dialog covers Next, but even a click that gets through must not leave the question open
    fireEvent.click(screen.getByRole('button', { name: /^Next/, hidden: true }));
    expect(screen.queryByText('Round complete')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('continuing and starting', () => {
  it('continues a round that is already open, without asking for the pool', async () => {
    const { calls } = fakeFetch({ 'GET /api/rounds/current': { body: round(2, 5, ['a', 'b', 'c', 'd', 'e']) } });
    page();
    expect(await screen.findByText('c')).toBeInTheDocument();
    expect(screen.getByText('3 / 5')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/pool')).toBe(false);
  });

  it('a retest is started as a retest and the request is used up', async () => {
    const { calls } = fakeFetch({
      'GET /api/rounds/current': noRound,
      'GET /api/pool': { body: pool({ retestRoundNumber: 3, wrongAvailable: 4 }) },
      'POST /api/rounds': { body: round(0, 4, [], { mode: 'retest' }) },
    });
    const ctx = context({ retestRequested: true });
    const { user } = page(ctx);
    expect(await screen.findByText('Retest wrong words')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByRole('textbox', { name: 'Meaning' });
    expect(calls.find((c) => c.path === '/api/rounds')?.body).toEqual({ mode: 'retest', direction: 'word_to_meaning' });
    expect(ctx.clearRetest).toHaveBeenCalled();
  });

  it('a retest without wrong words says so and can go back', async () => {
    fakeFetch({ 'GET /api/rounds/current': noRound, 'GET /api/pool': { body: pool({ wrongAvailable: 0 }) } });
    const ctx = context({ retestRequested: true });
    const { user } = page(ctx);
    expect(await screen.findByText('There are no wrong words to retest.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to the quiz' }));
    expect(ctx.clearRetest).toHaveBeenCalled();
  });

  it('all words done shows the notice instead of Start', async () => {
    fakeFetch({ 'GET /api/rounds/current': noRound, 'GET /api/pool': { body: pool({ allDone: true, available: 0 }) } });
    page();
    expect(await screen.findByText('All words are marked done. Nothing is left to practice.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
  });

  it('ROUND_IN_PROGRESS on Start continues that round', async () => {
    fakeFetch({
      'GET /api/rounds/current': [noRound, { body: round(1) }],
      'GET /api/pool': { body: pool() },
      'POST /api/rounds': errorReply(409, 'ROUND_IN_PROGRESS'),
    });
    const { user } = page();
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByText('canis')).toBeInTheDocument();
  });

  it('POOL_EMPTY on Start shows what the server says now', async () => {
    fakeFetch({
      'GET /api/rounds/current': noRound,
      'GET /api/pool': [{ body: pool() }, { body: pool({ available: 0 }) }],
      'POST /api/rounds': errorReply(409, 'POOL_EMPTY'),
    });
    const { user } = page();
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByText('No words are available for this round.')).toBeInTheDocument();
  });

  it('ALREADY_ANSWERED brings the screen up to date', async () => {
    fakeFetch({
      'GET /api/rounds/current': [{ body: round(0) }, { body: round(1) }],
      'POST /api/rounds/7/answers': errorReply(409, 'ALREADY_ANSWERED'),
    });
    const { user } = page();
    await type(user, 'Stier');
    expect(await screen.findByText('canis')).toBeInTheDocument();
  });

  it('other errors go to the common handler', async () => {
    const ctx = context();
    fakeFetch({ 'GET /api/rounds/current': { body: round(0) }, 'POST /api/rounds/7/answers': errorReply(500, 'INTERNAL', 'Disk error') });
    const { user } = page(ctx);
    await type(user, 'Stier');
    await waitFor(() => expect(ctx.handleApiError).toHaveBeenCalledTimes(1));
    expect((ctx.handleApiError as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({ code: 'INTERNAL' });
    // the answer can be sent again
    expect(screen.getByRole('textbox', { name: 'Meaning' })).not.toHaveAttribute('readonly');
  });

  it('a failure to load offers Retry', async () => {
    const ctx = context();
    fakeFetch({ 'GET /api/rounds/current': [errorReply(500, 'INTERNAL'), { body: round(0) }] });
    const { user } = page(ctx);
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('taurus')).toBeInTheDocument();
    expect(ctx.handleApiError).toHaveBeenCalled();
  });
});

describe('in the app', () => {
  it('the status bar follows every answer and NO_SESSION goes back to the start screen', async () => {
    window.location.hash = '#/quiz';
    fakeFetch({
      'GET /api/session': { body: session({ stats: stats(0, 0) }) },
      'GET /api/rounds/current': { body: round(0, 2) },
      'POST /api/rounds/7/answers': [
        { body: answerResult({ stats: stats(1, 1), round: round(1, 2) }) },
        errorReply(404, 'NO_SESSION'),
      ],
      'GET /api/databases': { body: { databases: [] } },
    });
    const { user } = renderWithTheme(<App />);
    await type(user, 'Stier');
    await waitFor(() => expect(screen.getByRole('contentinfo')).toHaveTextContent('Session tested 1 / correct 1'));
    await user.keyboard('{Enter}');
    await type(user, 'Hund');
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Menu' })).toBeNull();
  });
});
