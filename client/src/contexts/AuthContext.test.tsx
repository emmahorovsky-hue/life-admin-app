import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock the axios instance the context talks to.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '@/lib/api';
const mockedGet = vi.mocked(api.get);

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

  it('throws if useAuth is used outside an AuthProvider', () => {
    // Silence the expected React error boundary log for this assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/must be used within an AuthProvider/);
    spy.mockRestore();
  });
});
