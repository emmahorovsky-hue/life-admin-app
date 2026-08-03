import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Subscriptions from './Subscriptions';
import { subscriptionApi, type Subscription } from '@/lib/subscriptions';

// AddSubscriptionDialog opens a blank form in the account's own currency, so it
// reads the auth context.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', defaultCurrency: 'SGD' }, updateUser: vi.fn() }),
}));


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

const dropbox: Subscription = {
  ...netflix,
  id: 's2',
  name: 'Dropbox',
  category: 'cloud',
};

describe('Subscriptions category filter (LIF-241)', () => {
  beforeEach(() => vi.clearAllMocks());

  // The page renders exactly one <select>, so getByRole('combobox') is the handle.
  const selectCategory = async (user: ReturnType<typeof userEvent.setup>, value: string) =>
    user.selectOptions(await screen.findByRole('combobox'), value);

  it('narrows the list to the chosen category', async () => {
    const user = userEvent.setup();
    mockedApi.getAll.mockResolvedValue([netflix, dropbox]);

    renderPage();
    expect(await screen.findByRole('button', { name: /netflix/i })).toBeInTheDocument();

    await selectCategory(user, 'cloud');

    expect(await screen.findByRole('button', { name: /dropbox/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /netflix/i })).not.toBeInTheDocument();
  });

  // The reported symptom, pinned: a cloud service stored as `other` is missing from
  // the Cloud Storage filter. The filter is right — the stored category is wrong —
  // and the fix for that lives in the receipt-extraction path, not here.
  it('shows the no-matches empty state when a cloud service is stored as "other"', async () => {
    const user = userEvent.setup();
    mockedApi.getAll.mockResolvedValue([{ ...dropbox, category: 'other' }]);

    renderPage();
    expect(await screen.findByRole('button', { name: /dropbox/i })).toBeInTheDocument();

    await selectCategory(user, 'cloud');

    expect(await screen.findByText(/no subscriptions match your filters/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dropbox/i })).not.toBeInTheDocument();
  });

  it('restores the full list when the filter is cleared', async () => {
    const user = userEvent.setup();
    mockedApi.getAll.mockResolvedValue([netflix, dropbox]);

    renderPage();
    await selectCategory(user, 'cloud');
    expect(screen.queryByRole('button', { name: /netflix/i })).not.toBeInTheDocument();

    await selectCategory(user, 'all');

    expect(await screen.findByRole('button', { name: /netflix/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /dropbox/i })).toBeInTheDocument();
  });
});

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
