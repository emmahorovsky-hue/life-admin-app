import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivacyPanel from './PrivacyPanel';
import { deleteAccount } from '@/lib/api';

vi.mock('@/lib/api', () => ({ deleteAccount: vi.fn() }));
const mockedDeleteAccount = vi.mocked(deleteAccount);

// window.location.assign isn't implemented in jsdom — replace it for the test.
const originalLocation = window.location;
let assignMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, assign: assignMock },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  return screen.getByRole('button', { name: 'Delete account' });
}

describe('PrivacyPanel delete flow', () => {
  it('keeps the confirm button disabled until password and DELETE are both entered', async () => {
    const user = userEvent.setup();
    render(<PrivacyPanel />);
    const submit = await openDialog(user);

    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Current password'), 'Password1!');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/Type/), 'DELETE');
    expect(submit).toBeEnabled();
  });

  it('deletes and navigates to the landing page on success', async () => {
    const user = userEvent.setup();
    mockedDeleteAccount.mockResolvedValue({ data: { message: 'Account deleted' } } as never);
    render(<PrivacyPanel />);
    await openDialog(user);

    await user.type(screen.getByLabelText('Current password'), 'Password1!');
    await user.type(screen.getByLabelText(/Type/), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete account' }));

    await waitFor(() => expect(mockedDeleteAccount).toHaveBeenCalledWith({ password: 'Password1!' }));
    expect(assignMock).toHaveBeenCalledWith('/');
  });

  it('shows the server error inline and does not navigate on a wrong password', async () => {
    const user = userEvent.setup();
    mockedDeleteAccount.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { message: 'Current password is incorrect' } } },
    });
    render(<PrivacyPanel />);
    await openDialog(user);

    await user.type(screen.getByLabelText('Current password'), 'wrong');
    await user.type(screen.getByLabelText(/Type/), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Delete account' }));

    expect(await screen.findByText('Current password is incorrect')).toBeInTheDocument();
    expect(assignMock).not.toHaveBeenCalled();
  });
});
