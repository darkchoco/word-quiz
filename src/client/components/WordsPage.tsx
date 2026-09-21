import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WordRow } from '../../shared/api';
import { normalize } from '../../shared/grading';
import { formatMeanings, MAX_GROUPS, parseMeanings, validateMeanings, type MeaningsError } from '../../shared/meanings';
import { api, ApiError } from '../api';
import { useApp } from '../app-context';
import { editOf, WordsPanel, type WordEdit } from './WordsPanel';

const MEANINGS_MESSAGES: Record<MeaningsError, string> = {
  EMPTY: 'Enter at least one meaning.',
  EMPTY_GROUP: 'A meaning group is empty. Remove the extra "|" or add a meaning.',
  TOO_MANY_GROUPS: `Use at most ${MAX_GROUPS} meaning groups.`,
  INVALID_SYNONYM: 'A meaning is empty or contains characters that cannot be stored.',
  NOT_ROUNDTRIP_SAFE: 'These meanings cannot be stored as typed. Check the commas and brackets.',
};

/** Errors of a save that belong to the row being edited; anything else is handled like on every screen. */
const ROW_ERRORS = ['HEADWORD_EXISTS', 'INVALID_MEANINGS', 'WORD_NOT_FOUND', 'INVALID_REQUEST'];

/** The Words tab: loads the words, searches them client side and saves changes one word at a time. */
export function WordsPage() {
  const { handleApiError } = useApp();
  const [words, setWords] = useState<WordRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState<WordEdit | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .words()
      .then((list) => alive && setWords(list))
      .catch((error: unknown) => alive && handleApiError(error));
    return () => {
      alive = false;
    };
  }, [handleApiError]);

  const shown = useMemo(() => {
    if (!words) return [];
    const q = normalize(query).trim();
    if (q === '') return words;
    return words.filter((w) => normalize(w.headword).includes(q) || normalize(formatMeanings(w.meanings)).includes(q));
  }, [words, query]);

  const replace = useCallback((row: WordRow) => setWords((list) => list && list.map((w) => (w.id === row.id ? row : w))), []);

  const toggleDone = async (word: WordRow, done: boolean) => {
    try {
      replace(await api.setDone(word.id, done));
    } catch (error) {
      handleApiError(error);
    }
  };

  const save = async () => {
    if (!edit || edit.saving) return;
    const headword = edit.headword.trim();
    if (headword === '') return setEdit({ ...edit, error: 'The word cannot be empty.' });
    const meanings = parseMeanings(edit.meanings);
    const problem = validateMeanings(meanings);
    if (problem) return setEdit({ ...edit, error: MEANINGS_MESSAGES[problem] });

    setEdit({ ...edit, error: null, saving: true });
    try {
      replace(await api.patchWord(edit.id, { headword, meanings }));
      setEdit(null);
    } catch (error) {
      if (error instanceof ApiError && ROW_ERRORS.includes(error.code)) {
        setEdit((current) => current && { ...current, error: error.message || 'The word could not be saved.', saving: false });
      } else {
        setEdit((current) => current && { ...current, saving: false });
        handleApiError(error);
      }
    }
  };

  if (words === null) return null;
  return (
    <WordsPanel
      words={shown}
      total={words.length}
      query={query}
      edit={edit}
      onQuery={setQuery}
      onToggleDone={(word, done) => void toggleDone(word, done)}
      onEdit={(word) => setEdit(editOf(word))}
      onChangeEdit={(change) => setEdit((current) => current && { ...current, ...change, error: null })}
      onSave={() => void save()}
      onCancel={() => setEdit(null)}
    />
  );
}
