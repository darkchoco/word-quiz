import { useCallback, useEffect, useState } from 'react';
import type { DatabaseInfo, SessionState } from '../../shared/api';
import { api, ApiError } from '../api';
import { usePersistedChoice } from '../hooks/usePersistedChoice';
import { NoDbDialog } from './NoDbDialog';
import { StartScreen } from './StartScreen';

const LAST_DB_KEY = 'wordquiz.lastDb';

interface Props {
  onStarted: (session: SessionState) => void;
  /** An alert that came from somewhere else, for example a session whose DB vanished. */
  noDbNotice: boolean;
  onNoticeClose: () => void;
  onError: (error: unknown) => void;
}

/** Loads the databases, remembers the last choice and starts the session. */
export function StartPage({ onStarted, noDbNotice, onNoticeClose, onError }: Props) {
  const [databases, setDatabases] = useState<DatabaseInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastDb, rememberDb] = usePersistedChoice(LAST_DB_KEY);
  const [selected, setSelected] = useState('');
  const [starting, setStarting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await api.databases();
      setDatabases(list);
      // the remembered DB if it is still there, otherwise the first one
      setSelected((current) => [current, lastDb].find((n) => n && list.some((d) => d.name === n)) ?? list[0]?.name ?? '');
    } catch (error) {
      setDatabases([]);
      setLoadError(error instanceof ApiError && error.code === 'NETWORK_ERROR' ? 'Cannot reach the server.' : 'The database list could not be read.');
    }
    // lastDb is read once per load on purpose: choosing a DB must not reload the list
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    if (!selected || !databases?.some((d) => d.name === selected)) {
      setAlertOpen(true);
      return;
    }
    setStarting(true);
    try {
      const session = await api.startSession(selected);
      rememberDb(selected);
      onStarted(session);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DB_NOT_FOUND') setAlertOpen(true);
      else onError(error);
    } finally {
      setStarting(false);
    }
  };

  const closeAlert = () => {
    setAlertOpen(false);
    onNoticeClose();
    void load();
  };

  return (
    <>
      <StartScreen
        databases={databases}
        loadError={loadError}
        selected={selected}
        starting={starting}
        onSelect={setSelected}
        onStart={() => void start()}
        onRetry={() => void load()}
      />
      <NoDbDialog open={alertOpen || noDbNotice} onClose={closeAlert} />
    </>
  );
}
