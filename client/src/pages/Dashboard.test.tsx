import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
import { readDashboardCurrency, writeDashboardCurrency } from '@/lib/dashboardCurrency';
import { addDays, format } from 'date-fns';

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

// The dashboard shows one currency at a time (LIF-257). Selecting one narrows
// the existing per-currency data — it never adds two currencies together.
describe('Dashboard currency switcher', () => {
  const inDays = (days: number) => format(addDays(new Date(), days), 'yyyy-MM-dd');

  const renewal = (over: Partial<DashboardSummary['upcomingRenewals'][number]>) => ({
    id: 's1',
    name: 'Netflix',
    cost: '15.99',
    category: 'streaming',
    renewalDate: inDays(3),
    nextRenewalDate: inDays(3),
    daysUntilRenewal: 3,
    ...over,
  });

  // Two SGD subscriptions and one EUR one, so SGD is the dominant currency.
  const multiCurrencySubs = [
    subRow({ id: 's1', name: 'Netflix', cost: '15.99', currency: 'SGD' }),
    subRow({ id: 's2', name: 'Spotify', cost: '9.99', currency: 'SGD', category: 'music' }),
    subRow({ id: 's3', name: 'Figma', cost: '12.00', currency: 'EUR', category: 'software' }),
  ];

  const multiCurrencySummary: DashboardSummary = {
    totalMonthlySpend: '37.98', // the meaningless cross-currency sum, never rendered
    totalAnnualSpend: '455.76',
    activeSubscriptions: 3,
    spendByCurrency: [
      { currency: 'SGD', totalMonthlySpend: '25.98', totalAnnualSpend: '311.76', activeSubscriptions: 2 },
      { currency: 'EUR', totalMonthlySpend: '12.00', totalAnnualSpend: '144.00', activeSubscriptions: 1 },
    ],
    upcomingRenewals: [
      renewal({}),
      // 20 days out, so EUR has an upcoming renewal but nothing due this week.
      renewal({
        id: 's3',
        name: 'Figma',
        cost: '12.00',
        category: 'software',
        renewalDate: inDays(20),
        nextRenewalDate: inDays(20),
        daysUntilRenewal: 20,
      }),
    ],
  };

  const tabs = () => screen.getByRole('group', { name: 'Currency' });
  const tab = (code: string) => within(tabs()).getByRole('button', { name: code });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Onboarding is irrelevant here and its overlay would swallow the clicks.
    localStorage.setItem(
      onboardingStorageKey(USER_ID),
      JSON.stringify({ status: 'done', step: 3, picks: [] })
    );
    mockedSubs.getAll.mockResolvedValue(multiCurrencySubs);
    mockedDashboard.getSummary.mockResolvedValue(multiCurrencySummary);
  });

  it('stays hidden for an account with a single currency', async () => {
    mockedSubs.getAll.mockResolvedValue([subRow()]);
    mockedDashboard.getSummary.mockResolvedValue({
      ...emptySummary,
      totalMonthlySpend: '15.99',
      totalAnnualSpend: '191.88',
      activeSubscriptions: 1,
      spendByCurrency: [
        { currency: 'SGD', totalMonthlySpend: '15.99', totalAnnualSpend: '191.88', activeSubscriptions: 1 },
      ],
    });
    renderDashboard();

    await screen.findByText(/welcome back, sam/i);
    expect(screen.queryByRole('group', { name: 'Currency' })).not.toBeInTheDocument();
    expect(screen.getByText('$15.99')).toBeInTheDocument();
  });

  it('offers a tab per currency, dominant first, and opens on the dominant one', async () => {
    renderDashboard();

    await screen.findByRole('group', { name: 'Currency' });
    expect(within(tabs()).getAllByRole('button').map((b) => b.textContent)).toEqual(['SGD', 'EUR']);
    expect(tab('SGD')).toHaveAttribute('aria-pressed', 'true');
    expect(tab('EUR')).toHaveAttribute('aria-pressed', 'false');

    // One clean figure per tile, and no sign of the other currency.
    expect(screen.getByText('$25.98')).toBeInTheDocument();
    expect(screen.getByText('$311.76')).toBeInTheDocument();
    expect(screen.getByText('2 active subscriptions')).toBeInTheDocument();
    expect(screen.queryByText('€12.00')).not.toBeInTheDocument();
  });

  it('rescopes every tile, the receipt and the chart header when a tab is picked', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'EUR' }));

    expect(tab('EUR')).toHaveAttribute('aria-pressed', 'true');
    // The monthly tile, the Figma row and the receipt total — all €12.00.
    expect(screen.getAllByText('€12.00')).toHaveLength(3);
    expect(screen.getByText('€144.00')).toBeInTheDocument();
    expect(screen.getByText('1 active subscription')).toBeInTheDocument();
    // SGD's figures are gone, not folded in — no cross-currency sum exists.
    expect(screen.queryByText('$25.98')).not.toBeInTheDocument();
    expect(screen.queryByText(/37\.98/)).not.toBeInTheDocument();

    // The receipt lists only this currency's renewals.
    expect(screen.getByText('Figma')).toBeInTheDocument();
    expect(screen.queryByText('Netflix')).not.toBeInTheDocument();

    // Nothing due in EUR this week reads as a zero, not a blank.
    expect(screen.getByText('€0.00')).toBeInTheDocument();
    expect(screen.getByText('Nothing due this week')).toBeInTheDocument();
  });

  it('shows an inline empty state for a currency with no upcoming renewals', async () => {
    const user = userEvent.setup();
    mockedDashboard.getSummary.mockResolvedValue({
      ...multiCurrencySummary,
      upcomingRenewals: [renewal({})], // SGD only
    });
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'EUR' }));

    expect(screen.getByText('No EUR renewals in the next 30 days')).toBeInTheDocument();
  });

  it('remembers the choice for this account', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'EUR' }));
    expect(readDashboardCurrency(USER_ID)).toBe('EUR');
  });

  it('opens on the remembered currency', async () => {
    writeDashboardCurrency(USER_ID, 'EUR');
    renderDashboard();

    await screen.findByRole('group', { name: 'Currency' });
    expect(tab('EUR')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('€144.00')).toBeInTheDocument();
  });

  // The user deleted the last subscription in the remembered currency: the page
  // must not stay scoped to a currency the account no longer holds.
  it('falls back to the dominant currency when the remembered one is gone', async () => {
    writeDashboardCurrency(USER_ID, 'GBP');
    renderDashboard();

    await screen.findByRole('group', { name: 'Currency' });
    expect(tab('SGD')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('$25.98')).toBeInTheDocument();
  });

  // The summary used to arrive capped at the 5 earliest renewals across every
  // currency, so a currency whose renewals all sat behind another's simply had
  // none to filter — its tab claimed "no renewals" while they existed. The
  // window now arrives whole and the 5-row cut happens after the filter.
  it('shows a currency its own renewals even when others are due first', async () => {
    const user = userEvent.setup();
    mockedDashboard.getSummary.mockResolvedValue({
      ...multiCurrencySummary,
      upcomingRenewals: [
        // Six SGD renewals, all sooner than the EUR one.
        ...Array.from({ length: 6 }, (_, i) =>
          renewal({
            id: `sgd${i}`,
            name: `SGD sub ${i}`,
            renewalDate: inDays(i + 1),
            nextRenewalDate: inDays(i + 1),
            daysUntilRenewal: i + 1,
          })
        ),
        renewal({
          id: 's3',
          name: 'Figma',
          cost: '12.00',
          category: 'software',
          renewalDate: inDays(20),
          nextRenewalDate: inDays(20),
          daysUntilRenewal: 20,
        }),
      ],
    });
    mockedSubs.getAll.mockResolvedValue([
      ...Array.from({ length: 6 }, (_, i) =>
        subRow({ id: `sgd${i}`, name: `SGD sub ${i}`, currency: 'SGD' })
      ),
      subRow({ id: 's3', name: 'Figma', cost: '12.00', currency: 'EUR', category: 'software' }),
    ]);
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: 'EUR' }));

    expect(screen.getByText('Figma')).toBeInTheDocument();
    expect(screen.queryByText('No EUR renewals in the next 30 days')).not.toBeInTheDocument();
  });

  // The 5-row display cut is per currency, and the total below it still covers
  // every one — the label says so, and the button offers the rest.
  it('caps the receipt at five rows of the selected currency and offers the rest', async () => {
    mockedDashboard.getSummary.mockResolvedValue({
      ...multiCurrencySummary,
      // Five due this week and a sixth well after it, so the receipt total
      // ($60) is distinguishable from the due-soon tile ($50).
      upcomingRenewals: [1, 2, 3, 4, 5, 20].map((days, i) =>
        renewal({
          id: `sgd${i}`,
          name: `SGD sub ${i}`,
          cost: '10.00',
          renewalDate: inDays(days),
          nextRenewalDate: inDays(days),
          daysUntilRenewal: days,
        })
      ),
    });
    mockedSubs.getAll.mockResolvedValue([
      ...Array.from({ length: 6 }, (_, i) =>
        subRow({ id: `sgd${i}`, name: `SGD sub ${i}`, cost: '10.00', currency: 'SGD' })
      ),
      subRow({ id: 's3', name: 'Figma', cost: '12.00', currency: 'EUR', category: 'software' }),
    ]);
    renderDashboard();

    await screen.findByRole('group', { name: 'Currency' });
    expect(screen.getByText('SGD sub 4')).toBeInTheDocument();
    expect(screen.queryByText('SGD sub 5')).not.toBeInTheDocument();
    expect(screen.getByText('Total · all 6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all 6 renewals' })).toBeInTheDocument();
    // The total covers all six rows, not the five on screen — and it isn't the
    // due-soon tile, which counts only the five inside the week.
    expect(screen.getByText('$60.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  // Every figure on the page excludes cancelled subscriptions, so a currency
  // left with only cancelled rows has nothing to show — a tab for it would open
  // on zeros in every tile.
  it('offers no tab for a currency whose subscriptions are all cancelled', async () => {
    mockedSubs.getAll.mockResolvedValue([
      subRow({ id: 's1', name: 'Netflix', currency: 'SGD' }),
      subRow({
        id: 's3',
        name: 'Figma',
        cost: '12.00',
        currency: 'EUR',
        category: 'software',
        cancelledAt: '2026-08-01T00:00:00.000Z',
      }),
    ]);
    mockedDashboard.getSummary.mockResolvedValue({
      ...multiCurrencySummary,
      spendByCurrency: [
        { currency: 'SGD', totalMonthlySpend: '15.99', totalAnnualSpend: '191.88', activeSubscriptions: 1 },
      ],
      upcomingRenewals: [renewal({})],
    });
    renderDashboard();

    await screen.findByText(/welcome back, sam/i);
    expect(screen.queryByRole('group', { name: 'Currency' })).not.toBeInTheDocument();
    expect(screen.getByText('1 active subscription')).toBeInTheDocument();
    // The cancelled EUR row is gone from the chart too, so nothing is stranded.
    expect(screen.queryByText('Figma')).not.toBeInTheDocument();
  });

  // A file of nothing but cancelled subscriptions isn't an empty account, and
  // must not be offered the "add your first one" prompt.
  it('tells an all-cancelled account there is nothing active to chart', async () => {
    mockedSubs.getAll.mockResolvedValue([
      subRow({ id: 's1', currency: 'SGD', cancelledAt: '2026-08-01T00:00:00.000Z' }),
    ]);
    mockedDashboard.getSummary.mockResolvedValue(emptySummary);
    renderDashboard();

    await screen.findByText('Nothing active to chart');
    expect(screen.queryByText('No subscriptions yet')).not.toBeInTheDocument();
  });
});
