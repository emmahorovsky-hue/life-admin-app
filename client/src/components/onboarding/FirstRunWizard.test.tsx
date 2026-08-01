import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FirstRunWizard } from './FirstRunWizard';
import { subscriptionApi } from '@/lib/subscriptions';

vi.mock('@/lib/subscriptions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/subscriptions')>();
  return { ...actual, subscriptionApi: { create: vi.fn() } };
});

const mockedApi = vi.mocked(subscriptionApi);

function renderWizard(overrides: Partial<React.ComponentProps<typeof FirstRunWizard>> = {}) {
  const props = {
    open: true,
    initialStep: 1 as const,
    initialPicks: [] as string[],
    initialCreated: [] as string[],
    onSkip: vi.fn(),
    onFiled: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
  render(<FirstRunWizard {...props} />);
  return props;
}

const pick = (name: string) => screen.getByRole('button', { name: new RegExp(name, 'i') });

describe('FirstRunWizard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens on step 1 with the service chips unselected', () => {
    renderWizard();
    expect(screen.getByText('Set up · Step 1 of 3')).toBeInTheDocument();
    expect(pick('Netflix')).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles a chip on and back off', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(pick('Netflix'));
    expect(pick('Netflix')).toHaveAttribute('aria-pressed', 'true');

    await user.click(pick('Netflix'));
    expect(pick('Netflix')).toHaveAttribute('aria-pressed', 'false');
  });

  it('carries the picks through to step 2 and totals them', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(pick('Netflix'));
    await user.click(pick('Spotify'));
    await user.click(screen.getByRole('button', { name: /next — check amounts/i }));

    expect(screen.getByText('Check the amounts')).toBeInTheDocument();
    // Suggestion defaults: Netflix 15.99 + Spotify 11.99.
    expect(screen.getByLabelText('Netflix monthly cost')).toHaveValue(15.99);
    expect(screen.getByLabelText('Spotify monthly cost')).toHaveValue(11.99);
    expect(screen.getByRole('button', { name: 'File 2' })).toBeEnabled();
  });

  it('disables filing when nothing was picked', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('button', { name: /next — check amounts/i }));

    expect(screen.getByText(/nothing picked yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'File 0' })).toBeDisabled();
  });

  it('creates each picked subscription and lands on the filed step', async () => {
    const user = userEvent.setup();
    mockedApi.create.mockResolvedValue({ id: 's1' } as never);
    const props = renderWizard({ initialStep: 2, initialPicks: ['Netflix'] });

    await user.clear(screen.getByLabelText('Netflix monthly cost'));
    await user.type(screen.getByLabelText('Netflix monthly cost'), '18.50');
    await user.click(screen.getByRole('button', { name: 'File 1' }));

    await waitFor(() => expect(mockedApi.create).toHaveBeenCalledTimes(1));
    expect(mockedApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Netflix', cost: 18.5, category: 'streaming', billingCycle: 'monthly' })
    );

    expect(await screen.findByText('1 subscription filed')).toBeInTheDocument();
    expect(props.onFiled).toHaveBeenCalledWith(1);
  });

  it('keeps the edits and reports the failure when creation fails', async () => {
    const user = userEvent.setup();
    mockedApi.create.mockRejectedValue(new Error('network down'));
    renderWizard({ initialStep: 2, initialPicks: ['Netflix'] });

    await user.clear(screen.getByLabelText('Netflix monthly cost'));
    await user.type(screen.getByLabelText('Netflix monthly cost'), '18.50');
    await user.click(screen.getByRole('button', { name: 'File 1' }));

    expect(await screen.findByText(/could not be saved/i)).toBeInTheDocument();
    // Still on step 2, with the correction intact.
    expect(screen.getByLabelText('Netflix monthly cost')).toHaveValue(18.5);
  });

  // A retry must not re-create the rows that already succeeded, or a single
  // partial failure would leave the user with duplicates.
  it('only retries the rows that failed', async () => {
    const user = userEvent.setup();
    mockedApi.create
      .mockResolvedValueOnce({ id: 's1' } as never)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ id: 's2' } as never);
    renderWizard({ initialStep: 2, initialPicks: ['Netflix', 'Spotify'] });

    await user.click(screen.getByRole('button', { name: 'File 2' }));
    expect(await screen.findByText(/could not be saved/i)).toBeInTheDocument();
    expect(mockedApi.create).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'File 2' }));
    await waitFor(() => expect(mockedApi.create).toHaveBeenCalledTimes(3));
    // The third call is the retry of Spotify alone — Netflix is not re-sent.
    expect(mockedApi.create).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Spotify' }));
  });

  it('reports the step and picks when skipped, so it can be resumed', async () => {
    const user = userEvent.setup();
    const props = renderWizard();

    await user.click(pick('Netflix'));
    await user.click(screen.getByRole('button', { name: /skip setup/i }));

    expect(props.onSkip).toHaveBeenCalledWith(1, ['Netflix'], []);
  });

  it('closes on Escape, remembering where the user was', async () => {
    const user = userEvent.setup();
    const props = renderWizard({ initialStep: 2, initialPicks: ['Netflix'] });

    await user.keyboard('{Escape}');

    expect(props.onSkip).toHaveBeenCalledWith(2, ['Netflix'], []);
  });

  it('moves focus into the dialog on open', async () => {
    renderWizard();
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('wraps focus from the last control back to the first, and back again', async () => {
    const user = userEvent.setup();
    renderWizard();

    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])')
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    expect(first).not.toBe(last);

    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  // The server rejects an empty renewalDate with a bare "Validation failed",
  // which says nothing about which field is at fault — so catch it here.
  it('blocks filing while a row is missing its amount or renewal date', async () => {
    const user = userEvent.setup();
    renderWizard({ initialStep: 2, initialPicks: ['Netflix'] });

    await user.clear(screen.getByLabelText('Netflix renewal date'));

    expect(screen.getByRole('button', { name: 'File 1' })).toBeDisabled();
    expect(screen.getByText(/needs an amount and a renewal date/i)).toBeInTheDocument();
    expect(mockedApi.create).not.toHaveBeenCalled();
  });

  it('blocks filing when an amount is cleared', async () => {
    const user = userEvent.setup();
    renderWizard({ initialStep: 2, initialPicks: ['Netflix'] });

    await user.clear(screen.getByLabelText('Netflix monthly cost'));

    expect(screen.getByRole('button', { name: 'File 1' })).toBeDisabled();
  });

  // The amount must stay type=number. As free text a comma-decimal locale can
  // enter "18,50", which parseFloat truncates to 18 — the wrong amount, filed
  // silently. Asserted as an attribute rather than by typing a comma: jsdom
  // sanitises number inputs differently from browsers (it yields "1850" where
  // Chrome reports badInput), so a behavioural test here would only pin down a
  // jsdom artifact.
  it('keeps the amount field numeric so a comma cannot be misread as a decimal', () => {
    renderWizard({ initialStep: 2, initialPicks: ['Netflix'] });

    const cost = screen.getByLabelText('Netflix monthly cost');
    expect(cost).toHaveAttribute('type', 'number');
    expect(cost).toHaveAttribute('min', '0');
  });

  it('reports the already-created rows when skipped after a partial failure', async () => {
    const user = userEvent.setup();
    mockedApi.create
      .mockResolvedValueOnce({ id: 's1' } as never)
      .mockRejectedValueOnce(new Error('network down'));
    const props = renderWizard({ initialStep: 2, initialPicks: ['Netflix', 'Spotify'] });

    await user.click(screen.getByRole('button', { name: 'File 2' }));
    await screen.findByText(/could not be saved/i);
    await user.click(screen.getByRole('button', { name: /skip setup/i }));

    expect(props.onSkip).toHaveBeenCalledWith(2, ['Netflix', 'Spotify'], ['Netflix']);
  });

  it('seeds the dedupe from the rows a previous run created', async () => {
    const user = userEvent.setup();
    mockedApi.create.mockResolvedValue({ id: 's2' } as never);
    renderWizard({
      initialStep: 2,
      initialPicks: ['Netflix', 'Spotify'],
      initialCreated: ['Netflix'],
    });

    await user.click(screen.getByRole('button', { name: 'File 2' }));

    await waitFor(() => expect(mockedApi.create).toHaveBeenCalledTimes(1));
    expect(mockedApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Spotify' }));
  });

  // "Validation failed" on its own leaves the user unsure whether their edits
  // survived, so the actionable sentence has to stay.
  it('keeps the retry guidance even when the server sends a terse message', async () => {
    const user = userEvent.setup();
    mockedApi.create.mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { data: { error: { message: 'Validation failed' } } },
      })
    );
    renderWizard({ initialStep: 2, initialPicks: ['Netflix'] });

    await user.click(screen.getByRole('button', { name: 'File 1' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/your edits are kept/i);
    expect(alert).toHaveTextContent(/validation failed/i);
  });
});
