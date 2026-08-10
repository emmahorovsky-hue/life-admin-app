// iPhone Launch Page Tests
// Public marketing page at `/ios`, plus the entry points that reach it from `/`.

import { test, expect } from '@playwright/test';

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
