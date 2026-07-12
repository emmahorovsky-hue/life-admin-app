// Authentication Flow Tests
// Priority: P0 - CRITICAL

import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('user can register with valid credentials', async ({ page }) => {
    await page.goto('/register');

    // Fill registration form
    const timestamp = Date.now();
    await page.fill('#email', `user${timestamp}@example.com`);
    await page.fill('#password', 'Password123!');
    await page.fill('#confirmPassword', 'Password123!');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Verify user is logged in
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 5000 });
  });

  test('registration fails with invalid email', async ({ page }) => {
    await page.goto('/register');

    await page.fill('#email', 'notanemail');
    await page.fill('#password', 'password123');
    await page.fill('#confirmPassword', 'password123');

    await page.click('button[type="submit"]');

    // Browser validation should reject the invalid email
    const isEmailValid = await page.$eval('#email', (input) => (input as HTMLInputElement).checkValidity());
    expect(isEmailValid).toBe(false);

    // Should stay on registration page
    await expect(page).toHaveURL('/register');
  });

  test('registration fails with short password', async ({ page }) => {
    await page.goto('/register');

    const timestamp = Date.now();
    await page.fill('#email', `user${timestamp}@example.com`);
    await page.fill('#password', '123');
    await page.fill('#confirmPassword', '123');

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible({ timeout: 2000 });
  });

  test('registration fails with duplicate email', async ({ page }) => {
    const email = `duplicate${Date.now()}@example.com`;

    // First registration
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', 'Password123!');
    await page.fill('#confirmPassword', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Logout
    // Icon-only button in the sidebar — matched by its accessible name.
    await page.click('button[aria-label="Log out"]');

    // Try to register again with same email
    await page.goto('/register');
    await page.fill('#email', email);
    await page.fill('#password', 'Password456!');
    await page.fill('#confirmPassword', 'Password456!');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=Email already registered')).toBeVisible({ timeout: 2000 });
  });
});

test.describe('User Login', () => {
  // Initialised in beforeAll so the timestamp is captured at test-run time,
  // not at module-load time (which would be shared across process re-uses).
  let testEmail: string;
  const testPassword = 'Password123!';

  // Setup: Create a test user before login tests
  test.beforeAll(async ({ browser }) => {
    testEmail = `logintest${Date.now()}@example.com`;
    const page = await browser.newPage();
    await page.goto('/register');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.fill('#confirmPassword', testPassword);
    await page.click('button[type="submit"]');
    // Confirm registration succeeded before closing, so any subsequent login
    // tests fail with a clear "expected /dashboard" message rather than a
    // confusing "invalid credentials" error.
    await expect(page).toHaveURL('/dashboard');
    await page.close();
  });

  test('user can login with correct credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 5000 });
  });

  test('login fails with wrong password', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', testEmail);
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=Invalid credentials')).toBeVisible({ timeout: 2000 });
    
    // Should stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('login fails with non-existent email', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=Invalid credentials')).toBeVisible({ timeout: 2000 });
  });
});

test.describe('Session Persistence', () => {
  test('user stays logged in after page refresh', async ({ page }) => {
    // Register and login
    const timestamp = Date.now();
    await page.goto('/register');
    await page.fill('#email', `session${timestamp}@example.com`);
    await page.fill('#password', 'Password123!');
    await page.fill('#confirmPassword', 'Password123!');
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');

    // Refresh page
    await page.reload();

    // Should still be on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('user is redirected to login when accessing protected route without auth', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Logout', () => {
  test('user can logout', async ({ page }) => {
    // Register and login
    const timestamp = Date.now();
    await page.goto('/register');
    await page.fill('#email', `logout${timestamp}@example.com`);
    await page.fill('#password', 'Password123!');
    await page.fill('#confirmPassword', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');

    // Logout
    // Icon-only button in the sidebar — matched by its accessible name.
    await page.click('button[aria-label="Log out"]');

    // Logout returns to the public landing page, not the login form.
    await expect(page).toHaveURL('/');

    // The session is really gone: the dashboard is no longer reachable.
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
