import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AllDoneNotice } from '../../src/client/components/AllDoneNotice';
import { Done3Dialog } from '../../src/client/components/Done3Dialog';
import { EmptyPoolNotice } from '../../src/client/components/EmptyPoolNotice';
import { FeedbackPanel } from '../../src/client/components/FeedbackPanel';
import { IdlePanel } from '../../src/client/components/IdlePanel';
import { QuestionPanel } from '../../src/client/components/QuestionPanel';
import { ResultPanel } from '../../src/client/components/ResultPanel';
import type { AnswerResult, PoolInfo } from '../../src/shared/api';
import { renderWithTheme } from './render';
import { answerResult, pool } from './quiz-data';

const noop = () => {};

/** The text of the paragraph that holds the numbers, whitespace normalised. */
const paragraph = (text: string) => screen.getByText((_, el) => el?.tagName === 'P' && el.textContent?.replace(/\s+/g, ' ') === text);

describe('IdlePanel', () => {
  const view = (p: Partial<PoolInfo> = {}, retest = false) =>
    renderWithTheme(<IdlePanel pool={pool(p)} retest={retest} busy={false} onStart={noop} />);

  it('enables Word → Meaning only and explains why', () => {
    view();
    expect(screen.getByRole('radio', { name: 'Word → Meaning' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Meaning → Word' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Mix' })).toBeDisabled();
    expect(screen.getByText('Latin supports Word → Meaning only.')).toBeInTheDocument();
  });

  it('shows the round number, the available words and the round size', () => {
    view({ nextRoundNumber: 12, available: 143, questionsPerRound: 20 });
    paragraph('Round 12 · 143 words available · 20 questions per round');
  });

  it('a retest shows the banner and the numbers of the retest', () => {
    view({ nextRoundNumber: 12, available: 143, retestRoundNumber: 13, wrongAvailable: 7 }, true);
    expect(screen.getByText('Retest wrong words')).toBeInTheDocument();
    paragraph('Round 13 · 7 words available · 20 questions per round');
  });

  it('a normal round has no banner', () => {
    view();
    expect(screen.queryByText('Retest wrong words')).toBeNull();
  });

  it('Start calls back and is disabled while busy', async () => {
    const onStart = vi.fn();
    const { user, rerender } = renderWithTheme(<IdlePanel pool={pool()} retest={false} busy={false} onStart={onStart} />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    rerender(<IdlePanel pool={pool()} retest={false} busy onStart={onStart} />);
  });
});

describe('QuestionPanel', () => {
  const props = { headword: 'capere, capiō, cēpī, captum', position: 3, total: 20, progress: 2, value: '', locked: false, busy: false, onChange: noop, onSubmit: noop };

  it('shows progress, the headword as Latin text, and the answer box', () => {
    renderWithTheme(<QuestionPanel {...props} />);
    expect(screen.getByText('3 / 20')).toBeInTheDocument();
    expect(screen.getByText('Word → Meaning')).toBeInTheDocument();
    expect(screen.getByText('capere, capiō, cēpī, captum')).toHaveAttribute('lang', 'la');
    expect(screen.getByRole('progressbar', { name: 'Round progress' })).toHaveAttribute('aria-valuenow', '10');
    expect(screen.getByPlaceholderText('Enter the meaning (separate with commas)')).toBeInTheDocument();
  });

  it('keeps EB Garamond from drawing u as v for lang="la" (it shows "captum" as "captvm")', () => {
    renderWithTheme(<QuestionPanel {...props} />);
    const style = getComputedStyle(screen.getByText('capere, capiō, cēpī, captum'));
    expect(style.getPropertyValue('font-feature-settings')).toBe('"locl" 0');
  });

  it('turns off the automatic capitals, corrections and spell check of phone keyboards', () => {
    renderWithTheme(<QuestionPanel {...props} />);
    const input = screen.getByRole('textbox', { name: 'Meaning' });
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('enterkeyhint', 'send');
  });

  it('has the cursor in the answer box', () => {
    renderWithTheme(<QuestionPanel {...props} />);
    expect(screen.getByRole('textbox', { name: 'Meaning' })).toHaveFocus();
  });

  it('cannot submit an empty or blank answer', async () => {
    const onSubmit = vi.fn();
    const { user, rerender } = renderWithTheme(<QuestionPanel {...props} onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    rerender(<QuestionPanel {...props} value="   " onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    await user.click(screen.getByRole('textbox', { name: 'Meaning' }));
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits with Enter and with the button', async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithTheme(<QuestionPanel {...props} value="nehmen" onSubmit={onSubmit} />);
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('is locked after the submission: the answer stays but cannot be changed or sent again', () => {
    renderWithTheme(<QuestionPanel {...props} value="nehmen" locked />);
    expect(screen.getByRole('textbox', { name: 'Meaning' })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Meaning' })).toHaveValue('nehmen');
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});

describe('FeedbackPanel', () => {
  const view = (result: AnswerResult, extra: { done?: boolean; blocked?: boolean } = {}) =>
    renderWithTheme(<FeedbackPanel result={result} done={extra.done ?? false} blocked={extra.blocked ?? false} busy={false} onMarkDone={noop} onNext={noop} />);

  it('Perfect', () => {
    view(answerResult({ verdict: 'perfect', groups: [{ synonyms: ['fassen', 'nehmen'], hit: true }] }));
    expect(screen.getByText('Perfect')).toBeInTheDocument();
    expect(screen.getByText('fassen, nehmen')).toBeInTheDocument();
    expect(screen.queryByText(/Each colored block/)).toBeNull();
  });

  it('Partial shows how many meaning groups were hit', () => {
    view(answerResult({ verdict: 'partial', groups: [{ synonyms: ['fassen'], hit: true }, { synonyms: ['erobern'], hit: false }] }));
    expect(screen.getByText('Partial (1/2)')).toBeInTheDocument();
    expect(screen.getByText(/Each colored block is one meaning group/)).toBeInTheDocument();
  });

  it('marks every group with a symbol and not only with a colour', () => {
    view(answerResult({ verdict: 'partial', groups: [{ synonyms: ['fassen'], hit: true }, { synonyms: ['erobern'], hit: false }] }));
    const hit = screen.getByText('fassen').closest('[data-hit]')!;
    const miss = screen.getByText('erobern').closest('[data-hit]')!;
    expect(hit).toHaveAttribute('data-hit', 'true');
    expect(within(hit as HTMLElement).getByText('✓')).toBeInTheDocument();
    expect(miss).toHaveAttribute('data-hit', 'false');
    expect(within(miss as HTMLElement).getByText('✗')).toBeInTheDocument();
  });

  it('Wrong cannot be marked done', () => {
    view(answerResult({ verdict: 'wrong', canMarkDone: false, groups: [{ synonyms: ['x'], hit: false }] }));
    expect(screen.getByText('Wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeDisabled();
  });

  it.each(['perfect', 'partial'] as const)('%s can be marked done', (verdict) => {
    view(answerResult({ verdict, canMarkDone: true }));
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeEnabled();
  });

  it('after Mark done the button says Done and is disabled', () => {
    view(answerResult(), { done: true });
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });

  it('puts the focus on Next, but not while a dialog is open', () => {
    const { rerender } = view(answerResult(), { blocked: true });
    expect(screen.getByRole('button', { name: /^Next/ })).not.toHaveFocus();
    rerender(<FeedbackPanel result={answerResult()} done={false} blocked={false} busy={false} onMarkDone={noop} onNext={noop} />);
    expect(screen.getByRole('button', { name: /^Next/ })).toHaveFocus();
  });
});

describe('Done3Dialog', () => {
  it('asks about the word and answers No / Yes', async () => {
    const onAnswer = vi.fn();
    const { user } = renderWithTheme(<Done3Dialog open headword="taurus" onAnswer={onAnswer} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('taurus answered correctly 3 times in a row');
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Mark this word as done?');
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'No' }));
    expect(onAnswer.mock.calls).toEqual([[true], [false]]);
  });

  it('Escape counts as No', async () => {
    const onAnswer = vi.fn();
    const { user } = renderWithTheme(<Done3Dialog open headword="taurus" onAnswer={onAnswer} />);
    await user.keyboard('{Escape}');
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});

describe('ResultPanel and notices', () => {
  it('shows the result and Play again', async () => {
    const onAgain = vi.fn();
    const { user } = renderWithTheme(<ResultPanel summary={{ total: 20, correct: 15, percent: 75 }} onAgain={onAgain} />);
    expect(screen.getByText('Round complete')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('15 of 20 correct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play again' }));
    expect(onAgain).toHaveBeenCalled();
  });

  it('the empty retest offers the way back; the normal one does not', async () => {
    const onBack = vi.fn();
    const { user, rerender } = renderWithTheme(<EmptyPoolNotice retest onBack={onBack} />);
    expect(screen.getByText('There are no wrong words to retest.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to the quiz' }));
    expect(onBack).toHaveBeenCalled();
    rerender(<EmptyPoolNotice retest={false} onBack={onBack} />);
    expect(screen.getByText('No words are available for this round.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Back/ })).toBeNull();
  });

  it('all done', () => {
    renderWithTheme(<AllDoneNotice />);
    expect(screen.getByText('All words are marked done. Nothing is left to practice.')).toBeInTheDocument();
  });
});
