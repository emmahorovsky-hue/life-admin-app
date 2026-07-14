import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { toast } from 'sonner';
import { Toaster } from './toaster';

describe('Toaster', () => {
  it('renders fired toasts', async () => {
    render(<Toaster />);

    act(() => {
      toast.success('Settings saved');
    });

    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });
});
