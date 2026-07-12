import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddSubscriptionDialog from './AddSubscriptionDialog';
import { subscriptionApi } from '@/lib/subscriptions';

vi.mock('@/lib/subscriptions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/subscriptions')>();
  return {
    ...actual,
    subscriptionApi: { create: vi.fn() },
  };
});

const mockedApi = vi.mocked(subscriptionApi);

/** Render the dialog open, with a rerender helper that flips `open`. */
function renderDialog() {
  const onOpenChange = vi.fn();
  const view = render(
    <AddSubscriptionDialog open onOpenChange={onOpenChange} onSuccess={vi.fn()} />,
  );
  const setOpen = (open: boolean) =>
    view.rerender(
      <AddSubscriptionDialog open={open} onOpenChange={onOpenChange} onSuccess={vi.fn()} />,
    );
  return { onOpenChange, setOpen };
}

const nameField = () => screen.getByRole('textbox', { name: 'Service name' });

describe('AddSubscriptionDialog (LIF-141)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears typed values when dismissed via the X and reopened', async () => {
    const user = userEvent.setup();
    const { onOpenChange, setOpen } = renderDialog();

    await user.type(nameField(), 'Netflix');
    expect(nameField()).toHaveValue('Netflix');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // The parent owns `open`, so mirror what it does in response.
    setOpen(false);
    setOpen(true);

    expect(nameField()).toHaveValue('');
  });

  it('does not blank the fields while the dialog is still open', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(nameField(), 'Spotify');

    // Resetting on close (rather than on open) would wipe these in view.
    expect(nameField()).toHaveValue('Spotify');
  });

  it('clears a failed-save error on the next open', async () => {
    const user = userEvent.setup();
    mockedApi.create.mockRejectedValue(new Error('boom'));
    const { setOpen } = renderDialog();

    await user.type(nameField(), 'Netflix');
    await user.type(screen.getByRole('spinbutton', { name: 'Cost' }), '9.99');
    await user.click(screen.getByRole('button', { name: /add subscription/i }));

    expect(await screen.findByText('Failed to add subscription')).toBeInTheDocument();

    setOpen(false);
    setOpen(true);

    expect(screen.queryByText('Failed to add subscription')).not.toBeInTheDocument();
    expect(nameField()).toHaveValue('');
  });
});
