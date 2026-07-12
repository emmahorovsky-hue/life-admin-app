import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import { resetPassword } from '@/lib/api';

vi.mock('@/lib/api', () => ({ resetPassword: vi.fn() }));

const mockedResetPassword = vi.mocked(resetPassword);

const PASSWORD_ERROR =
  'Password must be at least 8 characters and include an uppercase letter, number, and symbol';

function renderResetPassword() {
  return render(
    <MemoryRouter initialEntries={['/reset-password?token=reset-token']}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

async function submit(password: string, confirmPassword = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password'), password);
  await user.type(screen.getByLabelText('Confirm new password'), confirmPassword);
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
}

describe('ResetPassword password validation', () => {
  beforeEach(() => {
    mockedResetPassword.mockReset();
    mockedResetPassword.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof resetPassword>>);
  });

  // Each case violates exactly one clause of the shared isValidPassword rule.
  it.each([
    ['too short', 'Ab1!def'],
    ['no uppercase', 'abcdef1!'],
    ['no number', 'Abcdefg!'],
    ['no symbol', 'Abcdefg1'],
  ])('rejects a password with %s and does not call the API', async (_label, password) => {
    renderResetPassword();
    await submit(password);

    expect(await screen.findByText(PASSWORD_ERROR)).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords before checking strength', async () => {
    renderResetPassword();
    await submit('Str0ng!pass', 'Str0ng!pas');

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('submits when the password satisfies the shared rule', async () => {
    renderResetPassword();
    await submit('Str0ng!pass');

    expect(mockedResetPassword).toHaveBeenCalledWith('reset-token', 'Str0ng!pass');
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
  });
});
