import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@life-admin/shared';
import { toast } from 'sonner';
import NotificationsPanel from './NotificationsPanel';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/lib/api';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({ updateProfile: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUpdateProfile = vi.mocked(updateProfile);

const testUser = {
  id: 'u1',
  email: 'me@example.com',
  reminderEmailsEnabled: true,
} as User;

const updateUser = vi.fn();

function setAuth(user: Partial<User> = {}) {
  mockedUseAuth.mockReturnValue({
    user: { ...testUser, ...user },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser,
  } as unknown as ReturnType<typeof useAuth>);
}

describe('NotificationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth();
  });

  it('hydrates the switch from the user', () => {
    setAuth({ reminderEmailsEnabled: false });
    render(<NotificationsPanel />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('saves the toggle and updates the user on success', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockResolvedValue({
      data: { user: { ...testUser, reminderEmailsEnabled: false } },
    } as Awaited<ReturnType<typeof updateProfile>>);
    render(<NotificationsPanel />);

    await user.click(screen.getByRole('switch'));

    await waitFor(() =>
      expect(mockedUpdateProfile).toHaveBeenCalledWith({ reminderEmailsEnabled: false })
    );
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ reminderEmailsEnabled: false })
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('keeps the switch on and toasts when the save fails', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockRejectedValue(new Error('network'));
    render(<NotificationsPanel />);

    await user.click(screen.getByRole('switch'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockResolvedValue({
      data: { user: { ...testUser, reminderEmailsEnabled: false } },
    } as Awaited<ReturnType<typeof updateProfile>>);
    render(<NotificationsPanel />);

    screen.getByRole('switch').focus();
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(mockedUpdateProfile).toHaveBeenCalledWith({ reminderEmailsEnabled: false })
    );
  });
});
