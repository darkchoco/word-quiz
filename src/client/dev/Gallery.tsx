import { Box, Typography } from '@mui/material';
import { AllDoneNotice } from '../components/AllDoneNotice';
import { Done3Dialog } from '../components/Done3Dialog';
import { EmptyPoolNotice } from '../components/EmptyPoolNotice';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { IdlePanel } from '../components/IdlePanel';
import { QuestionPanel } from '../components/QuestionPanel';
import { ResultPanel } from '../components/ResultPanel';
import { NoDbDialog } from '../components/NoDbDialog';
import { ServerUnreachable } from '../components/ServerUnreachable';
import { SettingsPanel } from '../components/SettingsPanel';
import { StartScreen } from '../components/StartScreen';
import { StatusBar } from '../components/StatusBar';
import { SwitchDbDialog } from '../components/SwitchDbDialog';
import { TabsBar } from '../components/TabsBar';
import { TopBar } from '../components/TopBar';
import { editOf, WordsPanel } from '../components/WordsPanel';
import { WrongPanel } from '../components/WrongPanel';
import type { WordRow } from '../../shared/api';

// Development only (main.tsx imports this only when import.meta.env.DEV): every presentational
// component in every state, so dialogs and error states can be looked at without a server.
// #/dev shows all states; #/dev/nodb, #/dev/switch and #/dev/done3 show one dialog open over the page; #/dev/m7 shows the states of the Wrong, Words and Settings tabs.

const noop = () => {};
const dbs = [
  { name: 'latin.db', language: 'latin' as const, wordCount: 178 },
  { name: 'latin_2.db', language: 'latin' as const, wordCount: 40 },
];
const stats = { totalWords: 178, tested: 15, correct: 11 };
const pool = { nextRoundNumber: 12, available: 143, retestRoundNumber: 13, wrongAvailable: 7, questionsPerRound: 20, allDone: false };
const result = (over: Partial<Parameters<typeof FeedbackPanel>[0]['result']>) => ({
  verdict: 'perfect' as const,
  groups: [{ synonyms: ['fassen', 'nehmen'], hit: true }],
  wordId: 1,
  askDone: false,
  canMarkDone: true,
  stats,
  round: { roundId: 1, number: 12, mode: 'normal' as const, direction: 'word_to_meaning' as const, total: 20, answered: 3, question: null },
  summary: null,
  ...over,
});
const question = (over: Partial<Parameters<typeof QuestionPanel>[0]>) => (
  <QuestionPanel headword="capere, capiō, cēpī, captum" position={3} total={20} progress={2} value="" locked={false} busy={false} onChange={noop} onSubmit={noop} {...over} />
);
const feedback = (r: ReturnType<typeof result>, done = false) => (
  <FeedbackPanel result={r} done={done} blocked={false} busy={false} onMarkDone={noop} onNext={noop} />
);

const sampleWords: WordRow[] = [
  { id: 1, headword: 'taurus', meanings: [['Stier']], done: false, wrongMark: false },
  { id: 2, headword: 'gravis, e', meanings: [['schwer'], ['ernst', 'wichtig']], done: false, wrongMark: true },
  { id: 3, headword: 'redīre, redeō, rediī, reditum', meanings: [['zurückgehen', 'zurückkehren']], done: true, wrongMark: false },
  { id: 4, headword: 'pulcherrimus, pulcherrima, pulcherrimum', meanings: [['sehr schön', 'wunderschön', 'allerschönster'], ['der (die, das) schönste']], done: false, wrongMark: true },
];
const wordsPanel = (over: Partial<Parameters<typeof WordsPanel>[0]>) => (
  <WordsPanel words={sampleWords} total={sampleWords.length} query="" edit={null} onQuery={noop} onToggleDone={noop} onEdit={noop} onChangeEdit={noop} onSave={noop} onCancel={noop} {...over} />
);

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

