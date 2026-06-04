// Landing Page Tests
// Public marketing page at `/` with auth-aware redirect

import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('logged-out visitor sees the landing page at /', async ({ page }) => {
    await page.goto('/');

    // Stays on root (no redirect) and renders the hero CTA
    await expect(page).toHaveURL('/');
    await expect(
      page.getByRole('link', { name: 'Get Started Free' }).first()
    ).toBeVisible();
  });

  test('"Get Started Free" links to register', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Get Started Free' }).first().click();
    await expect(page).toHaveURL('/register');
  });

  test('"Sign In" links to login', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Sign In' }).first().click();
    await expect(page).toHaveURL('/login');
  });

  test('logged-in visitor is redirected from / to dashboard', async ({ page }) => {
    // Register to establish an authenticated session
    const timestamp = Date.now();
    await page.goto('/register');
    await page.fill('#email', `landing${timestamp}@example.com`);
    await page.fill('#password', 'Password123!');
    await page.fill('#confirmPassword', 'Password123!');
    await page.fill('#name', 'Landing Test');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');

    // Visiting the landing page while authenticated redirects to dashboard
    await page.goto('/');
    await expect(page).toHaveURL('/dashboard');
  });
});
