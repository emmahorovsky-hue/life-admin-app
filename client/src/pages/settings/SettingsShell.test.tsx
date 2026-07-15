import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { User } from '@life-admin/shared';
import { toast } from 'sonner';
import SettingsShell from './SettingsShell';
import SettingsIndexOrRedirect from './SettingsIndexOrRedirect';
import AccountPanel from './AccountPanel';
import NotificationsPanel from './NotificationsPanel';
import { ProfileRedirect } from '@/App';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/lib/api';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', () => ({
  updateProfile: vi.fn(),
  initiateEmailChange: vi.fn(),
  changePassword: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUpdateProfile = vi.mocked(updateProfile);

const testUser: User = {
  id: 'u1',
  email: 'marlowe@example.com',
  name: 'Marlowe',
  surname: 'Vance',
  emailVerified: true,
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  passwordChangedAt: '2026-04-01T00:00:00.000Z',
  reminderEmailsEnabled: true,
  reminderPushEnabled: true,
  timezone: 'UTC',
  theme: 'light',
  defaultCurrency: 'SGD',
  avatarUpdatedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const updateUser = vi.fn();

function setAuth() {
  mockedUseAuth.mockReturnValue({
    user: testUser,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser,
  } as unknown as ReturnType<typeof useAuth>);
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderSettings(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/settings" element={<SettingsShell />}>
          <Route index element={<SettingsIndexOrRedirect />} />
          <Route path="account" element={<AccountPanel />} />
          <Route path="notifications" element={<NotificationsPanel />} />
        </Route>
        <Route path="/profile" element={<ProfileRedirect />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('Settings routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth();
  });

  it('redirects /profile to /settings/account preserving the query string, toasts, then cleans the URL', async () => {
    stubMatchMedia(true);
    renderSettings('/profile?emailChanged=true');

    expect(await screen.findByText('Email address')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Your email address has been updated.');
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/settings\/account$/)
    );
  });

  it('toasts the invalid-token error from the confirmation redirect', async () => {
    stubMatchMedia(true);
    renderSettings('/profile?error=invalid-token');

    await screen.findByText('Email address');
    expect(toast.error).toHaveBeenCalledWith(
      'That confirmation link is invalid or has expired. Please request a new one.'
    );
  });

  it('redirects /settings to the Account tab on desktop', async () => {
    stubMatchMedia(true);
    renderSettings('/settings');

    expect(await screen.findByText('Email address')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/settings\/account$/);
  });

  it('shows the drill-down index menu on mobile', () => {
    stubMatchMedia(false);
    renderSettings('/settings');

    const menu = screen.getByRole('navigation', { name: 'Settings menu' });
    expect(within(menu).getByRole('link', { name: /account/i })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: /data & privacy/i })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/settings$/);
  });

  it('shows an icon-only back link to the index on mobile detail pages', () => {
    stubMatchMedia(false);
    renderSettings('/settings/notifications');

    expect(screen.getByRole('link', { name: 'Back to settings' })).toHaveAttribute('href', '/settings');
  });
});

describe('AccountPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth();
    stubMatchMedia(true);
  });

  it('shows the Verified chip and the password-age subtitle', async () => {
    renderSettings('/settings/account');

    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(screen.getByText(/^Last changed .* ago\.$/)).toBeInTheDocument();
  });

  it('saves a new name through the Edit name dialog', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockResolvedValue({
      data: { user: { ...testUser, name: 'Ada' } },
    } as Awaited<ReturnType<typeof updateProfile>>);
    renderSettings('/settings/account');

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const firstName = await screen.findByLabelText('First name');
    await user.clear(firstName);
    await user.type(firstName, 'Ada');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockedUpdateProfile).toHaveBeenCalledWith({ name: 'Ada', surname: 'Vance' })
    );
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ada' }));
    expect(toast.success).toHaveBeenCalledWith('Name updated');
  });

  it('surfaces a save failure inside the dialog', async () => {
    const user = userEvent.setup();
    mockedUpdateProfile.mockRejectedValue(new Error('network'));
    renderSettings('/settings/account');

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Failed to update your name. Please try again.')
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
