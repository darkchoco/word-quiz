import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/client/App';
import { ApiError } from '../../src/client/api';
import { classifyApiError } from '../../src/client/app-context';
import { ErrorBoundary } from '../../src/client/ErrorBoundary';
import { errorReply, fakeFetch } from './fake-fetch';
import { databases, renderWithTheme, session } from './render';

beforeEach(() => {
  window.location.hash = '';
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const noSession = errorReply(404, 'NO_SESSION');

describe('start screen', () => {
  it('shows Latin selected, English disabled with "Coming soon", and the databases', async () => {
    fakeFetch({ 'GET /api/session': noSession, 'GET /api/databases': { body: { databases } } });
    renderWithTheme(<App />);
    expect(await screen.findByRole('heading', { name: 'Word Quiz' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Latin' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /English/ })).toBeDisabled();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Database' })).toHaveTextContent('latin.db');
  });

  it('starts the selected database and shows the shell', async () => {
    const { calls } = fakeFetch({
      'GET /api/session': noSession,
      'GET /api/databases': { body: { databases } },
      'POST /api/session': { body: session() },
    });
    const { user } = renderWithTheme(<App />);
    await screen.findByRole('combobox', { name: 'Database' });
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('button', { name: 'Switch DB' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ db: 'latin.db' });
  });

  it('selects the database that was used last, and remembers a new choice', async () => {
    window.localStorage.setItem('wordquiz.lastDb', 'latin_2.db');
    const { calls } = fakeFetch({
      'GET /api/session': noSession,
      'GET /api/databases': { body: { databases } },
      'POST /api/session': { body: session({ db: 'latin_2.db' }) },
    });
    const { user } = renderWithTheme(<App />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Database' })).toHaveTextContent('latin_2.db'));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByRole('button', { name: 'Switch DB' });
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ db: 'latin_2.db' });
    expect(window.localStorage.getItem('wordquiz.lastDb')).toBe('latin_2.db');
  });

  it('ignores a remembered database that no longer exists', async () => {
    window.localStorage.setItem('wordquiz.lastDb', 'gone.db');
    fakeFetch({ 'GET /api/session': noSession, 'GET /api/databases': { body: { databases } } });
    renderWithTheme(<App />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Database' })).toHaveTextContent('latin.db'));
  });

  it('DB_NOT_FOUND from Start shows the alert; OK stays on the start screen and reloads the list', async () => {
    const { calls } = fakeFetch({
      'GET /api/session': noSession,
      'GET /api/databases': [{ body: { databases } }, { body: { databases: [databases[1]] } }],
      'POST /api/session': errorReply(404, 'DB_NOT_FOUND'),
    });
    const { user } = renderWithTheme(<App />);
    await screen.findByRole('combobox', { name: 'Database' });
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('alertdialog', { name: 'The selected DB does not exist.' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Database' })).toHaveTextContent('latin_2.db'));
    expect(calls.filter((c) => c.path === '/api/databases')).toHaveLength(2);
  });

  it('shows the alert when no database is selected (empty list)', async () => {
    fakeFetch({ 'GET /api/session': noSession, 'GET /api/databases': { body: { databases: [] } } });
    const { user } = renderWithTheme(<App />);
    expect(await screen.findByText(/No database yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('explains when the list cannot be read, and Retry loads it again', async () => {
    fakeFetch({
      'GET /api/session': noSession,
      'GET /api/databases': [errorReply(500, 'INTERNAL_ERROR'), { body: { databases } }],
    });
    const { user } = renderWithTheme(<App />);
    expect(await screen.findByText('The database list could not be read.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('combobox', { name: 'Database' })).toBeInTheDocument();
  });
});

describe('shell', () => {
  const withSession = (extra: Record<string, never> = {}) =>
    fakeFetch({ 'GET /api/session': { body: session() }, 'GET /api/databases': { body: { databases } }, ...extra });

  it('shows the database, the four tabs and the status bar', async () => {
    withSession();
    renderWithTheme(<App />);
    expect(await screen.findByText('latin.db')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Latin ▸ latin.db');
    const nav = screen.getByRole('navigation', { name: 'Menu' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['Quiz', 'Wrong', 'Words', 'Settings']);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Total words 178');
    expect(footer).toHaveTextContent('Session tested 15 / correct 11');
  });

  it('marks the active tab with aria-current and follows the hash', async () => {
    window.location.hash = '#/words';
    withSession();
    renderWithTheme(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Menu' });
    expect(within(nav).getByRole('button', { name: 'Words' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'Quiz' })).not.toHaveAttribute('aria-current');
  });

  it('a tab click changes the tab and the hash', async () => {
    withSession();
    const { user } = renderWithTheme(<App />);
    const nav = await screen.findByRole('navigation', { name: 'Menu' });
    await user.click(within(nav).getByRole('button', { name: 'Settings' }));
    await waitFor(() => expect(within(nav).getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page'));
    expect(window.location.hash).toBe('#/settings');
  });

  it('Switch DB asks first; Cancel changes nothing', async () => {
    const { calls } = withSession();
    const { user } = renderWithTheme(<App />);
    await user.click(await screen.findByRole('button', { name: 'Switch DB' }));
    expect(await screen.findByRole('dialog', { name: 'Switch DB?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.getByRole('button', { name: 'Switch DB' })).toBeInTheDocument();
  });

  it('Switch ends the session on the server and returns to the start screen', async () => {
    const { calls } = withSession({ 'DELETE /api/session': { status: 204 } } as never);
    const { user } = renderWithTheme(<App />);
    await user.click(await screen.findByRole('button', { name: 'Switch DB' }));
    await user.click(await screen.findByRole('button', { name: 'Switch' }));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: 'Menu' })).toBeNull();
  });

  it('a failing DELETE keeps the shell and shows the message', async () => {
    withSession({ 'DELETE /api/session': errorReply(500, 'INTERNAL_ERROR', 'Disk error') } as never);
    const { user } = renderWithTheme(<App />);
    await user.click(await screen.findByRole('button', { name: 'Switch DB' }));
    await user.click(await screen.findByRole('button', { name: 'Switch' }));
    expect(await screen.findByText('Disk error')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('navigation', { name: 'Menu' })).toBeInTheDocument();
  });
});

describe('boot errors', () => {
  it('shows a message and Retry when the server cannot be reached', async () => {
    fakeFetch({ 'GET /api/session': [new TypeError('Failed to fetch'), { body: session() }] });
    const { user } = renderWithTheme(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('navigation', { name: 'Menu' })).toBeInTheDocument();
  });

  it('treats an unreadable answer at boot as unreachable', async () => {
    fakeFetch({ 'GET /api/session': { status: 502, raw: '<html/>' } });
    renderWithTheme(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});

describe('ErrorBoundary', () => {
  it('shows a reload message instead of a blank page', () => {
    const Bomb = () => {
      throw new Error('boom');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithTheme(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('classifyApiError', () => {
  const err = (code: string, message = 'm') => new ApiError(code as never, 0, message);
  it.each([
    [err('NO_SESSION'), { kind: 'start', noDbNotice: false }],
    [err('DB_NOT_FOUND'), { kind: 'start', noDbNotice: true }],
    [err('NETWORK_ERROR'), { kind: 'message', text: 'Cannot reach the server.' }],
    [err('EMPTY_INPUT', 'Type an answer.'), { kind: 'message', text: 'Type an answer.' }],
    [err('INTERNAL_ERROR', ''), { kind: 'message', text: 'Something went wrong.' }],
    [new Error('x'), { kind: 'message', text: 'Something went wrong.' }],
  ])('%#', (error, expected) => expect(classifyApiError(error)).toEqual(expected));
});
