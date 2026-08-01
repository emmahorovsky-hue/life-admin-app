// First-run onboarding wizard (LIF-220)
// Priority: P1 — covers the one flow that only runs on a genuinely empty
// account, which unit tests can only simulate.

import { test, expect, type Page } from '@playwright/test';

/**
 * Register a brand-new account and land on an empty dashboard. Every test needs
 * its own, because the wizard shows exactly once per account — reusing a user
 * would test the "already onboarded" path by accident.
 */
async function registerFreshUser(page: Page) {
  await page.goto('/register');
  const email = `onboarding${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  await page.fill('#email', email);
  await page.fill('#password', 'Password123!');
  await page.fill('#confirmPassword', 'Password123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard');
  return email;
}

const wizard = (page: Page) => page.getByRole('dialog');

test.describe('First-run onboarding', () => {
  test('a new account is met by the wizard on step 1', async ({ page }) => {
    await registerFreshUser(page);

    await expect(wizard(page)).toBeVisible();
    await expect(page.getByText('Set up · Step 1 of 3')).toBeVisible();
    await expect(page.getByRole('button', { name: /Netflix/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('picking services files them and populates the dashboard', async ({ page }) => {
    await registerFreshUser(page);

    await page.getByRole('button', { name: /Netflix/ }).click();
    await page.getByRole('button', { name: /Spotify/ }).click();
    await page.getByRole('button', { name: /Next — check amounts/ }).click();

    // Step 2 carries the picks over with their standard-plan prices.
    await expect(page.getByText('Check the amounts')).toBeVisible();
    await expect(page.getByLabel('Netflix monthly cost')).toHaveValue('15.99');

    await page.getByRole('button', { name: 'File 2' }).click();

    // Step 3 confirms, then hands back to a dashboard with real data behind it.
    await expect(page.getByText('2 subscriptions filed')).toBeVisible();
    await page.getByRole('button', { name: 'Go to dashboard' }).click();

    await expect(wizard(page)).not.toBeVisible();
    await expect(page.getByText('2 active subscriptions')).toBeVisible();
    // The renewals sheet is fed by the server, not by wizard state.
    await expect(page.getByText('Netflix')).toBeVisible();
    await expect(page.getByText('Spotify')).toBeVisible();

    // And it stays gone — the account is no longer empty.
    await page.reload();
    await expect(wizard(page)).not.toBeVisible();
  });

  test('skipping leaves a usable dashboard and a resume card that survives reload', async ({
    page,
  }) => {
    await registerFreshUser(page);

    await page.getByRole('button', { name: /Netflix/ }).click();
    await page.getByRole('button', { name: /Skip setup/ }).click();

    await expect(wizard(page)).not.toBeVisible();
    await expect(page.getByText('Finish setting up your file')).toBeVisible();
    // Nothing is blocked by having skipped.
    await expect(page.getByText(/Welcome back/)).toBeVisible();

    await page.reload();
    await expect(page.getByText('Finish setting up your file')).toBeVisible();
    await expect(wizard(page)).not.toBeVisible();
  });

  test('resume reopens the wizard with the earlier picks intact', async ({ page }) => {
    await registerFreshUser(page);

    await page.getByRole('button', { name: /Netflix/ }).click();
    await page.getByRole('button', { name: /Next — check amounts/ }).click();
    await page.getByRole('button', { name: /Skip setup/ }).click();

    await expect(page.getByText('Step 2 of 3 · Not started')).toBeVisible();
    await page.getByRole('button', { name: 'Resume setup' }).click();

    await expect(page.getByText('Check the amounts')).toBeVisible();
    await expect(page.getByLabel('Netflix monthly cost')).toBeVisible();
  });

  test('Escape closes the wizard without blocking the dashboard', async ({ page }) => {
    await registerFreshUser(page);

    await expect(wizard(page)).toBeVisible();
    // AppDialog moves focus to its first control (the close button) and wires
    // its Escape listener in the same post-paint effect flush. The dialog is
    // painted — and so passes `toBeVisible` — a frame before that flush runs, so
    // pressing Escape off the visibility check alone can send the key into a
    // dead listener and leave the wizard open (flaky in the production-bundle CI
    // run). Waiting for focus to land inside the card proves the handler is
    // attached before the keypress.
    await expect(wizard(page).getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(wizard(page)).not.toBeVisible();
    await expect(page.getByText('Finish setting up your file')).toBeVisible();
  });

  test('goes full-screen on a phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await registerFreshUser(page);

    const card = wizard(page);
    await expect(card).toBeVisible();

    // The card fills the viewport rather than floating as a centred sheet.
    const box = await card.boundingBox();
    expect(box?.width).toBe(390);
    expect(box?.height).toBeGreaterThan(800);

    // The footer total is the mobile-only affordance; it should be present here.
    await page.getByRole('button', { name: /Netflix/ }).click();
    await expect(page.getByText(/1 item · per month/)).toBeVisible();
  });
});
