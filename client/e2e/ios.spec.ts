// iPhone Launch Page Tests
// Public marketing page at `/ios`, plus the entry points that reach it from `/`.

import { test, expect, type Page } from '@playwright/test';
import { phoneFamilyFor } from '../src/lib/phoneAssets';

/**
 * Device edges for a rendered screenshot. The `<img>` box includes the asset's
 * transparent margin, which differs per family — so the box is not the phone,
 * and comparing boxes is exactly the mistake this guards against.
 */
async function deviceMetrics(page: Page, heading: string) {
  const img = page.getByRole('heading', { name: heading }).locator('..').locator('img');
  const src = (await img.getAttribute('src')) ?? '';
  const box = await img.boundingBox();
  if (!box) throw new Error(`no screenshot found under "${heading}"`);
  const family = phoneFamilyFor(src);
  return {
    height: box.height * family.deviceHeightFrac,
    bottom: box.y + box.height - box.height * family.padBottomFrac,
  };
}

const CARD_PAIRS = [
  ['Snap any receipt', 'A nudge before it charges'],
  ['Tap into any charge', 'Tune every reminder'],
];

test.describe('iPhone launch page', () => {
  test('logged-out visitor sees the page at /ios', async ({ page }) => {
    await page.goto('/ios');

    await expect(page).toHaveURL('/ios');
    await expect(
      page.getByRole('heading', { level: 1, name: /the pocket companion to your paper trail/i })
    ).toBeVisible();
  });

  test('"Start on the web" links to register', async ({ page }) => {
    await page.goto('/ios');

    await page.getByRole('link', { name: 'Start on the web' }).click();
    await expect(page).toHaveURL('/register');
  });

  // The badge announces availability rather than offering a download until
  // APP_STORE_URL is set, so it must not be a link.
  test('the App Store badge is inert while the app is unreleased', async ({ page }) => {
    await page.goto('/ios');

    await expect(page.getByText('COMING SOON').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /app store/i })).toHaveCount(0);
  });

  // Layout assertions only. `boundingBox()` scrolls its target into view, which
  // is what triggers the scroll reveals — and the two items in a pair reveal on
  // different delays, so measuring without this reads two mid-flight positions
  // and compares animation timing rather than layout. Under reduced motion the
  // reveals render at their settled position from the start.
  test.describe('layout', () => {
    test.use({ reducedMotion: 'reduce' });

    // Each card is wrapped in a motion div for its scroll reveal, so the grid
    // stretches the wrapper while the card inside sizes to its own copy — which
    // left the two cards in a pair visibly different heights. Only a real
    // layout engine catches this, so it lives in e2e rather than jsdom.
    test('cards paired in a row are the same height', async ({ page }) => {
      await page.goto('/ios');

      for (const [left, right] of CARD_PAIRS) {
        // The card is the h3's parent.
        const a = await page.getByRole('heading', { name: left }).locator('..').boundingBox();
        const b = await page.getByRole('heading', { name: right }).locator('..').boundingBox();
        if (!a || !b) throw new Error(`card pair "${left}" / "${right}" did not render`);

        // Sub-pixel rounding only; anything more is the stretch being lost.
        expect(Math.abs(a.height - b.height), `"${left}" vs "${right}" height`).toBeLessThan(2);
        expect(Math.abs(a.y + a.height - (b.y + b.height)), 'bottom edges').toBeLessThan(2);
      }
    });

    // The two asset crops put the device at very different scales inside the
    // same canvas, so sizing or aligning by the <img> box renders the same
    // phone ~23% larger in one family and drops the two onto different
    // baselines.
    //
    // Caveat: this reads the same crop fractions the page sizes from, so it
    // cannot tell you those fractions are right — only that the layout honours
    // them. If an asset is re-exported with a different crop, re-measure it
    // (alpha channel, solid pixels only) rather than trusting a green run here.
    test('phones paired in a row are one size on one baseline', async ({ page }) => {
      await page.goto('/ios');

      for (const [left, right] of CARD_PAIRS) {
        const a = await deviceMetrics(page, left);
        const b = await deviceMetrics(page, right);

        expect(
          Math.abs(a.height - b.height),
          `"${left}" vs "${right}" device height`
        ).toBeLessThan(2);
        expect(Math.abs(a.bottom - b.bottom), 'device baselines').toBeLessThan(2);
      }
    });
  });

  test('the hero announcement pill on / leads here', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /New Paypr for iPhone/i }).click();
    await expect(page).toHaveURL('/ios');
  });

  test('the nav link on / leads here', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'iPhone app' }).click();
    await expect(page).toHaveURL('/ios');
  });

  test('the landing section CTA leads here', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /See Paypr for iPhone/i }).click();
    await expect(page).toHaveURL('/ios');
  });
});
