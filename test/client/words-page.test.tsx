import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppContext, type AppContextValue } from '../../src/client/app-context';
import { WordsPage } from '../../src/client/components/WordsPage';
import { errorReply, fakeFetch } from './fake-fetch';
import { renderWithTheme, session } from './render';
import { canis, gravis, taurus, word } from './words-data';

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

const waschen = word({ id: 4, headword: 'lūdus', meanings: [['Spiel'], ['Schule']] });
const uber = word({ id: 5, headword: 'über', meanings: [['Übung']] });
const all = [taurus, gravis, canis, waschen, uber];

const page = (ctx = context()) =>
  renderWithTheme(
    <AppContext.Provider value={ctx}>
      <WordsPage />
    </AppContext.Provider>,
  );

const rowOf = (headword: string) => screen.getByText(headword, { selector: 'td.word' }).closest('tr')!;
const headwords = () => within(screen.getByRole('table', { name: 'Words' })).getAllByRole('row').slice(1).map((r) => r.querySelector('td')!.textContent);

describe('the list', () => {
  it('shows every word with its meaning groups, done state and the wrong badge', async () => {
    fakeFetch({ 'GET /api/words': { body: { words: all } } });
    page();
    expect(await screen.findByRole('heading', { name: /Words\s*\(5\)/ })).toBeTruthy();
    expect(headwords()).toEqual(['taurus', 'gravis, ewrong', 'canis', 'lūdus', 'über']);
    expect(rowOf('gravis, e').textContent).toContain('schwer / ernst, wichtig');
    expect((screen.getByRole('checkbox', { name: 'Done: canis' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Done: taurus' }) as HTMLInputElement).checked).toBe(false);
  });

  it('does not show the wrong badge of a word that is done', async () => {
    fakeFetch({ 'GET /api/words': { body: { words: [{ ...gravis, done: true }] } } });
    page();
    await screen.findByText('gravis, e');
    expect(screen.queryByText('wrong')).toBeNull();
  });

  it('does not show notes', async () => {
    fakeFetch({ 'GET /api/words': { body: { words: [{ ...taurus, note: 'a secret note' }] } } });
    page();
    await screen.findByText('taurus');
    expect(screen.queryByText('a secret note')).toBeNull();
  });
});

describe('search', () => {
  it('ignores case and umlauts, and looks at the meanings too', async () => {
    fakeFetch({ 'GET /api/words': { body: { words: all } } });
    const { user } = page();
    const box = await screen.findByRole('textbox', { name: 'Search words' });

    await user.type(box, 'TAUR');
    expect(headwords()).toEqual(['taurus']);
    expect(screen.getByRole('heading', { name: /Words\s*\(1 of 5\)/ })).toBeTruthy();

    await user.clear(box);
    await user.type(box, 'ueber');
    expect(headwords()).toEqual(['über']);

    await user.clear(box);
    await user.type(box, 'uebung');
    expect(headwords()).toEqual(['über']);

    await user.clear(box);
    await user.type(box, 'schule');
    expect(headwords()).toEqual(['lūdus']);
  });

  it('says so when nothing matches, and shows everything again when cleared', async () => {
    fakeFetch({ 'GET /api/words': { body: { words: all } } });
    const { user } = page();
    const box = await screen.findByRole('textbox', { name: 'Search words' });
    await user.type(box, 'zzz');
    expect(screen.getByText('No words match.')).toBeTruthy();
    await user.clear(box);
    expect(headwords()).toHaveLength(5);
  });
});

describe('done check boxes', () => {
  it('marks a word done and shows the answer of the server (the wrong mark is gone)', async () => {
    const { calls } = fakeFetch({
      'GET /api/words': { body: { words: [gravis] } },
      'POST /api/words/2/done': { body: { ...gravis, done: true, wrongMark: false } },
    });
    const { user } = page();
    await user.click(await screen.findByRole('checkbox', { name: 'Done: gravis, e' }));
    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Done: gravis, e' }) as HTMLInputElement).checked).toBe(true));
    expect(calls.find((c) => c.path === '/api/words/2/done')!.body).toEqual({ done: true });
    expect(screen.queryByText('wrong')).toBeNull();
  });

  it('returns a word to the pool', async () => {
    const { calls } = fakeFetch({
      'GET /api/words': { body: { words: [canis] } },
      'POST /api/words/3/done': { body: { ...canis, done: false } },
    });
    const { user } = page();
    await user.click(await screen.findByRole('checkbox', { name: 'Done: canis' }));
    await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Done: canis' }) as HTMLInputElement).checked).toBe(false));
    expect(calls.find((c) => c.path === '/api/words/3/done')!.body).toEqual({ done: false });
  });

  it('hands a failure to the common error handling and keeps the old state', async () => {
    fakeFetch({
      'GET /api/words': { body: { words: [taurus] } },
      'POST /api/words/1/done': errorReply(500, 'INTERNAL'),
    });
    const ctx = context();
    const { user } = page(ctx);
    await user.click(await screen.findByRole('checkbox', { name: 'Done: taurus' }));
    await waitFor(() => expect(ctx.handleApiError).toHaveBeenCalledTimes(1));
    expect((screen.getByRole('checkbox', { name: 'Done: taurus' }) as HTMLInputElement).checked).toBe(false);
  });
});

describe('editing', () => {
  const open = async (words = [gravis, taurus]) => {
    const fake = fakeFetch({
      'GET /api/words': { body: { words } },
      'PATCH /api/words/2': (call) => ({ body: { ...gravis, ...(call.body as object) } }),
    });
    const view = page();
    await view.user.click(await screen.findByRole('button', { name: `Edit ${words[0]!.headword}` }));
    return { ...fake, ...view };
  };

  it('fills the editor with the text form of the meanings and disables the check box of the row', async () => {
    await open();
    expect((screen.getByRole('textbox', { name: 'Word' }) as HTMLInputElement).value).toBe('gravis, e');
    expect((screen.getByRole('textbox', { name: 'Meaning' }) as HTMLInputElement).value).toBe('schwer | ernst, wichtig');
    expect((screen.getByRole('checkbox', { name: 'Done: gravis, e' }) as HTMLInputElement).disabled).toBe(true);
  });

  it('saves the word and the meaning groups, then shows the saved row', async () => {
    const { calls, user } = await open();
    const meaning = screen.getByRole('textbox', { name: 'Meaning' });
    await user.clear(meaning);
    await user.type(meaning, 'schwer, gewichtig | ernst');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Meaning' })).toBeNull());
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ headword: 'gravis, e', meanings: [['schwer', 'gewichtig'], ['ernst']] });
    expect(rowOf('gravis, e').textContent).toContain('schwer, gewichtig / ernst');
  });

  it('saves with Enter and cancels with Escape', async () => {
    const { calls, user } = await open();
    await user.click(screen.getByRole('textbox', { name: 'Meaning' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Meaning' })).toBeNull();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Edit gravis, e' }));
    await user.click(screen.getByRole('textbox', { name: 'Meaning' }));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
  });

  it('Cancel puts the old text back', async () => {
    const { user } = await open();
    const meaning = screen.getByRole('textbox', { name: 'Meaning' });
    await user.clear(meaning);
    await user.type(meaning, 'nonsense');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(rowOf('gravis, e').textContent).toContain('schwer / ernst, wichtig');
    await user.click(screen.getByRole('button', { name: 'Edit gravis, e' }));
    expect((screen.getByRole('textbox', { name: 'Meaning' }) as HTMLInputElement).value).toBe('schwer | ernst, wichtig');
  });

  it.each([
    ['', 'Enter at least one meaning.'],
    ['schwer | | ernst', 'A meaning group is empty'],
    ['a | b | c | d | e', 'at most 4 meaning groups'],
  ])('does not send meanings that cannot be stored: %j', async (text, message) => {
    const { calls, user } = await open();
    const meaning = screen.getByRole('textbox', { name: 'Meaning' });
    await user.clear(meaning);
    if (text) await user.type(meaning, text);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('does not send an empty word', async () => {
    const { calls, user } = await open();
    await user.clear(screen.getByRole('textbox', { name: 'Word' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The word cannot be empty.');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('shows the error of a duplicate word inside the row and keeps what was typed', async () => {
    fakeFetch({
      'GET /api/words': { body: { words: [gravis, taurus] } },
      'PATCH /api/words/2': errorReply(409, 'HEADWORD_EXISTS', 'Another word is already called "taurus".'),
    });
    const ctx = context();
    const { user } = page(ctx);
    await user.click(await screen.findByRole('button', { name: 'Edit gravis, e' }));
    const headword = screen.getByRole('textbox', { name: 'Word' });
    await user.clear(headword);
    await user.type(headword, 'taurus');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Another word is already called "taurus".');
    expect((screen.getByRole('textbox', { name: 'Word' }) as HTMLInputElement).value).toBe('taurus');
    expect(ctx.handleApiError).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('hands other failures to the common error handling and stays in the editor', async () => {
    fakeFetch({
      'GET /api/words': { body: { words: [gravis] } },
      'PATCH /api/words/2': errorReply(409, 'NO_SESSION'),
    });
    const ctx = context();
    const { user } = page(ctx);
    await user.click(await screen.findByRole('button', { name: 'Edit gravis, e' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ctx.handleApiError).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('textbox', { name: 'Meaning' })).toBeTruthy();
  });

  it('clears the error as soon as the text is changed', async () => {
    const { user } = await open();
    const meaning = screen.getByRole('textbox', { name: 'Meaning' });
    await user.clear(meaning);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    await user.type(meaning, 'x');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
