import { useEffect, useState } from 'react';
import type { WordRow } from '../../shared/api';
import { api } from '../api';
import { useApp } from '../app-context';
import { WrongPanel } from './WrongPanel';

/** The Wrong tab: loads the wrong words. "Retest wrong only" is handled by the caller (it needs to change the tab). */
export function WrongPage({ onRetest }: { onRetest: () => void }) {
  const { handleApiError } = useApp();
  const [words, setWords] = useState<WordRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .wrong()
      .then((list) => alive && setWords(list))
      .catch((error: unknown) => alive && handleApiError(error));
    return () => {
      alive = false;
    };
  }, [handleApiError]);

  return words === null ? null : <WrongPanel words={words} onRetest={onRetest} />;
}
