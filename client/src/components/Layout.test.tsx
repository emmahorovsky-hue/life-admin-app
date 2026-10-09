import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '@life-admin/shared';
import Layout from './Layout';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({ avatarUrl: vi.fn(() => null) }));
vi.mock('./UnverifiedEmailBanner', () => ({ UnverifiedEmailBanner: () => null }));

const mockedUseAuth = vi.mocked(useAuth);

function renderLayout(user: Partial<User> = {}) {
  mockedUseAuth.mockReturnValue({
    user: {
      id: 'u1',
      email: 'me@example.com',
      name: null,
      surname: null,
      emailVerified: true,
      ...user,
    } as User,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter>
      <Layout>
        <div />
      </Layout>
    </MemoryRouter>,
  );
}

describe('Layout sidebar account row', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the email once when no name is set', () => {
    renderLayout();

    expect(screen.getAllByText('me@example.com')).toHaveLength(1);
  });

  it('shows the name with the email beneath it once one is set', () => {
    renderLayout({ name: 'Ada', surname: 'Lovelace' });

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getAllByText('me@example.com')).toHaveLength(1);
  });
});
