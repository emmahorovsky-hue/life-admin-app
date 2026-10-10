import { Component, Suspense, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK_RELOAD_KEY, lazyPage, reloadForStaleChunk } from './lazyPage';

// A tab opened before a deploy asks for chunk names that no longer exist
// (LIF-279). It should reload once, and only once.

const reload = vi.fn();

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? <p>Caught: {String(this.state.error)}</p> : this.props.children;
  }
}

beforeEach(() => {
  window.sessionStorage.clear();
  reload.mockReset();
  vi.stubGlobal('location', { ...window.location, reload });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reloadForStaleChunk', () => {
  it('reloads and records when it did', () => {
    expect(reloadForStaleChunk(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('1000000');
  });

  it('does not reload again straight after a reload', () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1000000');
    expect(reloadForStaleChunk(1_010_000)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('recovers again for a later deploy in the same session', () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1000000');
    expect(reloadForStaleChunk(1_000_000 + 60_000)).toBe(true);
  });

  it('does not reload while offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(reloadForStaleChunk()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(reloadForStaleChunk()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('lazyPage', () => {
  const stale = () =>
    Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Login-old.js'));

  const renderPage = (Page: ReturnType<typeof lazyPage>) =>
    render(
      <Boundary>
        <Suspense fallback={<p>Loading</p>}>
          <Page />
        </Suspense>
      </Boundary>,
    );

  it('renders the page when the chunk loads', async () => {
    renderPage(lazyPage(async () => ({ default: () => <p>Login page</p> })));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps the loading screen up while it reloads for a stale chunk', async () => {
    renderPage(lazyPage(stale));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('rethrows when it already reloaded, so the failure is reported', async () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage(lazyPage(stale));
    expect(await screen.findByText(/Failed to fetch dynamically imported module/)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
