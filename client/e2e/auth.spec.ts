// Authentication Flow Tests
// Priority: P0 - CRITICAL

import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  test('user can register with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Click register link
    await page.click('text=Register');
    await expect(page).toHaveURL('/register');

    // Fill registration form
    const timestamp = Date.now();
    await page.fill('input[name="email"]', `user${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'Test User');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Verify user is logged in
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 5000 });
  });

  test('registration fails with invalid email', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[name="email"]', 'notanemail');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'Test User');

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/invalid email/i')).toBeVisible({ timeout: 2000 });
    
    // Should stay on registration page
    await expect(page).toHaveURL('/register');
  });

  test('registration fails with short password', async ({ page }) => {
    await page.goto('/register');

    const timestamp = Date.now();
    await page.fill('input[name="email"]', `user${timestamp}@example.com`);
    await page.fill('input[name="password"]', '123');
    await page.fill('input[name="name"]', 'Test User');

    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/password.*8 characters/i')).toBeVisible({ timeout: 2000 });
  });

  test('registration fails with duplicate email', async ({ page, context }) => {
    const email = `duplicate${Date.now()}@example.com`;

    // First registration
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'User One');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Logout
    await page.click('button:has-text("Logout")');

    // Try to register again with same email
    await page.goto('/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password456');
    await page.fill('input[name="name"]', 'User Two');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=/already exists/i')).toBeVisible({ timeout: 2000 });
  });
});

test.describe('User Login', () => {
  const testEmail = `logintest${Date.now()}@example.com`;
  const testPassword = 'password123';

  // Setup: Create a test user before login tests
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/register');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="name"]', 'Login Test User');
    await page.click('button[type="submit"]');
    await page.close();
  });

  test('user can login with correct credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 5000 });
  });

  test('login fails with wrong password', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=/invalid.*credentials/i')).toBeVisible({ timeout: 2000 });
    
    // Should stay on login page
    await expect(page).toHaveURL('/login');
  });

  test('login fails with non-existent email', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=/invalid.*credentials/i')).toBeVisible({ timeout: 2000 });
  });
});

test.describe('Session Persistence', () => {
  test('user stays logged in after page refresh', async ({ page }) => {
    // Register and login
    const timestamp = Date.now();
    await page.goto('/register');
    await page.fill('input[name="email"]', `session${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'Session Test');
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
    await page.fill('input[name="email"]', `logout${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'Logout Test');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');

    // Logout
    await page.click('button:has-text("Logout")');

    // Should redirect to login
    await expect(page).toHaveURL('/login');

    // Try to access dashboard
    await page.goto('/dashboard');

    // Should be redirected back to login
    await expect(page).toHaveURL('/login');
  });
});
