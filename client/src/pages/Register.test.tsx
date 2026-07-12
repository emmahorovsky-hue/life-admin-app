import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const register = vi.fn();

const PASSWORD_ERROR =
  'Password must be at least 8 characters and include an uppercase letter, number, and symbol';

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
}

async function submit(password: string, confirmPassword = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'user@example.com');
  await user.type(screen.getByLabelText('Password'), password);
  await user.type(screen.getByLabelText('Confirm Password'), confirmPassword);
  await user.click(screen.getByRole('button', { name: 'Create Account' }));
}

describe('Register password validation', () => {
  beforeEach(() => {
    register.mockReset();
    register.mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register,
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  // Each case violates exactly one clause of the shared isValidPassword rule.
  it.each([
    ['too short', 'Ab1!def'],
    ['no uppercase', 'abcdef1!'],
    ['no number', 'Abcdefg!'],
    ['no symbol', 'Abcdefg1'],
  ])('rejects a password with %s and does not call register', async (_label, password) => {
    renderRegister();
    await submit(password);

    expect(await screen.findByText(PASSWORD_ERROR)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords before checking strength', async () => {
    renderRegister();
    await submit('Str0ng!pass', 'Str0ng!pas');

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('submits when the password satisfies the shared rule', async () => {
    renderRegister();
    await submit('Str0ng!pass');

    expect(register).toHaveBeenCalledWith('user@example.com', 'Str0ng!pass', undefined);
    expect(screen.queryByText(PASSWORD_ERROR)).not.toBeInTheDocument();
  });
});
