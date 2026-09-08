import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './password-input';

describe('PasswordInput', () => {
  function input() {
    return screen.getByPlaceholderText<HTMLInputElement>('Enter password');
  }

  it('hides the value by default and reveals it on toggle', async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Enter password" />);

    expect(input().type).toBe('password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input().type).toBe('text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input().type).toBe('password');
  });

  it('does not submit the surrounding form when toggled', () => {
    render(<PasswordInput placeholder="Enter password" />);
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'type',
      'button'
    );
  });

  it('keeps focus in the input when toggling with the mouse', async () => {
    const user = userEvent.setup();
    render(<PasswordInput placeholder="Enter password" />);

    await user.click(input());
    await user.click(screen.getByRole('button', { name: 'Show password' }));

    expect(input()).toHaveFocus();
  });

  it('disables the toggle alongside the input', () => {
    render(<PasswordInput placeholder="Enter password" disabled />);

    expect(input()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  });
});
