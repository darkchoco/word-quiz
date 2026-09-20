import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import type { SessionState, Stats } from '../shared/api';
import { api, ApiError } from './api';
import { AppContext, classifyApiError } from './app-context';
import { ServerUnreachable } from './components/ServerUnreachable';
import { Shell } from './components/Shell';
import { StartPage } from './components/StartPage';

type Boot = { kind: 'loading' } | { kind: 'unreachable' } | { kind: 'start' } | { kind: 'session'; session: SessionState };

export function App() {
  const [boot, setBoot] = useState<Boot>({ kind: 'loading' });
  const [noDbNotice, setNoDbNotice] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [retestRequested, setRetestRequested] = useState(false);

  const load = useCallback(async () => {
    setBoot({ kind: 'loading' });
    try {
      setBoot({ kind: 'session', session: await api.getSession() });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NO_SESSION') setBoot({ kind: 'start' });
      else setBoot({ kind: 'unreachable' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApiError = useCallback((error: unknown) => {
    const action = classifyApiError(error);
    if (action.kind === 'start') {
      if (action.noDbNotice) setNoDbNotice(true);
      setBoot({ kind: 'start' });
    } else {
      setMessage(action.text);
    }
  }, []);

  const switchDb = useCallback(async () => {
    try {
      await api.endSession();
    } catch (error) {
      // no session left is the state we wanted anyway
      if (!(error instanceof ApiError && error.code === 'NO_SESSION')) {
        handleApiError(error);
        return;
      }
    }
    setBoot({ kind: 'start' });
  }, [handleApiError]);

  const updateStats = useCallback(
    (stats: Stats) => setBoot((b) => (b.kind === 'session' ? { kind: 'session', session: { ...b.session, stats } } : b)),
    [],
  );
  const requestRetest = useCallback(() => setRetestRequested(true), []);
  const clearRetest = useCallback(() => setRetestRequested(false), []);

  const setSession = useCallback((session: SessionState) => setBoot({ kind: 'session', session }), []);

  const context = useMemo(
    () => (boot.kind === 'session' ? { session: boot.session, setSession, handleApiError, switchDb, updateStats, retestRequested, requestRetest, clearRetest } : null),
    [boot, setSession, handleApiError, switchDb, updateStats, retestRequested, requestRetest, clearRetest],
  );

  let body;
  if (boot.kind === 'loading') body = null;
  else if (boot.kind === 'unreachable') body = <ServerUnreachable onRetry={() => void load()} />;
  else if (boot.kind === 'start')
    body = <StartPage onStarted={setSession} noDbNotice={noDbNotice} onNoticeClose={() => setNoDbNotice(false)} onError={handleApiError} />;
  else body = context && <AppContext.Provider value={context}><Shell /></AppContext.Provider>;

  return (
    <>
      {body}
      <Snackbar open={message !== null} autoHideDuration={6000} onClose={() => setMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setMessage(null)} variant="filled">
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}
