// Mobile-web layout: core actions must stay on screen at phone widths.
// Priority: P1
//
// The Oct 2026 UX audit found "+ Add" past the right edge of a 348px viewport
// (and after onboarding it is the only way to add a subscription), "Save changes"
// clipped in the edit sheet, the currency select rendering blank, and "Enter
// manually instead" clipped in the upload dialog. None of it shows up in the
// desktop-sized default viewport, so these tests pin the phone widths.

import { test, expect, type Locator, type Page } from '@playwright/test';

const PHONE_WIDTHS = [
  { width: 320, height: 700 },
  { width: 375, height: 812 },
];

// Not about onboarding: skip the first-run wizard so it doesn't cover the page.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'paypr.onboarding.v1',
      JSON.stringify({ status: 'done', step: 3, picks: [], created: [] }),
    );
  });
});

async function registerWithSubscription(page: Page) {
  await page.goto('/register');
  const email = `mobile${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  await page.fill('#email', email);
  await page.fill('#password', 'Password123!');
  await page.fill('#confirmPassword', 'Password123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');

  // page.request shares the browser context's auth cookie.
  const res = await page.request.post('/api/subscriptions', {
    data: {
      name: 'Netflix',
      cost: 22.98,
      currency: 'SGD',
      billingCycle: 'monthly',
      renewalDate: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      category: 'streaming',
    },
  });
  expect(res.ok()).toBe(true);
}

/** Fully visible and horizontally inside the viewport — not merely in the DOM. */
async function expectWithinViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const width = page.viewportSize()!.width;
  expect(box, 'element has a layout box').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}

for (const viewport of PHONE_WIDTHS) {
  test.describe(`Subscriptions at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('core actions stay on screen', async ({ page }) => {
      await registerWithSubscription(page);
      await page.goto('/subscriptions');

      // Toolbar
      const add = page.getByRole('button', { name: '+ Add' });
      await expectWithinViewport(page, add);
      await expectWithinViewport(page, page.getByLabel('Filter by category'));

      // Upload dialog footer
      await add.click();
      const manual = page.getByRole('button', { name: 'Enter manually instead' });
      await expectWithinViewport(page, manual);
      await expectWithinViewport(page, page.getByRole('button', { name: 'Extract' }));
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();

      // Edit sheet: Save, the currency select (and that it shows its value),
      // and the secondary actions.
      await page.getByRole('button', { name: 'Edit Netflix' }).click();
      await expectWithinViewport(page, page.getByRole('button', { name: 'Save changes' }));
      await expectWithinViewport(page, page.getByRole('button', { name: 'Mark as cancelled' }));
      await expectWithinViewport(page, page.getByRole('button', { name: 'Delete', exact: true }));

      const currency = page.getByLabel('Currency');
      await expectWithinViewport(page, currency);
      await expect(currency).toHaveValue('SGD');
      // A select narrower than its own padding renders its value blank.
      const currencyBox = await currency.boundingBox();
      expect(currencyBox!.width).toBeGreaterThanOrEqual(96);
    });
  });
}
