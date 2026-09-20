import { useState } from 'react';
import { Box } from '@mui/material';
import { useApp } from '../app-context';
import { useHashRoute } from '../hooks/useHashRoute';
import { Placeholder } from './Placeholder';
import { QuizPage } from './QuizPage';
import { StatusBar } from './StatusBar';
import { SwitchDbDialog } from './SwitchDbDialog';
import { TabsBar } from './TabsBar';
import { TopBar } from './TopBar';

/** The frame around every screen once a session exists. */
export function Shell() {
  const { session, switchDb } = useApp();
  const [tab, setTab] = useHashRoute();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirmSwitch = async () => {
    setBusy(true);
    try {
      await switchDb();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <TopBar language={session.language} db={session.db} onSwitchDb={() => setConfirming(true)} />
      <TabsBar active={tab} onChange={setTab} />
      <Box component="main" sx={{ flex: 1, bgcolor: 'background.paper' }}>
        <Box sx={{ width: '100%', maxWidth: 960, mx: 'auto' }}>
          {tab === 'quiz' ? <QuizPage /> : <Placeholder tab={tab} />}
        </Box>
      </Box>
      <StatusBar stats={session.stats} />
      <SwitchDbDialog open={confirming} busy={busy} onCancel={() => setConfirming(false)} onSwitch={() => void confirmSwitch()} />
    </Box>
  );
}
