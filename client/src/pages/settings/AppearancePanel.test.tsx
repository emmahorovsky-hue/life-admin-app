import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppearancePanel from './AppearancePanel';
import { useTheme } from '@/contexts/ThemeContext';

vi.mock('@/contexts/ThemeContext', () => ({ useTheme: vi.fn() }));

const mockedUseTheme = vi.mocked(useTheme);
const setTheme = vi.fn();

describe('AppearancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseTheme.mockReturnValue({ theme: 'light', setTheme });
  });

  it('marks the active theme segment and switches via setTheme', async () => {
    const user = userEvent.setup();
    render(<AppearancePanel />);

    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('no longer holds the default currency (moved to Account)', () => {
    render(<AppearancePanel />);
    expect(screen.queryByLabelText(/Default currency/)).not.toBeInTheDocument();
  });
});
