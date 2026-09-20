import { useCallback, useEffect, useState } from 'react';

export const TABS = ['quiz', 'wrong', 'words', 'settings'] as const;
export type Tab = (typeof TABS)[number];

export const TAB_LABELS: Record<Tab, string> = { quiz: 'Quiz', wrong: 'Wrong', words: 'Words', settings: 'Settings' };

/** `#/words` -> `words`. Anything unknown (or no hash at all) is the quiz tab. */
export function tabFromHash(hash: string): Tab {
  const name = hash.replace(/^#\/?/, '');
  return (TABS as readonly string[]).includes(name) ? (name as Tab) : 'quiz';
}

/** The active tab, kept in `location.hash` so that reload and the back button work. */
export function useHashRoute(): [Tab, (tab: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(() => tabFromHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setTabState(tabFromHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const setTab = useCallback((next: Tab) => {
    window.location.hash = `#/${next}`;
  }, []);
  return [tab, setTab];
}
