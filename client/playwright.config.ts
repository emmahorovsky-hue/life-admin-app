import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  // A backstop, not a fix: every test registers its own account, so a single
  // slow request used to fail the whole job with zero retries. The known cause
  // (a live Resend call inside registration) is fixed in emailService, but a
  // shared CI runner still has no latency guarantee. Kept at 0 locally so a
  // flake a developer introduces is visible immediately rather than retried away.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    ignoreHTTPSErrors: true,
  },
  webServer: {
    // Serve the real production bundle rather than the dev server, so e2e
    // exercises what actually ships (minification, build-time env inlining).
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    // Generous: this now includes a full production build, not just a boot.
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
