import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppDialog } from './AppDialog';

/**
 * These assert classes rather than measured geometry on purpose: jsdom does no
 * layout, so `scrollHeight`/`clientHeight` are 0 for every element and a real
 * "does it scroll" assertion would pass just as happily against the broken
 * markup it is here to catch.
 *
 * What they pin down is the structure the scrolling depends on — a card capped
 * at the viewport, and a body that is the flex child allowed to overflow. The
 * overlay behind is `fixed inset-0` with no scroll of its own (ui/dialog.tsx),
 * so without both halves a card taller than the screen overflows both edges and
 * the clipped content cannot be reached at all.
 */
describe('AppDialog scroll containment', () => {
  const body = <p>body content</p>;

  function card() {
    return screen.getByRole('dialog');
  }

  function scrollRegion() {
    return screen.getByText('body content').parentElement;
  }

  it('caps the card at the viewport and lets only the body grow', () => {
    render(
      <AppDialog open onOpenChange={vi.fn()} title="Tall">
        {body}
      </AppDialog>
    );

    expect(card().className).toContain('max-h-[calc(100dvh-2rem)]');
    expect(card().className).toContain('flex-col');
    expect(scrollRegion()?.className).toContain('overflow-y-auto');
    // Without `min-h-0` the body keeps its default `min-height: auto`, refuses
    // to shrink below its content, and the overflow above never engages.
    expect(scrollRegion()?.className).toContain('min-h-0');
  });

  it('keeps the body scrollable when the dialog wraps its content in a form', () => {
    // The form becomes the card's only flex child, so it has to carry the
    // column itself — otherwise the body's `flex-1` resolves against a plain
    // block and the dialog silently reverts to overflowing the viewport.
    render(
      <AppDialog open onOpenChange={vi.fn()} title="Submits" onSubmit={vi.fn()}>
        {body}
      </AppDialog>
    );

    const form = card().querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.className).toContain('flex-col');
    expect(form?.className).toContain('min-h-0');
    expect(form).toContainElement(screen.getByText('body content'));
  });

  it('lets a caller opt out of the cap, as the mobile full-bleed sheet does', () => {
    render(
      <AppDialog open onOpenChange={vi.fn()} title="Sheet" className="max-md:max-h-none">
        {body}
      </AppDialog>
    );

    expect(card().className).toContain('max-md:max-h-none');
  });
});
