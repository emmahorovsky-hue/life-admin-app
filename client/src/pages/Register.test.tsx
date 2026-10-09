import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const register = vi.fn();

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

    // The reason is on the field: it is marked invalid and the unmet rule turns red.
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(register).not.toHaveBeenCalled();
  });

  it('flags mismatched passwords on the confirm field', async () => {
    renderRegister();
    await submit('Str0ng!pass', 'Str0ng!pas');

    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('aria-invalid', 'true');
    expect(register).not.toHaveBeenCalled();
  });

  it('submits when the password satisfies the shared rule', async () => {
    renderRegister();
    await submit('Str0ng!pass');

    expect(register).toHaveBeenCalledWith('user@example.com', 'Str0ng!pass', undefined);
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid');
  });

  it('ticks the requirements as the password is typed', async () => {
    const user = userEvent.setup();
    renderRegister();
    const rule = (name: RegExp) => screen.getByText(name).closest('li')!;

    expect(rule(/One uppercase letter/)).toHaveTextContent('(not yet)');
    await user.type(screen.getByLabelText('Password'), 'A');
    expect(rule(/One uppercase letter/)).toHaveTextContent('(done)');
    expect(rule(/At least 8 characters/)).toHaveTextContent('(not yet)');
  });

  it('waits until the confirm field is left before calling a mismatch', async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.type(screen.getByLabelText('Password'), 'Str0ng!pass');
    await user.type(screen.getByLabelText('Confirm Password'), 'Str');
    expect(screen.queryByText("Passwords don't match")).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByText("Passwords don't match")).toBeInTheDocument();

    await user.type(screen.getByLabelText('Confirm Password'), '0ng!pass');
    expect(screen.queryByText("Passwords don't match")).not.toBeInTheDocument();
  });
});
