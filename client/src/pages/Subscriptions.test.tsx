import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Subscriptions from './Subscriptions';
import { subscriptionApi, type Subscription } from '@/lib/subscriptions';

vi.mock('@/lib/subscriptions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/subscriptions')>();
  return {
    ...actual,
    subscriptionApi: {
      getAll: vi.fn(),
      delete: vi.fn(),
      cancel: vi.fn(),
      resume: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(subscriptionApi);

const netflix: Subscription = {
  id: 's1',
  userId: 'u1',
  name: 'Netflix',
  cost: '15.99',
  currency: 'USD',
  billingCycle: 'monthly',
  renewalDate: '2099-07-01T00:00:00.000Z',
  nextRenewalDate: '2099-07-01T00:00:00.000Z',
  category: 'streaming',
  notes: null,
  isActive: true,
  cancelledAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Subscriptions />
    </MemoryRouter>,
  );
}

/** Open the row's dialog and run the delete confirmation through to the API call. */
async function deleteNetflix(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /netflix/i }));
  await user.click(await screen.findByRole('button', { name: /^delete$/i }));
  await user.click(await screen.findByRole('button', { name: /yes, delete it/i }));
}

describe('Subscriptions mutation errors (LIF-139)', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom's window.alert throws "not implemented" rather than no-op, so spy on
    // it both to silence that and to assert we never reach for it.
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockedApi.getAll.mockResolvedValue([netflix]);
  });

  afterEach(() => alertSpy.mockRestore());

  it('shows a failed delete in the error banner instead of an alert()', async () => {
    const user = userEvent.setup();
    mockedApi.delete.mockRejectedValue(new Error('boom'));

    renderPage();
    await deleteNetflix(user);

    expect(await screen.findByText('Failed to delete subscription')).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('clears the banner once a later action succeeds', async () => {
    const user = userEvent.setup();
    mockedApi.delete.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    renderPage();
    await deleteNetflix(user);
    expect(await screen.findByText('Failed to delete subscription')).toBeInTheDocument();

    // A retry that succeeds triggers a reload, which resets the error state.
    mockedApi.getAll.mockResolvedValue([]);
    await deleteNetflix(user);

    await waitFor(() =>
      expect(screen.queryByText('Failed to delete subscription')).not.toBeInTheDocument(),
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
