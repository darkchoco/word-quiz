import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoDbDialog } from '../../src/client/components/NoDbDialog';
import { SwitchDbDialog } from '../../src/client/components/SwitchDbDialog';
import { renderWithTheme } from './render';

describe('NoDbDialog', () => {
  it('is an alertdialog with the mockup text and an OK button that has focus', async () => {
    const onClose = vi.fn();
    const { user } = renderWithTheme(<NoDbDialog open onClose={onClose} />);
    const dialog = screen.getByRole('alertdialog', { name: 'The selected DB does not exist.' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    renderWithTheme(<NoDbDialog open={false} onClose={() => {}} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('SwitchDbDialog', () => {
  it('shows the mockup title, text and buttons', () => {
    renderWithTheme(<SwitchDbDialog open onCancel={() => {}} onSwitch={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Switch DB?' })).toHaveAccessibleDescription(
      'The current session will end and a new session will start.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch' })).toBeInTheDocument();
  });

  it('calls the right callback for each button', async () => {
    const onCancel = vi.fn();
    const onSwitch = vi.fn();
    const { user } = renderWithTheme(<SwitchDbDialog open onCancel={onCancel} onSwitch={onSwitch} />);
    await user.click(screen.getByRole('button', { name: 'Switch' }));
    expect([onSwitch.mock.calls.length, onCancel.mock.calls.length]).toEqual([1, 0]);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect([onSwitch.mock.calls.length, onCancel.mock.calls.length]).toEqual([1, 1]);
  });

  it('Escape cancels', async () => {
    const onCancel = vi.fn();
    const { user } = renderWithTheme(<SwitchDbDialog open onCancel={onCancel} onSwitch={() => {}} />);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Switch while busy', () => {
    renderWithTheme(<SwitchDbDialog open busy onCancel={() => {}} onSwitch={() => {}} />);
    expect(screen.getByRole('button', { name: 'Switch' })).toBeDisabled();
  });
});
