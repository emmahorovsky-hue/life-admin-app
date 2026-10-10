import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary, PageErrorBoundary } from './ErrorBoundary';

// A render error used to unmount the whole tree and leave a blank page
// (LIF-280). Each layer should show its fallback and report exactly once.

const sent: ErrorEvent[] = [];
const originals: unknown[] = [];

beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@o0.ingest.sentry.io/0',
    defaultIntegrations: false,
    beforeSend: (event, hint) => {
      sent.push(event);
      originals.push(hint.originalException);
      return null; // record, never send
    },
  });
});

afterAll(() => Sentry.close());

beforeEach(() => {
  sent.length = 0;
  originals.length = 0;
  // React logs every caught render error; the boundary is the point here.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

let shouldThrow = true;
function Boom() {
  if (shouldThrow) throw new Error('render exploded');
  return <p>Recovered page</p>;
}

const reported = () => vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));

describe('AppErrorBoundary', () => {
  it('shows the fallback instead of a blank page, with a way out', async () => {
    shouldThrow = true;
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    // A plain link: the router may be what crashed.
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');
    await reported();
  });

  it('renders children untouched when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>Dashboard</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('PageErrorBoundary', () => {
  it('keeps the surrounding layout and recovers on "Try again"', async () => {
    shouldThrow = true;
    render(
      <AppErrorBoundary>
        <nav>Sidebar</nav>
        <PageErrorBoundary>
          <Boom />
        </PageErrorBoundary>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Sidebar')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("This page didn't load");
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered page')).toBeInTheDocument();
  });

  it('resets when its key changes, as Layout does on navigation', async () => {
    shouldThrow = true;
    function Harness() {
      const [path, setPath] = useState('/subscriptions');
      return (
        <>
          <button onClick={() => setPath('/dashboard')}>Dashboard</button>
          <PageErrorBoundary key={path}>
            {path === '/subscriptions' ? <Boom /> : <p>Dashboard page</p>}
          </PageErrorBoundary>
        </>
      );
    }
    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports a page crash to Sentry once, with the component stack', async () => {
    shouldThrow = true;
    render(
      <AppErrorBoundary>
        <PageErrorBoundary>
          <Boom />
        </PageErrorBoundary>
      </AppErrorBoundary>,
    );
    await reported();
    await new Promise((r) => setTimeout(r, 50)); // give a duplicate the chance to arrive
    expect(sent).toHaveLength(1);
    expect(sent[0].exception?.values?.some((v) => v.value === 'render exploded')).toBe(true);
    expect(sent[0].exception?.values?.[0]?.mechanism?.type).toMatch(/error_boundary/);
    // Sentry hangs the React component stack off the error as its cause.
    const cause = (originals[0] as Error).cause as Error;
    expect(cause.stack).toMatch(/Boom/);
  });
});
