import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock the axios instance the context talks to.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  onUnauthorized: vi.fn(() => () => {}),
}));

import api, { onUnauthorized } from '@/lib/api';
const mockedGet = vi.mocked(api.get);
const mockedOnUnauthorized = vi.mocked(onUnauthorized);

function Consumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? user.email : 'no-user'}</div>;
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}

describe('AuthContext', () => {
  beforeEach(() => vi.clearAllMocks());

  it('populates the user from GET /auth/me on mount', async () => {
    mockedGet.mockResolvedValueOnce({ data: { user: { email: 'me@example.com' } } });
    renderWithProvider();

    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('me@example.com')).toBeInTheDocument());
    expect(mockedGet).toHaveBeenCalledWith('/auth/me');
  });

  it('leaves the user null when the auth check fails (401)', async () => {
    mockedGet.mockRejectedValueOnce(new Error('Unauthorized'));
    renderWithProvider();

    await waitFor(() => expect(screen.getByText('no-user')).toBeInTheDocument());
  });

  it('clears the user when the API client reports a 401', async () => {
    mockedGet.mockResolvedValueOnce({ data: { user: { email: 'me@example.com' } } });
    renderWithProvider();
    await waitFor(() => expect(screen.getByText('me@example.com')).toBeInTheDocument());

    // The interceptor emits instead of hard-navigating; the provider drops the
    // user, which is what makes ProtectedRoute redirect through the router.
    const notifyUnauthorized = mockedOnUnauthorized.mock.calls[0][0];
    act(() => notifyUnauthorized());

    await waitFor(() => expect(screen.getByText('no-user')).toBeInTheDocument());
  });

  it('unsubscribes from 401 notifications on unmount', async () => {
    const unsubscribe = vi.fn();
    mockedOnUnauthorized.mockReturnValueOnce(unsubscribe);
    mockedGet.mockResolvedValueOnce({ data: { user: { email: 'me@example.com' } } });

    const { unmount } = renderWithProvider();
    await waitFor(() => expect(screen.getByText('me@example.com')).toBeInTheDocument());

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('throws if useAuth is used outside an AuthProvider', () => {
    // Silence the expected React error boundary log for this assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/must be used within an AuthProvider/);
    spy.mockRestore();
  });
});
