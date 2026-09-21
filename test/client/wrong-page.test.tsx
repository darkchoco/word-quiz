import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppContext, type AppContextValue } from '../../src/client/app-context';
import { Shell } from '../../src/client/components/Shell';
import { pool } from './quiz-data';
import { WrongPage } from '../../src/client/components/WrongPage';
import { ApiError } from '../../src/client/api';
import { errorReply, fakeFetch } from './fake-fetch';
import { renderWithTheme, session } from './render';
import { gravis, word } from './words-data';

afterEach(() => vi.unstubAllGlobals());

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

const page = (onRetest = vi.fn(), ctx = context()) => ({
  onRetest,
  ctx,
  ...renderWithTheme(
    <AppContext.Provider value={ctx}>
      <WrongPage onRetest={onRetest} />
    </AppContext.Provider>,
  ),
});

describe('WrongPage', () => {
  it('shows the count, the words and their meaning groups', async () => {
    fakeFetch({ 'GET /api/wrong': { body: { words: [gravis, word({ id: 5, headword: 'equus', meanings: [['Pferd']] })] } } });
    page();
    expect(await screen.findByRole('heading', { name: /Wrong words\s*\(2\)/ })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Wrong words' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText('gravis, e')).toBeTruthy();
    expect(rows[1]!.textContent).toContain('schwer');
    expect(rows[1]!.textContent).toContain('ernst, wichtig');
    expect(screen.getByText('Words marked done are removed from this list.')).toBeTruthy();
  });

  it('marks the headword as Latin', async () => {
    fakeFetch({ 'GET /api/wrong': { body: { words: [gravis] } } });
    page();
    expect((await screen.findByText('gravis, e')).getAttribute('lang')).toBe('la');
  });

  it('leaves no table and disables the button when nothing is wrong', async () => {
    fakeFetch({ 'GET /api/wrong': { body: { words: [] } } });
    page();
    expect(await screen.findByText('No wrong words.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect((screen.getByRole('button', { name: 'Retest wrong only' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onRetest when the button is pressed', async () => {
    fakeFetch({ 'GET /api/wrong': { body: { words: [gravis] } } });
    const { user, onRetest } = page();
    await user.click(await screen.findByRole('button', { name: 'Retest wrong only' }));
    expect(onRetest).toHaveBeenCalledTimes(1);
  });

  it('hands a failed load to the common error handling and shows nothing', async () => {
    fakeFetch({ 'GET /api/wrong': errorReply(409, 'NO_SESSION') });
    const ctx = context();
    page(vi.fn(), ctx);
    await waitFor(() => expect(ctx.handleApiError).toHaveBeenCalledTimes(1));
    expect((vi.mocked(ctx.handleApiError).mock.calls[0]![0] as ApiError).code).toBe('NO_SESSION');
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('Retest wrong only through the shell', () => {
  it('asks for the retest and opens the quiz tab', async () => {
    window.location.hash = '#/wrong';
    fakeFetch({
      'GET /api/wrong': { body: { words: [gravis] } },
      'GET /api/rounds/current': errorReply(404, 'NO_ACTIVE_ROUND'),
      'GET /api/pool': { body: pool({ wrongAvailable: 1 }) },
    });
    const ctx = context();
    const { user } = renderWithTheme(
      <AppContext.Provider value={ctx}>
        <Shell />
      </AppContext.Provider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Retest wrong only' }));
    expect(ctx.requestRetest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(window.location.hash).toBe('#/quiz'));
    window.location.hash = '';
  });
});
