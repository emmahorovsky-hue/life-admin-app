import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { dashboardApi, type DashboardSummary } from '@/lib/dashboard';
import { subscriptionApi, type Subscription } from '@/lib/subscriptions';
import {
  ONBOARDING_STORAGE_KEY,
  onboardingStorageKey,
  readOnboardingState,
} from '@/lib/onboarding';

const USER_ID = 'u1';

vi.mock('@/lib/dashboard', () => ({ dashboardApi: { getSummary: vi.fn() } }));
vi.mock('@/lib/subscriptions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/subscriptions')>();
  return { ...actual, subscriptionApi: { getAll: vi.fn(), create: vi.fn() } };
});
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER_ID, name: 'Sam', email: 'sam@example.com' } }),
}));

const mockedDashboard = vi.mocked(dashboardApi);
const mockedSubs = vi.mocked(subscriptionApi);

const emptySummary: DashboardSummary = {
  totalMonthlySpend: '0.00',
  totalAnnualSpend: '0.00',
  activeSubscriptions: 0,
  upcomingRenewals: [],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

const wizardTitle = () => screen.queryByText('Pick what you pay for');

/** Minimal row — only the fields the dashboard reads off a subscription. */
const subRow = (over: Partial<Subscription> = {}) =>
  ({
    id: 's1',
    name: 'Netflix',
    cost: '15.99',
    currency: 'SGD',
    billingCycle: 'monthly',
    category: 'streaming',
    isActive: true,
    cancelledAt: null,
    ...over,
  }) as Subscription;

describe('Dashboard first-run onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockedSubs.getAll.mockResolvedValue([]);
    mockedDashboard.getSummary.mockResolvedValue(emptySummary);
  });

  it('opens the wizard for a fresh, empty account', async () => {
    renderDashboard();
    expect(await screen.findByText('Pick what you pay for')).toBeInTheDocument();
  });

  it('never opens for an account that already has subscriptions', async () => {
    mockedSubs.getAll.mockResolvedValue([subRow()]);
    mockedDashboard.getSummary.mockResolvedValue({ ...emptySummary, activeSubscriptions: 1 });
    renderDashboard();

    await screen.findByText(/welcome back, sam/i);
    expect(wizardTitle()).not.toBeInTheDocument();
  });

  // `activeSubscriptions` excludes cancelled rows, so gating on it would re-offer
  // the first-run wizard to someone who has a file and simply cancelled it all.
  it('never opens for an account whose only subscriptions are cancelled', async () => {
    mockedSubs.getAll.mockResolvedValue([subRow({ cancelledAt: '2026-01-01T00:00:00.000Z' })]);
    mockedDashboard.getSummary.mockResolvedValue({ ...emptySummary, activeSubscriptions: 0 });
    renderDashboard();

    await screen.findByText(/welcome back, sam/i);
    expect(wizardTitle()).not.toBeInTheDocument();
  });

  it('does not reopen once onboarding is done', async () => {
    localStorage.setItem(
      onboardingStorageKey(USER_ID),
      JSON.stringify({ status: 'done', step: 3, picks: [] })
    );
    renderDashboard();

    await screen.findByText(/welcome back, sam/i);
    expect(wizardTitle()).not.toBeInTheDocument();
  });

  // LIF-242. The browser-wide key is what the e2e suite seeds through, and what
  // real browsers still hold from before the flag was keyed by account, so it
  // has to keep suppressing the wizard for the user who is already here.
  it('honours a browser-wide state left by an earlier version', async () => {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ status: 'done', step: 3, picks: [] })
    );
    renderDashboard();

    await screen.findByText(/welcome back, sam/i);
    expect(wizardTitle()).not.toBeInTheDocument();
    // Adopted, then dropped — otherwise the next account to sign up in this
    // browser inherits it and never sees the wizard either. That was the bug.
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
    expect(readOnboardingState(USER_ID).status).toBe('done');
  });

  it('persists a skip and leaves the dashboard usable behind the resume card', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /netflix/i }));
    await user.click(screen.getByRole('button', { name: /skip setup/i }));

    await waitFor(() => expect(wizardTitle()).not.toBeInTheDocument());
    expect(readOnboardingState(USER_ID)).toEqual({
      status: 'skipped',
      step: 1,
      picks: ['Netflix'],
      created: [],
    });

    // The dashboard itself is untouched — nothing is blocked by having skipped.
    expect(screen.getByText(/welcome back, sam/i)).toBeInTheDocument();
    expect(screen.getByText('Finish setting up your file')).toBeInTheDocument();
  });

  it('shows the resume card, not the wizard, after a reload', async () => {
    localStorage.setItem(
      onboardingStorageKey(USER_ID),
      JSON.stringify({ status: 'skipped', step: 2, picks: ['Netflix'] })
    );
    renderDashboard();

    expect(await screen.findByText('Finish setting up your file')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 3 · Not started')).toBeInTheDocument();
    expect(wizardTitle()).not.toBeInTheDocument();
  });

  it('reopens the wizard at the remembered step from the resume card', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      onboardingStorageKey(USER_ID),
      JSON.stringify({ status: 'skipped', step: 2, picks: ['Netflix'] })
    );
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /resume setup/i }));

    expect(screen.getByText('Check the amounts')).toBeInTheDocument();
    expect(screen.getByLabelText('Netflix monthly cost')).toBeInTheDocument();
  });

  it('creates the picks, marks onboarding done and refetches the dashboard', async () => {
    const user = userEvent.setup();
    mockedSubs.create.mockResolvedValue({ id: 's1' } as never);
    localStorage.setItem(
      onboardingStorageKey(USER_ID),
      JSON.stringify({ status: 'pending', step: 2, picks: ['Netflix'] })
    );
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'File 1' }));

    await waitFor(() => expect(mockedSubs.create).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('1 subscription filed')).toBeInTheDocument();
    expect(readOnboardingState(USER_ID).status).toBe('done');
    // Initial load + the refetch that repopulates the tiles behind the modal.
    await waitFor(() => expect(mockedDashboard.getSummary).toHaveBeenCalledTimes(2));
  });

  // The dedupe lives in a ref, so it dies with the wizard. Unless the created
  // names are persisted, resuming after a partial failure re-sends the rows that
  // already landed and the user ends up with duplicates.
  it('does not re-create rows that already landed, across skip and resume', async () => {
    const user = userEvent.setup();
    mockedSubs.create
      .mockResolvedValueOnce({ id: 's1' } as never)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue({ id: 's2' } as never);
    localStorage.setItem(
      onboardingStorageKey(USER_ID),
      JSON.stringify({ status: 'pending', step: 2, picks: ['Netflix', 'Spotify'] })
    );
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'File 2' }));
    await screen.findByText(/could not be saved/i);
    expect(readOnboardingState(USER_ID).created).toEqual([]);

    await user.click(screen.getByRole('button', { name: /skip setup/i }));
    // Netflix landed, so the skip has to remember it.
    await waitFor(() => expect(readOnboardingState(USER_ID).created).toEqual(['Netflix']));

    await user.click(await screen.findByRole('button', { name: /resume setup/i }));
    await user.click(await screen.findByRole('button', { name: 'File 2' }));

    await waitFor(() => expect(mockedSubs.create).toHaveBeenCalledTimes(3));
    const names = mockedSubs.create.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(['Netflix', 'Spotify', 'Spotify']);
  });

  // A skip can follow a partial failure, in which case rows exist and the tiles
  // behind the modal are stale.
  it('refetches after a skip that left rows behind', async () => {
    const user = userEvent.setup();
    mockedSubs.create.mockRejectedValueOnce(new Error('network down'));
    localStorage.setItem(
      onboardingStorageKey(USER_ID),
      JSON.stringify({ status: 'pending', step: 2, picks: ['Netflix', 'Spotify'] })
    );
    mockedSubs.create.mockReset();
    mockedSubs.create
      .mockResolvedValueOnce({ id: 's1' } as never)
      .mockRejectedValueOnce(new Error('network down'));
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'File 2' }));
    await screen.findByText(/could not be saved/i);
    await user.click(screen.getByRole('button', { name: /skip setup/i }));

    await waitFor(() => expect(mockedDashboard.getSummary).toHaveBeenCalledTimes(2));
  });
});
