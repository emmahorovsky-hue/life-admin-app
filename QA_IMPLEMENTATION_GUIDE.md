# QA Implementation Guide - Quick Start

This is your **action plan** to implement the QA strategy. Follow this day-by-day.

---

## Day 5: Backend Testing Setup

### 1. Install Testing Dependencies

```bash
cd server
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

### 2. Add Jest Configuration

Create `server/jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
};
```

### 3. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "jest --runInBand",
    "test:watch": "jest --watch --runInBand",
    "test:coverage": "jest --coverage --runInBand"
  }
}
```

### 4. Setup Test Database

In `server/.env.test`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lifeadmin_test"
JWT_SECRET="test-secret-key"
NODE_ENV="test"
```

### 5. Create Test Database

```bash
createdb lifeadmin_test
cd server
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lifeadmin_test" npx prisma migrate deploy
```

### 6. Run Your First Test

```bash
cd server
npm test __tests__/auth.test.ts
```

**Expected:** All auth tests pass ✅

---

## Day 6: Subscription Tests

### 1. Create Subscription Test File

Create `server/__tests__/subscriptions.test.ts`:

```typescript
import { createAuthenticatedUser, authenticatedRequest, createTestSubscription } from './utils/testHelpers';

describe('POST /api/subscriptions', () => {
  let user1, user2;

  beforeEach(async () => {
    user1 = await createAuthenticatedUser('user1@example.com');
    user2 = await createAuthenticatedUser('user2@example.com');
  });

  it('should create subscription with valid data', async () => {
    const res = await authenticatedRequest(user1.token)
      .post('/api/subscriptions')
      .send({
        name: 'Netflix',
        cost: 19.99,
        currency: 'USD',
        billingCycle: 'monthly',
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'Streaming',
        notes: 'Premium plan',
      });

    expect(res.status).toBe(201);
    expect(res.body.subscription.name).toBe('Netflix');
    expect(res.body.subscription.cost).toBe('19.99'); // Decimal as string
  });

  it('should fail without authentication', async () => {
    const res = await request(app).post('/api/subscriptions').send({
      name: 'Netflix',
      cost: 19.99,
      billingCycle: 'monthly',
    });

    expect(res.status).toBe(401);
  });

  it('should validate required fields', async () => {
    const res = await authenticatedRequest(user1.token)
      .post('/api/subscriptions')
      .send({
        // Missing required fields
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

describe('GET /api/subscriptions', () => {
  it('should list only user\'s subscriptions', async () => {
    const user1 = await createAuthenticatedUser('user1@example.com');
    const user2 = await createAuthenticatedUser('user2@example.com');

    // Create subscriptions for both users
    await createTestSubscription(user1.token, { name: 'User 1 Sub' });
    await createTestSubscription(user2.token, { name: 'User 2 Sub' });

    // User 1 should only see their subscription
    const res = await authenticatedRequest(user1.token).get('/api/subscriptions');

    expect(res.status).toBe(200);
    expect(res.body.subscriptions).toHaveLength(1);
    expect(res.body.subscriptions[0].name).toBe('User 1 Sub');
  });

  it('should filter by category', async () => {
    const user = await createAuthenticatedUser();

    await createTestSubscription(user.token, { name: 'Netflix', category: 'Streaming' });
    await createTestSubscription(user.token, { name: 'Spotify', category: 'Music' });

    const res = await authenticatedRequest(user.token)
      .get('/api/subscriptions?category=Streaming');

    expect(res.status).toBe(200);
    expect(res.body.subscriptions).toHaveLength(1);
    expect(res.body.subscriptions[0].name).toBe('Netflix');
  });

  it('should sort by renewalDate', async () => {
    const user = await createAuthenticatedUser();

    await createTestSubscription(user.token, { name: 'Sub 1', renewalDate: futureDate(10) });
    await createTestSubscription(user.token, { name: 'Sub 2', renewalDate: futureDate(5) });
    await createTestSubscription(user.token, { name: 'Sub 3', renewalDate: futureDate(15) });

    const res = await authenticatedRequest(user.token)
      .get('/api/subscriptions?sortBy=renewalDate&sortOrder=asc');

    expect(res.status).toBe(200);
    expect(res.body.subscriptions[0].name).toBe('Sub 2'); // 5 days
    expect(res.body.subscriptions[1].name).toBe('Sub 1'); // 10 days
    expect(res.body.subscriptions[2].name).toBe('Sub 3'); // 15 days
  });
});

describe('PATCH /api/subscriptions/:id', () => {
  it('should update subscription', async () => {
    const user = await createAuthenticatedUser();
    const sub = await createTestSubscription(user.token, { name: 'Netflix', cost: 9.99 });

    const res = await authenticatedRequest(user.token)
      .patch(`/api/subscriptions/${sub.id}`)
      .send({ cost: 19.99 });

    expect(res.status).toBe(200);
    expect(res.body.subscription.cost).toBe('19.99');
  });

  it('should not allow updating other user\'s subscription', async () => {
    const user1 = await createAuthenticatedUser('user1@example.com');
    const user2 = await createAuthenticatedUser('user2@example.com');

    const sub = await createTestSubscription(user1.token);

    const res = await authenticatedRequest(user2.token)
      .patch(`/api/subscriptions/${sub.id}`)
      .send({ cost: 99.99 });

    expect(res.status).toBe(404); // Or 403 Forbidden
  });
});

describe('DELETE /api/subscriptions/:id', () => {
  it('should soft delete subscription', async () => {
    const user = await createAuthenticatedUser();
    const sub = await createTestSubscription(user.token);

    const res = await authenticatedRequest(user.token)
      .delete(`/api/subscriptions/${sub.id}`);

    expect(res.status).toBe(200);

    // Verify it's not in list
    const listRes = await authenticatedRequest(user.token).get('/api/subscriptions');
    expect(listRes.body.subscriptions).toHaveLength(0);
  });
});
```

### 2. Run Tests

```bash
npm test __tests__/subscriptions.test.ts
```

---

## Day 7: Dashboard Tests

Create `server/__tests__/dashboard.test.ts`:

```typescript
import { createAuthenticatedUser, authenticatedRequest, createTestSubscription, futureDate } from './utils/testHelpers';

describe('GET /api/dashboard/summary', () => {
  it('should calculate monthly and annual totals', async () => {
    const user = await createAuthenticatedUser();

    // Create subscriptions with different billing cycles
    await createTestSubscription(user.token, { cost: 10, billingCycle: 'monthly' });
    await createTestSubscription(user.token, { cost: 120, billingCycle: 'annual' });
    await createTestSubscription(user.token, { cost: 5, billingCycle: 'weekly' });

    const res = await authenticatedRequest(user.token).get('/api/dashboard/summary');

    expect(res.status).toBe(200);
    
    // Monthly: 10 + (120/12) + (5*4.33) = ~31.65
    // Annual: (10*12) + 120 + (5*52) = 500
    expect(parseFloat(res.body.summary.totalMonthly)).toBeCloseTo(31.65, 2);
    expect(parseFloat(res.body.summary.totalAnnual)).toBeCloseTo(500, 2);
    expect(res.body.summary.activeSubscriptions).toBe(3);
  });

  it('should show upcoming renewals', async () => {
    const user = await createAuthenticatedUser();

    await createTestSubscription(user.token, { name: 'Netflix', renewalDate: futureDate(5) });
    await createTestSubscription(user.token, { name: 'Spotify', renewalDate: futureDate(10) });

    const res = await authenticatedRequest(user.token).get('/api/dashboard/summary');

    expect(res.status).toBe(200);
    expect(res.body.summary.upcomingRenewals).toHaveLength(2);
    expect(res.body.summary.upcomingRenewals[0].name).toBe('Netflix'); // Earliest first
  });
});

describe('GET /api/dashboard/upcoming', () => {
  it('should only show renewals in next 30 days', async () => {
    const user = await createAuthenticatedUser();

    await createTestSubscription(user.token, { name: 'Soon', renewalDate: futureDate(10) });
    await createTestSubscription(user.token, { name: 'Later', renewalDate: futureDate(45) });

    const res = await authenticatedRequest(user.token).get('/api/dashboard/upcoming');

    expect(res.status).toBe(200);
    expect(res.body.upcoming).toHaveLength(1);
    expect(res.body.upcoming[0].name).toBe('Soon');
  });
});
```

---

## Day 8: Frontend Testing Setup

### 1. Install Playwright

```bash
cd client
npm install --save-dev @playwright/test
npx playwright install
```

### 2. Add Playwright Configuration

Create `client/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3. Add Test Script

In `client/package.json`:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed"
  }
}
```

### 4. Run Frontend Tests

Make sure backend is running:

```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend tests
cd client
npx playwright test e2e/auth.spec.ts
```

---

## Day 10: Manual QA Checklist

Print this checklist and go through it:

📋 **[QA_STRATEGY.md](./QA_STRATEGY.md#manual-qa-checklist)** - Section 4

**Time estimate:** 4 hours for Anna & Tomasz

---

## Day 13: CI/CD Setup

### 1. Create GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: lifeadmin_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: server/package-lock.json
          
      - name: Install dependencies
        working-directory: ./server
        run: npm ci
        
      - name: Generate Prisma Client
        working-directory: ./server
        run: npx prisma generate
        
      - name: Run migrations
        working-directory: ./server
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/lifeadmin_test
        run: npx prisma migrate deploy
        
      - name: Run tests
        working-directory: ./server
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/lifeadmin_test
          JWT_SECRET: test-secret
        run: npm test

  frontend-build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: client/package-lock.json
          
      - name: Install dependencies
        working-directory: ./client
        run: npm ci
        
      - name: Build
        working-directory: ./client
        run: npm run build
```

### 2. Commit and Push

```bash
git add .github/workflows/test.yml
git commit -m "feat: Add CI/CD pipeline"
git push origin main
```

### 3. Verify on GitHub

Go to your GitHub repo → Actions tab → See tests running

---

## Day 13: Error Tracking Setup

### 1. Create Sentry Account

- Go to [sentry.io](https://sentry.io)
- Sign up for free account
- Create new project: "Life Admin App"

### 2. Install Sentry

```bash
# Backend
cd server
npm install @sentry/node

# Frontend
cd client
npm install @sentry/react
```

### 3. Configure Backend

In `server/src/index.ts`:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
});

// ... express setup ...

// Sentry error handler (MUST be after all routes)
app.use(Sentry.Handlers.errorHandler());
```

### 4. Configure Frontend

In `client/src/main.tsx`:

```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 0.1,
});
```

### 5. Add Environment Variables

```bash
# server/.env
SENTRY_DSN="your_backend_dsn"

# client/.env
VITE_SENTRY_DSN="your_frontend_dsn"
```

### 6. Test Error Tracking

```typescript
// Throw test error
throw new Error('Test Sentry integration');
```

Check Sentry dashboard for the error.

---

## Day 14: Final Pre-Launch Checklist

Run this script:

```bash
./scripts/pre-deploy-check.sh
```

If all checks pass ✅, you're ready to deploy!

---

## Day 17: Production Deployment

### 1. Deploy Backend (Railway)

```bash
# Follow Railway deployment guide
railway up
```

### 2. Deploy Frontend (Vercel)

```bash
# Follow Vercel deployment guide
vercel --prod
```

### 3. Run Production Smoke Tests

```bash
export PROD_URL="https://your-app.vercel.app"
export BACKEND_URL="https://your-backend.railway.app"
./scripts/smoke-test-prod.sh
```

### 4. Monitor for 48 Hours

- Check Sentry for errors every 6 hours
- Check UptimeRobot status
- Watch for user feedback

---

## Quick Reference

### Run All Backend Tests

```bash
cd server
npm test
```

### Run Specific Test File

```bash
npm test __tests__/auth.test.ts
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Frontend Tests

```bash
cd client
npx playwright test
```

### Run Frontend Tests with UI

```bash
npx playwright test --ui
```

### Run Pre-Deployment Checks

```bash
./scripts/pre-deploy-check.sh
```

### Run Production Smoke Tests

```bash
PROD_URL="https://your-app.com" ./scripts/smoke-test-prod.sh
```

---

## Files Created

✅ `server/__tests__/setup.ts` - Test database configuration  
✅ `server/__tests__/auth.test.ts` - Auth endpoint tests  
✅ `server/__tests__/utils/testHelpers.ts` - Reusable test utilities  
✅ `client/e2e/auth.spec.ts` - Frontend auth flow tests  
✅ `scripts/pre-deploy-check.sh` - Pre-deployment verification  
✅ `scripts/smoke-test-prod.sh` - Production smoke tests  
✅ `QA_STRATEGY.md` - Complete QA strategy document  
✅ `QA_IMPLEMENTATION_GUIDE.md` - This file  

---

## Need Help?

- **Backend tests failing?** Check DATABASE_URL in `.env.test`
- **Frontend tests timing out?** Increase timeout in Playwright config
- **CI/CD not working?** Check GitHub Actions logs
- **Sentry not capturing errors?** Verify DSN is correct

---

## Success Criteria

Before launch, verify:

- [ ] All backend tests pass (`npm test`)
- [ ] All frontend tests pass (`npx playwright test`)
- [ ] CI/CD pipeline is green
- [ ] Manual QA checklist 100% complete
- [ ] Sentry is receiving test errors
- [ ] Pre-deployment script passes
- [ ] Production smoke tests pass after deployment

---

**Good luck! 🚀**
