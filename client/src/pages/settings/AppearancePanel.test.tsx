import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@life-admin/shared';
import { toast } from 'sonner';
import AppearancePanel from './AppearancePanel';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { updateProfile } from '@/lib/api';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({ updateProfile: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseTheme = vi.mocked(useTheme);
const mockedUpdateProfile = vi.mocked(updateProfile);
const updateUser = vi.fn();
const setTheme = vi.fn();

function setup(user: Partial<User> = {}, theme: 'light' | 'dark' | 'system' = 'light') {
  mockedUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'me@example.com', defaultCurrency: 'SGD', theme, ...user } as User,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser,
  } as unknown as ReturnType<typeof useAuth>);
  mockedUseTheme.mockReturnValue({ theme, setTheme });
}

describe('AppearancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('marks the active theme segment and switches via setTheme', async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);

    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('hydrates the currency select and persists a change', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockResolvedValue({
      data: { user: { defaultCurrency: 'EUR' } },
    } as Awaited<ReturnType<typeof updateProfile>>);
    render(<AppearancePanel />);

    const select = screen.getByLabelText('Default currency');
    expect(select).toHaveValue('SGD');
    await user.selectOptions(select, 'EUR');

    await waitFor(() => expect(mockedUpdateProfile).toHaveBeenCalledWith({ defaultCurrency: 'EUR' }));
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ defaultCurrency: 'EUR' }));
    expect(toast.success).toHaveBeenCalled();
  });

  it('toasts on a currency save failure', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockRejectedValue(new Error('network'));
    render(<AppearancePanel />);

    await user.selectOptions(screen.getByLabelText('Default currency'), 'GBP');

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
