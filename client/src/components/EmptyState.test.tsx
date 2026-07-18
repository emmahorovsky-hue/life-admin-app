import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders title, kicker, description and action', () => {
    render(
      <EmptyState
        kicker="Nothing filed yet"
        title="No subscriptions yet"
        description="Add your first one."
        action={<button type="button">Add your first subscription</button>}
      />
    );

    expect(screen.getByRole('heading', { name: 'No subscriptions yet' })).toBeInTheDocument();
    expect(screen.getByText('Nothing filed yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first one.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add your first subscription' })
    ).toBeInTheDocument();
  });

  it('renders the default Paypr mark, and omits it when icon is null', () => {
    const { container, rerender } = render(<EmptyState title="Default icon" />);
    // The mark is a decorative inline SVG.
    expect(container.querySelector('svg')).toBeInTheDocument();

    rerender(<EmptyState title="No icon" icon={null} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders a custom icon when provided (e.g. the filtered/no-results state)', () => {
    render(
      <EmptyState
        icon={<span data-testid="search-icon" />}
        title="No subscriptions match your filters"
      />
    );

    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'No subscriptions match your filters' })
    ).toBeInTheDocument();
  });

  it('does not require a description or action', () => {
    render(<EmptyState tone="inline" title="No renewals in the next 30 days" icon={null} />);
    expect(
      screen.getByRole('heading', { name: 'No renewals in the next 30 days' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
