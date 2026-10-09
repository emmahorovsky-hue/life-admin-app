import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '@life-admin/shared';
import { toast } from 'sonner';
import AccountPanel from './AccountPanel';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/lib/api';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({ updateProfile: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUpdateProfile = vi.mocked(updateProfile);
const updateUser = vi.fn();

function renderPanel(user: Partial<User> = {}) {
  mockedUseAuth.mockReturnValue({
    user: {
      id: 'u1',
      email: 'me@example.com',
      name: null,
      surname: null,
      emailVerified: true,
      defaultCurrency: 'SGD',
      ...user,
    } as User,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser,
  } as unknown as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter>
      <AccountPanel />
    </MemoryRouter>,
  );
}

describe('AccountPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the email once and an empty state when no name is set', () => {
    renderPanel();

    // Profile card + Email row only — the Name row no longer falls back to it.
    expect(screen.getAllByText('me@example.com')).toHaveLength(2);
    expect(screen.getByText('Add your name')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Add your name' })).getByText('Add')).toBeInTheDocument();
  });

  it('shows the name with the email beneath it once one is set', () => {
    renderPanel({ name: 'Ada', surname: 'Lovelace' });

    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(2);
    expect(screen.queryByText('Add your name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit name' })).toBeInTheDocument();
  });

  it('labels every row action "Edit"', () => {
    renderPanel({ name: 'Ada' });

    for (const name of ['Edit name', 'Edit email address', 'Edit password']) {
      expect(within(screen.getByRole('button', { name })).getByText('Edit')).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /Change/ })).not.toBeInTheDocument();
  });

  it('hydrates the currency select and persists a change', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockResolvedValue({
      data: { user: { defaultCurrency: 'EUR' } },
    } as Awaited<ReturnType<typeof updateProfile>>);
    renderPanel();

    const select = screen.getByLabelText(/Default currency/);
    expect(select).toHaveValue('SGD');
    await user.selectOptions(select, 'EUR');

    await waitFor(() => expect(mockedUpdateProfile).toHaveBeenCalledWith({ defaultCurrency: 'EUR' }));
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ defaultCurrency: 'EUR' }));
    expect(toast.success).toHaveBeenCalled();
  });

  it('toasts on a currency save failure', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockRejectedValue(new Error('network'));
    renderPanel();

    await user.selectOptions(screen.getByLabelText(/Default currency/), 'GBP');

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
