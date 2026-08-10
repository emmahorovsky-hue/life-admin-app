// iPhone Launch Page Tests
// Public marketing page at `/ios`, plus the entry points that reach it from `/`.

import { test, expect, type Page } from '@playwright/test';
import { phoneFamilyFor } from '../src/lib/phoneAssets';

const CARD_PAIRS = [
  ['Snap any receipt', 'A nudge before it charges'],
  ['Tap into any charge', 'Tune every reminder'],
];

/**
 * Bring the page to a stable layout before measuring: pull in the lazy images,
 * wait for the webfonts, and wait for every image to decode.
 *
 * The fonts matter more than they look. Archivo arrives from Google Fonts, and
 * the card bodies are 2–3 lines of 15px/1.55 text — so a font landing midway
 * through a test rewraps the copy and moves a card's height by exactly one line
 * (23.25px). Measuring two cards in two separate calls straddled that reflow
 * and failed about one run in three.
 */
async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
    await Promise.all(
      [...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {}))
    );
  });
}

/**
 * Card and device geometry for one pair, read in a single evaluate so no
 * reflow can land between the two measurements.
 *
 * The `<img>` box includes the asset's transparent margin, which differs per
 * family — so the box is not the phone, and comparing boxes is exactly the
 * mistake these tests guard against. The crop fractions come from
 * lib/phoneAssets, the same source the page sizes from.
 */
/**
 * Read until the geometry stops moving. The scroll sweep in `settleLayout`
 * triggers the reveals on its way past, and a card measured mid-flight sits a
 * few px off its resting position — enough to fail a baseline comparison that
 * is otherwise exact. Polling for a stable read is agnostic to how the
 * animation is driven (WAAPI, rAF, CSS), which guessing at
 * `document.getAnimations()` would not be.
 */
async function stableRead<T>(page: Page, read: () => Promise<T>): Promise<T> {
  let previous = '';
  for (let attempt = 0; attempt < 40; attempt++) {
    const value = await read();
    const fingerprint = JSON.stringify(value);
    if (fingerprint === previous) return value;
    previous = fingerprint;
    await page.waitForTimeout(50);
  }
  throw new Error('layout never settled');
}

async function pairMetrics(page: Page, left: string, right: string) {
  await settleLayout(page);

  const raw = await stableRead(page, () =>
    page.evaluate(
    ([l, r]) => {
      const read = (heading: string) => {
        const h = [...document.querySelectorAll('h3')].find(
          (el) => el.textContent?.trim() === heading
        );
        if (!h) throw new Error(`no card found for "${heading}"`);
        const card = h.parentElement!.getBoundingClientRect();
        const imgEl = h.parentElement!.querySelector('img')!;
        const img = imgEl.getBoundingClientRect();
        return {
          src: imgEl.getAttribute('src') ?? '',
          cardHeight: card.height,
          cardBottom: card.bottom,
          imgHeight: img.height,
          imgBottom: img.bottom,
        };
      };
      return { left: read(l), right: read(r) };
    },
    [left, right]
    )
  );

  const derive = (m: (typeof raw)['left']) => {
    const family = phoneFamilyFor(m.src);
    const deviceBottom = m.imgBottom - m.imgHeight * family.padBottomFrac;
    return {
      cardHeight: m.cardHeight,
      cardBottom: m.cardBottom,
      deviceHeight: m.imgHeight * family.deviceHeightFrac,
      deviceBottom,
      /** Clearance between the bottom of the phone and the card's bottom edge. */
      gapBelow: m.cardBottom - deviceBottom,
    };
  };

  return { left: derive(raw.left), right: derive(raw.right) };
}

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

  // Same APP_STORE_URL switch as the badge: until it is set the QR is ghosted
  // behind a stamp, because scanning it can only lead back to this page.
  test('the QR is stamped rather than offered as a scan', async ({ page }) => {
    await page.goto('/ios');

    const qr = page.locator('img[src*="qr"]').first();
    // Decorative while unreleased — not announced to a screen reader as a
    // working link, and visibly knocked back behind the overprint.
    await expect(qr).toHaveAttribute('alt', '');
    await expect(qr).toHaveCSS('opacity', '0.16');
    await expect(page.getByText('Scan at')).toHaveCount(2); // hero + closing CTA
  });

  // Layout assertions only, so motion is off: boundingBox() scrolls its target
  // into view, which is what triggers the scroll reveals, and the two items in
  // a pair reveal on different delays.
  //
  // Caveat on the phone assertions: they read the same crop fractions the page
  // sizes from, so they cannot tell you those fractions are right — only that
  // the layout honours them. If an asset is re-exported with a different crop,
  // re-measure it (alpha channel, solid pixels only) rather than trusting a
  // green run here.
  test.describe('layout', () => {
    test.use({ reducedMotion: 'reduce' });

    // Each card is wrapped in a motion div for its scroll reveal, so the grid
    // stretches the wrapper while the card inside sizes to its own copy — which
    // left the two cards in a pair visibly different heights.
    test('cards paired in a row are the same height', async ({ page }) => {
      await page.goto('/ios');

      for (const [left, right] of CARD_PAIRS) {
        const { left: a, right: b } = await pairMetrics(page, left, right);

        // Sub-pixel rounding only; anything more is the stretch being lost.
        expect(Math.abs(a.cardHeight - b.cardHeight), `"${left}" vs "${right}"`).toBeLessThan(2);
        expect(Math.abs(a.cardBottom - b.cardBottom), 'card bottom edges').toBeLessThan(2);
      }
    });

    // The two asset crops put the device at very different scales inside the
    // same canvas, so sizing or aligning by the <img> box renders the same
    // phone ~23% larger in one family and drops the two onto different
    // baselines.
    test('phones paired in a row are one size on one baseline', async ({ page }) => {
      await page.goto('/ios');

      for (const [left, right] of CARD_PAIRS) {
        const { left: a, right: b } = await pairMetrics(page, left, right);

        expect(
          Math.abs(a.deviceHeight - b.deviceHeight),
          `"${left}" vs "${right}" device height`
        ).toBeLessThan(2);
        expect(Math.abs(a.deviceBottom - b.deviceBottom), 'device baselines').toBeLessThan(2);
      }
    });

    // The prototype bled the phones 8px past the card edge. They now stand on
    // the card's bottom inset instead — and because PhoneShot's box is the
    // device, that clearance is the same under either asset family rather than
    // being eaten by one crop's transparent margin.
    test('phones clear the bottom edge of their card', async ({ page }) => {
      await page.goto('/ios');

      const gaps: number[] = [];
      for (const [left, right] of CARD_PAIRS) {
        const { left: a, right: b } = await pairMetrics(page, left, right);
        for (const [heading, m] of [
          [left, a],
          [right, b],
        ] as const) {
          expect(m.gapBelow, `clearance under "${heading}"`).toBeGreaterThan(16);
          gaps.push(m.gapBelow);
        }
      }

      // And it is the same clearance in every card, not merely non-zero.
      expect(Math.max(...gaps) - Math.min(...gaps), 'clearance varies by card').toBeLessThan(2);
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
