import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const mockedUseAuth = vi.mocked(useAuth);

type AuthState = ReturnType<typeof useAuth>;

function setAuth(state: Partial<AuthState>) {
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...state,
  } as AuthState);
}

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <div>Secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => mockedUseAuth.mockReset());

  it('shows a loading state while auth is resolving', () => {
    setAuth({ loading: true });
    renderProtected();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    setAuth({ user: null, loading: false });
    renderProtected();
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    setAuth({ user: { id: '1', email: 'a@b.com' } as AuthState['user'], loading: false });
    renderProtected();
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });
});
