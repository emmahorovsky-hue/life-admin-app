import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { dashboardApi, type DashboardSummary } from '@/lib/dashboard';
import { subscriptionApi } from '@/lib/subscriptions';
import { ONBOARDING_STORAGE_KEY, readOnboardingState } from '@/lib/onboarding';

vi.mock('@/lib/dashboard', () => ({ dashboardApi: { getSummary: vi.fn() } }));
vi.mock('@/lib/subscriptions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/subscriptions')>();
  return { ...actual, subscriptionApi: { getAll: vi.fn(), create: vi.fn() } };
});
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Sam', email: 'sam@example.com' } }),
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
    mockedDashboard.getSummary.mockResolvedValue({ ...emptySummary, activeSubscriptions: 2 });
    renderDashboard();

    await screen.findByText(/welcome back, sam/i);
    expect(wizardTitle()).not.toBeInTheDocument();
  });

  it('does not reopen once onboarding is done', async () => {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ status: 'done', step: 3, picks: [] })
    );
    renderDashboard();

    await screen.findByText(/welcome back, sam/i);
    expect(wizardTitle()).not.toBeInTheDocument();
  });

  it('persists a skip and leaves the dashboard usable behind the resume card', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /netflix/i }));
    await user.click(screen.getByRole('button', { name: /skip setup/i }));

    await waitFor(() => expect(wizardTitle()).not.toBeInTheDocument());
    expect(readOnboardingState()).toEqual({ status: 'skipped', step: 1, picks: ['Netflix'] });

    // The dashboard itself is untouched — nothing is blocked by having skipped.
    expect(screen.getByText(/welcome back, sam/i)).toBeInTheDocument();
    expect(screen.getByText('Finish setting up your file')).toBeInTheDocument();
  });

  it('shows the resume card, not the wizard, after a reload', async () => {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
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
      ONBOARDING_STORAGE_KEY,
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
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ status: 'pending', step: 2, picks: ['Netflix'] })
    );
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'File 1' }));

    await waitFor(() => expect(mockedSubs.create).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('1 subscription filed')).toBeInTheDocument();
    expect(readOnboardingState().status).toBe('done');
    // Initial load + the refetch that repopulates the tiles behind the modal.
    await waitFor(() => expect(mockedDashboard.getSummary).toHaveBeenCalledTimes(2));
  });
});
