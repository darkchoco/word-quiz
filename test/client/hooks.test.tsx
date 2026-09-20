import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tabFromHash, useHashRoute } from '../../src/client/hooks/useHashRoute';
import { usePersistedChoice } from '../../src/client/hooks/usePersistedChoice';

beforeEach(() => {
  window.location.hash = '';
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('tabFromHash', () => {
  it.each([
    ['#/quiz', 'quiz'],
    ['#/wrong', 'wrong'],
    ['#/words', 'words'],
    ['#/settings', 'settings'],
    ['', 'quiz'],
    ['#/nothing', 'quiz'],
    ['#/WORDS', 'quiz'],
    ['#words', 'words'],
  ])('%s -> %s', (hash, tab) => expect(tabFromHash(hash)).toBe(tab));
});

describe('useHashRoute', () => {
  it('starts from the hash of the page', () => {
    window.location.hash = '#/words';
    expect(renderHook(() => useHashRoute()).result.current[0]).toBe('words');
  });

  it('changing the tab changes the hash and the state', async () => {
    const { result } = renderHook(() => useHashRoute());
    await act(async () => {
      result.current[1]('settings');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(window.location.hash).toBe('#/settings');
    expect(result.current[0]).toBe('settings');
  });

  it('follows the back button (hashchange)', async () => {
    const { result } = renderHook(() => useHashRoute());
    await act(async () => {
      window.location.hash = '#/wrong';
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current[0]).toBe('wrong');
  });
});

describe('usePersistedChoice', () => {
  it('restores what was saved', () => {
    window.localStorage.setItem('k', 'latin_2.db');
    expect(renderHook(() => usePersistedChoice('k')).result.current[0]).toBe('latin_2.db');
  });

  it('saves a new value', () => {
    const { result } = renderHook(() => usePersistedChoice('k'));
    act(() => result.current[1]('x.db'));
    expect(result.current[0]).toBe('x.db');
    expect(window.localStorage.getItem('k')).toBe('x.db');
  });

  it('still works when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const { result } = renderHook(() => usePersistedChoice('k'));
    expect(result.current[0]).toBeNull();
    act(() => result.current[1]('x.db'));
    expect(result.current[0]).toBe('x.db');
  });
});
