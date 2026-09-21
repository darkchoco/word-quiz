import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppContext, type AppContextValue } from '../../src/client/app-context';
import { SettingsPage } from '../../src/client/components/SettingsPage';
import { errorReply, fakeFetch } from './fake-fetch';
import { renderWithTheme, session } from './render';

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

const page = (ctx = context()) =>
  renderWithTheme(
    <AppContext.Provider value={ctx}>
      <SettingsPage />
    </AppContext.Provider>,
  );

const field = () => screen.findByRole('spinbutton', { name: 'Questions per round' }) as Promise<HTMLInputElement>;
const puts = (calls: { method: string; body: unknown }[]) => calls.filter((c) => c.method === 'PUT');

describe('SettingsPage', () => {
  it('shows the stored number', async () => {
    fakeFetch({ 'GET /api/settings': { body: { questionsPerRound: 35 } } });
    page();
    expect((await field()).value).toBe('35');
  });

  it('saves the number, says so, and tells the session about it', async () => {
    const { calls } = fakeFetch({
      'GET /api/settings': { body: { questionsPerRound: 20 } },
      'PUT /api/settings': (call) => ({ body: call.body }),
    });
    const ctx = context();
    const { user } = page(ctx);
    const input = await field();
    await user.clear(input);
    await user.type(input, '50');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
    expect(puts(calls)[0]!.body).toEqual({ questionsPerRound: 50 });
    expect(ctx.setSession).toHaveBeenCalledWith(expect.objectContaining({ questionsPerRound: 50 }));
  });

  it('saves with Enter', async () => {
    const { calls } = fakeFetch({
      'GET /api/settings': { body: { questionsPerRound: 20 } },
      'PUT /api/settings': (call) => ({ body: call.body }),
    });
    const { user } = page();
    const input = await field();
    await user.clear(input);
    await user.type(input, '7{Enter}');
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]!.body).toEqual({ questionsPerRound: 7 });
  });

  it('accepts both ends of the range', async () => {
    const { calls } = fakeFetch({
      'GET /api/settings': { body: { questionsPerRound: 20 } },
      'PUT /api/settings': (call) => ({ body: call.body }),
    });
    const { user } = page();
    const input = await field();
    for (const text of ['1', '200']) {
      await user.clear(input);
      await user.type(input, `${text}{Enter}`);
      await waitFor(() => expect(puts(calls).at(-1)!.body).toEqual({ questionsPerRound: Number(text) }));
    }
  });

  it.each(['0', '201', '1.5', '', '-3'])('does not send %j', async (text) => {
    const { calls } = fakeFetch({ 'GET /api/settings': { body: { questionsPerRound: 20 } } });
    const { user } = page();
    const input = await field();
    await user.clear(input);
    if (text) await user.type(input, text);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a whole number from 1 to 200.');
    expect(puts(calls)).toHaveLength(0);
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('takes the message of the server when it refuses the number', async () => {
    fakeFetch({
      'GET /api/settings': { body: { questionsPerRound: 20 } },
      'PUT /api/settings': errorReply(400, 'INVALID_SETTING', 'Questions per round must be between 1 and 200.'),
    });
    const ctx = context();
    const { user } = page(ctx);
    await user.click(await field());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Questions per round must be between 1 and 200.');
    expect(ctx.handleApiError).not.toHaveBeenCalled();
  });

  it('hands other failures to the common error handling', async () => {
    fakeFetch({
      'GET /api/settings': { body: { questionsPerRound: 20 } },
      'PUT /api/settings': errorReply(409, 'NO_SESSION'),
    });
    const ctx = context();
    const { user } = page(ctx);
    await field();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ctx.handleApiError).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('drops the "Saved" note and the error as soon as the number is changed', async () => {
    fakeFetch({
      'GET /api/settings': { body: { questionsPerRound: 20 } },
      'PUT /api/settings': (call) => ({ body: call.body }),
    });
    const { user } = page();
    const input = await field();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved');
    await user.type(input, '5');
    expect(screen.queryByText('Saved')).toBeNull();
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    await user.type(input, '9');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