/** The states of the Wrong, Words and Settings tabs (also alone at #/dev/m7, for screenshots). */
const m7 = (
  <>
        <Section title="Wrong words"><WrongPanel words={sampleWords.filter((w) => w.wrongMark)} onRetest={noop} /></Section>
        <Section title="Wrong words, none"><WrongPanel words={[]} onRetest={noop} /></Section>
        <Section title="Words">{wordsPanel({})}</Section>
        <Section title="Words, searched">{wordsPanel({ words: sampleWords.slice(0, 1), query: 'TAUR' })}</Section>
        <Section title="Words, nothing found">{wordsPanel({ words: [], query: 'zzz' })}</Section>
        <Section title="Words, editing">{wordsPanel({ edit: editOf(sampleWords[1]!) })}</Section>
        <Section title="Words, editing with an error">
          {wordsPanel({ edit: { ...editOf(sampleWords[1]!), headword: 'taurus', error: 'Another word is already called "taurus".' } })}
        </Section>
        <Section title="Settings"><SettingsPanel value="20" error={null} saved={false} saving={false} onChange={noop} onSave={noop} /></Section>
        <Section title="Settings, saved"><SettingsPanel value="50" error={null} saved saving={false} onChange={noop} onSave={noop} /></Section>
        <Section title="Settings, invalid"><SettingsPanel value="201" error="Enter a whole number from 1 to 200." saved={false} saving={false} onChange={noop} onSave={noop} /></Section>
  </>
);

export function Gallery() {
  const route = window.location.hash.replace(/^#\/dev\/?/, '');
  if (route === 'nodb') return (<><Frame /><NoDbDialog open onClose={noop} /></>);
  if (route === 'done3') return (<><Frame /><Done3Dialog open headword="taurus" onAnswer={noop} /></>);
  if (route === 'switch') return (<><Frame /><SwitchDbDialog open onCancel={noop} onSwitch={noop} /></>);

  if (route === 'words-edit')
    return (
      <Box sx={{ p: 0, maxWidth: 900, mx: 'auto' }}>
        <Section title="Words, editing with an error">
          {wordsPanel({ edit: { ...editOf(sampleWords[1]!), headword: 'taurus', error: 'Another word is already called "taurus".' } })}
        </Section>
      </Box>
    );
  if (route === 'm7') return <Box sx={{ p: 2, maxWidth: 900, mx: 'auto' }}>{m7}</Box>;

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
      <Section title="Quiz: before a round"><IdlePanel pool={pool} retest={false} busy={false} onStart={noop} /></Section>
      <Section title="Quiz: before a retest"><IdlePanel pool={pool} retest busy={false} onStart={noop} /></Section>
      <Section title="Quiz: question"><>{question({})}</></Section>
      <Section title="Quiz: long headword, long answer">
        <>{question({ headword: 'pulcherrimus, pulcherrima, pulcherrimum, superlativus von pulcher', value: 'sehr schön, wunderschön, allerschönster, am schönsten' })}</>
      </Section>
      <Section title="Quiz: Perfect">
        <>{question({ value: 'fassen', locked: true, progress: 3 })}{feedback(result({}))}</>
      </Section>
      <Section title="Quiz: Partial">
        <>{question({ value: 'fassen', locked: true, progress: 3 })}{feedback(result({ verdict: 'partial', groups: [{ synonyms: ['fassen', 'nehmen'], hit: true }, { synonyms: ['erobern'], hit: false }] }))}</>
      </Section>
      <Section title="Quiz: Wrong (Mark done disabled)">
        <>{question({ value: 'sehen', locked: true, progress: 3 })}{feedback(result({ verdict: 'wrong', canMarkDone: false, groups: [{ synonyms: ['fassen', 'nehmen'], hit: false }, { synonyms: ['erobern'], hit: false }] }))}</>
      </Section>
      <Section title="Quiz: round result"><ResultPanel summary={{ total: 20, correct: 15, percent: 75 }} onAgain={noop} /></Section>
      <Section title="Quiz: nothing to retest"><EmptyPoolNotice retest onBack={noop} /></Section>
      <Section title="Quiz: no words available"><EmptyPoolNotice retest={false} onBack={noop} /></Section>
      <Section title="Quiz: all words done"><AllDoneNotice /></Section>
      {m7}
      <Section title="Frame"><Frame /></Section>
      <Section title="Frame, long database name">
        <TopBar language="latin" db="latin_vocabulary_for_the_second_semester_2026.db" onSwitchDb={noop} />
      </Section>
      <Section title="Server unreachable"><ServerUnreachable onRetry={noop} /></Section>
    </Box>
  );
}
