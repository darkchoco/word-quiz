import { Box, Typography } from '@mui/material';
import { NoDbDialog } from '../components/NoDbDialog';
import { ServerUnreachable } from '../components/ServerUnreachable';
import { StartScreen } from '../components/StartScreen';
import { StatusBar } from '../components/StatusBar';
import { SwitchDbDialog } from '../components/SwitchDbDialog';
import { TabsBar } from '../components/TabsBar';
import { TopBar } from '../components/TopBar';

// Development only (main.tsx imports this only when import.meta.env.DEV): every presentational
// component in every state, so dialogs and error states can be looked at without a server.
// #/dev shows all states; #/dev/nodb and #/dev/switch show one dialog open over the page.

const noop = () => {};
const dbs = [
  { name: 'latin.db', language: 'latin' as const, wordCount: 178 },
  { name: 'latin_2.db', language: 'latin' as const, wordCount: 40 },
];
const stats = { totalWords: 178, tested: 15, correct: 11 };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 4 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Typography>
      <Box sx={{ '--wq-min-h': '0px', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: 'background.default' }}>{children}</Box>
    </Box>
  );
}

function Frame() {
  return (
    <>
      <TopBar language="latin" db="latin.db" onSwitchDb={noop} />
      <TabsBar active="quiz" onChange={noop} />
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>Page content</Box>
      <StatusBar stats={stats} />
    </>
  );
}

export function Gallery() {
  const route = window.location.hash.replace(/^#\/dev\/?/, '');
  if (route === 'nodb') return (<><Frame /><NoDbDialog open onClose={noop} /></>);
  if (route === 'switch') return (<><Frame /><SwitchDbDialog open onCancel={noop} onSwitch={noop} /></>);

  const start = (over: Partial<Parameters<typeof StartScreen>[0]>) => (
    <StartScreen databases={dbs} loadError={null} selected="latin.db" starting={false} onSelect={noop} onStart={noop} onRetry={noop} {...over} />
  );
  return (
    <Box sx={{ p: 2, maxWidth: 900, mx: 'auto' }}>
      <Section title="Start screen">{start({})}</Section>
      <Section title="Start screen, loading">{start({ databases: null, selected: '' })}</Section>
      <Section title="Start screen, no databases">{start({ databases: [], selected: '' })}</Section>
      <Section title="Start screen, list could not be read">{start({ databases: [], selected: '', loadError: 'The database list could not be read.' })}</Section>
      <Section title="Start screen, long database name">
        {start({ databases: [{ name: 'latin_vocabulary_for_the_second_semester_2026.db', language: 'latin', wordCount: 5 }], selected: 'latin_vocabulary_for_the_second_semester_2026.db' })}
      </Section>
      <Section title="Frame"><Frame /></Section>
      <Section title="Frame, long database name">
        <TopBar language="latin" db="latin_vocabulary_for_the_second_semester_2026.db" onSwitchDb={noop} />
      </Section>
      <Section title="Server unreachable"><ServerUnreachable onRetry={noop} /></Section>
    </Box>
  );
}
