import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import { resetPassword } from '@/lib/api';

vi.mock('@/lib/api', () => ({ resetPassword: vi.fn() }));

const mockedResetPassword = vi.mocked(resetPassword);

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
    ['no lowercase', 'ABCDEF1!'],
    ['no number', 'Abcdefg!'],
    ['no symbol', 'Abcdefg1'],
  ])('rejects a password with %s and does not call the API', async (_label, password) => {
    renderResetPassword();
    await submit(password);

    // The reason is on the field: it is marked invalid and the unmet rule turns red.
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('flags mismatched passwords on the confirm field', async () => {
    renderResetPassword();
    await submit('Str0ng!pass', 'Str0ng!pas');

    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('aria-invalid', 'true');
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('submits when the password satisfies the shared rule', async () => {
    renderResetPassword();
    await submit('Str0ng!pass');

    expect(mockedResetPassword).toHaveBeenCalledWith('reset-token', 'Str0ng!pass');
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
  });

  it('ticks the requirements as the password is typed', async () => {
    const user = userEvent.setup();
    renderResetPassword();
    const rule = (name: RegExp) => screen.getByText(name).closest('li')!;

    expect(rule(/One uppercase letter/)).toHaveTextContent('(not yet)');
    await user.type(screen.getByLabelText('New password'), 'A');
    expect(rule(/One uppercase letter/)).toHaveTextContent('(done)');
    expect(rule(/At least 8 characters/)).toHaveTextContent('(not yet)');
  });

  it('waits until the confirm field is left before calling a mismatch', async () => {
    const user = userEvent.setup();
    renderResetPassword();
    await user.type(screen.getByLabelText('New password'), 'Str0ng!pass');
    await user.type(screen.getByLabelText('Confirm new password'), 'Str');
    expect(screen.queryByText("Passwords don't match")).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();

    await user.type(screen.getByLabelText('Confirm new password'), '0ng!pass');
    expect(screen.queryByText("Passwords don't match")).not.toBeInTheDocument();
  });
});
