# QA Strategy - Life Admin App MVP

**Target:** Ship production-ready MVP in 2-3 weeks  
**Team:** Small AI agent team + Anna & Tomasz review  
**Philosophy:** Pragmatic quality - catch critical bugs without slowing development  

---

## Executive Summary

### Testing Priority Matrix

| Priority | Testing Type | Coverage | Implementation Time | Who |
|----------|-------------|----------|---------------------|-----|
| **P0 - CRITICAL** | Manual QA checklist | 100% of critical flows | 1 day | Anna & Tomasz |
| **P0 - CRITICAL** | Backend API integration tests | Auth + CRUD endpoints | 2 days | AI agents |
| **P1 - HIGH** | Frontend user flow tests | Login → Add subscription → Dashboard | 2 days | AI agents |
| **P2 - MEDIUM** | Unit tests (backend utilities) | Core business logic | 1 day | AI agents |
| **P2 - MEDIUM** | Automated smoke tests (CI) | Health checks + critical endpoints | 1 day | AI agents |
| **P3 - NICE TO HAVE** | E2E tests (full stack) | Happy paths only | 2 days | Post-MVP |
| **P3 - NICE TO HAVE** | Component tests (UI) | Reusable components | 1 day | Post-MVP |

**Total QA Time Investment:** 7 days (35% of 2-3 week timeline)

---

## 1. Testing Approach for MVP

### What We WILL Do (Essential)

✅ **Backend API Integration Tests**
- Test all auth endpoints (register, login, logout)
- Test subscription CRUD operations
- Test dashboard endpoints
- Test authorization (can't access other users' data)
- Test input validation and error handling

✅ **Manual QA Checklist**
- Critical user flows (login, add subscription, view dashboard)
- Cross-browser testing (Chrome, Safari, Firefox on desktop)
- Mobile responsive testing (iOS Safari, Android Chrome)
- Auth flow edge cases
- Error state verification

✅ **Automated Smoke Tests**
- Pre-deployment health checks
- Critical API endpoint availability
- Database connectivity
- Frontend build verification

### What We WON'T Do (Nice-to-Have, Post-MVP)

❌ **Comprehensive Unit Tests** (only test complex business logic)
❌ **Full E2E Test Suite** (only critical path)
❌ **Load/Performance Testing** (MVP won't have load issues)
❌ **Visual Regression Testing** (UI is simple)
❌ **Accessibility Testing** (important but not MVP blocker)

### Balance Strategy

**Speed vs. Quality Trade-offs:**
- Write tests **as we code** (not separate QA phase)
- Focus on **high-risk areas** (auth, money calculations)
- **Manual test first**, automate if we have time
- Accept **80% coverage** as good enough for MVP
- Ship with **known minor bugs** if they're documented

---

## 2. Backend Testing

### Priority 1: API Integration Tests (CRITICAL)

**Tool:** Jest + Supertest  
**Coverage Target:** 80% of endpoints  
**Time:** 2 days

#### Setup

```bash
cd server
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

**`server/jest.config.js`:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};
```

**`server/package.json` scripts:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

#### Test Structure

```
server/
└── __tests__/
    ├── setup.ts                  # Test database setup
    ├── auth.test.ts              # Auth endpoints
    ├── subscriptions.test.ts     # Subscription CRUD
    ├── dashboard.test.ts         # Dashboard endpoints
    └── utils/
        └── testHelpers.ts        # Shared test utilities
```

#### What to Test

**`auth.test.ts` (P0 - CRITICAL):**
- ✅ User registration with valid data
- ✅ Registration with duplicate email fails
- ✅ Login with correct credentials
- ✅ Login with wrong password fails
- ✅ JWT cookie is set on login
- ✅ Logout clears cookie
- ✅ `/api/auth/me` returns user when authenticated
- ✅ `/api/auth/me` returns 401 when not authenticated
- ✅ Rate limiting blocks after 5 failed login attempts

**`subscriptions.test.ts` (P0 - CRITICAL):**
- ✅ Create subscription with valid data
- ✅ Create subscription fails without auth
- ✅ Create subscription validates required fields
- ✅ List subscriptions (empty and with data)
- ✅ Filter subscriptions by category
- ✅ Sort subscriptions by renewalDate
- ✅ Get single subscription by ID
- ✅ Get subscription fails for wrong user (authorization)
- ✅ Update subscription (partial update)
- ✅ Delete subscription (soft delete)
- ✅ Cannot access deleted subscriptions

**`dashboard.test.ts` (P1 - HIGH):**
- ✅ Get summary returns correct monthly/annual totals
- ✅ Cost normalization works (weekly → monthly)
- ✅ Active subscription count is correct
- ✅ Upcoming renewals sorted by date
- ✅ Only shows renewals in next 30 days

#### Example Test

```typescript
// server/__tests__/auth.test.ts
import request from 'supertest';
import app from '../src/index';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Setup test database
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.password).toBeUndefined(); // No password in response
  });

  it('should fail with duplicate email', async () => {
    // First registration
    await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: 'password123',
      name: 'User One',
    });

    // Duplicate registration
    const res = await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: 'password123',
      name: 'User Two',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already exists');
  });
});
```

### Priority 2: Unit Tests for Business Logic (MEDIUM)

**Focus on:**
- ✅ JWT generation/verification (`src/utils/jwt.ts`)
- ✅ Cost normalization logic (if extracted to utility)
- ✅ Date calculation functions

**Skip:**
- ❌ Controllers (covered by integration tests)
- ❌ Simple route handlers
- ❌ Prisma queries (trust the ORM)

### Priority 3: Database Integrity Tests (MEDIUM)

**Test:**
- ✅ Foreign key constraints (cascade delete works)
- ✅ Unique constraints (duplicate email blocked)
- ✅ Decimal precision (no rounding errors with money)

---

## 3. Frontend Testing

### Priority 1: User Flow Tests (HIGH)

**Tool:** Playwright (better than Cypress for this use case)  
**Coverage:** Critical paths only  
**Time:** 2 days

#### Setup

```bash
cd client
npm install --save-dev @playwright/test
npx playwright install
```

**`client/playwright.config.ts`:**
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
});
```

#### Test Structure

```
client/
└── e2e/
    ├── auth.spec.ts              # Login/register flows
    ├── subscriptions.spec.ts     # CRUD operations
    └── dashboard.spec.ts         # Dashboard views
```

#### What to Test

**`auth.spec.ts` (P0 - CRITICAL):**
- ✅ User can register new account
- ✅ User can login with correct credentials
- ✅ User cannot login with wrong password
- ✅ User stays logged in after page refresh
- ✅ User can logout

**`subscriptions.spec.ts` (P0 - CRITICAL):**
- ✅ User can add new subscription
- ✅ Subscription appears in list
- ✅ User can edit subscription
- ✅ User can delete subscription
- ✅ Filter by category works
- ✅ Sort by date works

**`dashboard.spec.ts` (P1 - HIGH):**
- ✅ Dashboard shows correct monthly total
- ✅ Upcoming renewals appear in next 30 days
- ✅ Dashboard updates after adding subscription

#### Example Test

```typescript
// client/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('user can register and login', async ({ page }) => {
    await page.goto('/');

    // Register
    await page.click('text=Register');
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'New User');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('user cannot login with wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });
});
```

### Priority 2: Component Tests (NICE-TO-HAVE, Post-MVP)

**Tool:** Vitest + React Testing Library  
**Coverage:** Reusable components only  

**Test if we have time:**
- AddSubscriptionDialog
- EditSubscriptionDialog
- SubscriptionCard

**Skip for MVP:**
- UI components (buttons, inputs - trust shadcn/ui)
- Layout components
- Simple presentational components

---

## 4. Manual QA Checklist

### Pre-Launch Checklist (Anna & Tomasz)

**Time:** 1 day (final review before launch)

#### Authentication Flow

- [ ] Register new account with valid email
- [ ] Register fails with invalid email format
- [ ] Register fails with short password (<8 chars)
- [ ] Login with correct credentials
- [ ] Login fails with wrong password
- [ ] Login fails with non-existent email
- [ ] Session persists after page refresh
- [ ] Logout clears session
- [ ] Cannot access protected routes when logged out

#### Subscription Management

- [ ] Add new subscription (monthly)
- [ ] Add new subscription (annual)
- [ ] Add new subscription (weekly)
- [ ] Add new subscription (quarterly)
- [ ] Edit subscription name
- [ ] Edit subscription cost
- [ ] Edit subscription renewal date
- [ ] Delete subscription
- [ ] Deleted subscription doesn't appear in list
- [ ] Cannot add subscription with negative cost
- [ ] Cannot add subscription with empty name

#### Dashboard

- [ ] Dashboard shows correct monthly total
- [ ] Dashboard shows correct annual total
- [ ] Active subscription count is correct
- [ ] Upcoming renewals show in next 30 days
- [ ] Renewals sorted by date (earliest first)
- [ ] Dashboard updates after adding subscription
- [ ] Dashboard updates after editing subscription
- [ ] Dashboard updates after deleting subscription

#### Filtering & Sorting

- [ ] Filter by category works (select each category)
- [ ] "All Categories" shows all subscriptions
- [ ] Sort by renewal date (ascending)
- [ ] Sort by renewal date (descending)
- [ ] Sort by cost (ascending)
- [ ] Sort by cost (descending)
- [ ] Sort by name (alphabetical)

#### UI/UX

- [ ] All forms have clear labels
- [ ] Error messages are clear and helpful
- [ ] Success messages appear after actions
- [ ] Loading states show during API calls
- [ ] Buttons are clearly clickable
- [ ] Forms are easy to fill out
- [ ] No console errors in browser
- [ ] No visual glitches

#### Mobile Responsive (iPhone & Android)

- [ ] Login page looks good on mobile
- [ ] Register page looks good on mobile
- [ ] Dashboard is readable on mobile
- [ ] Subscription list scrolls properly
- [ ] Add subscription form works on mobile
- [ ] Edit dialog works on mobile
- [ ] Navigation works on mobile

#### Browser Testing

**Test on:**
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] iOS Safari (iPhone)
- [ ] Android Chrome

#### Security

- [ ] Cannot access other users' subscriptions
- [ ] Cannot edit other users' subscriptions
- [ ] Cannot delete other users' subscriptions
- [ ] JWT token is httpOnly cookie (check DevTools)
- [ ] Password is not visible in network requests
- [ ] Password is not returned in API responses

#### Edge Cases

- [ ] What happens with 0 subscriptions?
- [ ] What happens with 100+ subscriptions?
- [ ] What happens with very long subscription names?
- [ ] What happens with very large costs ($999,999)?
- [ ] What happens with future renewal dates?
- [ ] What happens with past renewal dates?

---

## 5. Automation Strategy

### CI/CD Pipeline (GitHub Actions)

**Priority:** P2 - MEDIUM  
**Time:** 1 day  
**Trigger:** On every push to main, every PR

#### Setup

**`.github/workflows/test.yml`:**

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
          
      - name: Install backend dependencies
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
        
      - name: Run backend tests
        working-directory: ./server
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/lifeadmin_test
          JWT_SECRET: test-secret
        run: npm test

  frontend-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install frontend dependencies
        working-directory: ./client
        run: npm ci
        
      - name: Run frontend build
        working-directory: ./client
        run: npm run build
        
      - name: Run Playwright tests
        working-directory: ./client
        run: npx playwright test
        
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: client/playwright-report/
```

### Pre-Deployment Smoke Tests

**Run before every deployment:**

```bash
#!/bin/bash
# scripts/pre-deploy-check.sh

echo "🧪 Running pre-deployment checks..."

# 1. Health check
curl -f http://localhost:3001/health || exit 1

# 2. Critical API endpoints
curl -f http://localhost:3001/api/categories || exit 1

# 3. Frontend builds
cd client && npm run build || exit 1

# 4. Backend tests pass
cd ../server && npm test || exit 1

echo "✅ All pre-deployment checks passed!"
```

### Automated Smoke Tests (Post-Deployment)

**Test in production after deployment:**

```bash
#!/bin/bash
# scripts/smoke-test-prod.sh

PROD_URL="https://lifeadmin.yourapp.com"

echo "🔥 Running production smoke tests..."

# 1. Health check
curl -f $PROD_URL/health || exit 1

# 2. API is accessible
curl -f $PROD_URL/api/categories || exit 1

# 3. Frontend loads
curl -f $PROD_URL || exit 1

# 4. Register endpoint is up
curl -X POST $PROD_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo "✅ Production smoke tests passed!"
```

---

## 6. Bug Tracking & Management

### Where to Track Bugs

**Recommendation:** GitHub Issues (simple, integrated)

**Alternative:** Linear (if you want more features)

### Severity Levels

| Severity | Definition | Example | Response Time |
|----------|-----------|---------|---------------|
| **P0 - CRITICAL** | Blocks launch, data loss, security issue | Cannot login, subscriptions deleted | Fix immediately |
| **P1 - HIGH** | Major feature broken, affects most users | Dashboard shows wrong totals | Fix before launch |
| **P2 - MEDIUM** | Minor feature broken, affects some users | Sort by name doesn't work | Fix in MVP if time allows |
| **P3 - LOW** | Cosmetic issue, minor UX problem | Button color off-brand | Post-MVP |

### Issue Template

**`.github/ISSUE_TEMPLATE/bug_report.md`:**

```markdown
---
name: Bug Report
about: Report a bug
title: '[BUG] '
labels: bug
---

## Bug Description
Clear description of what's wrong.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Screenshots
If applicable, add screenshots.

## Environment
- Browser: [e.g. Chrome 120]
- OS: [e.g. macOS, Windows, iOS]
- User: [e.g. test@example.com or new user]

## Severity
- [ ] P0 - CRITICAL (blocks launch)
- [ ] P1 - HIGH (major feature broken)
- [ ] P2 - MEDIUM (minor issue)
- [ ] P3 - LOW (cosmetic)
```

### Release Criteria

**Minimum bar to launch MVP:**

✅ **Must Have (P0):**
- [ ] All P0 bugs fixed
- [ ] All authentication flows work
- [ ] Can add/edit/delete subscriptions
- [ ] Dashboard calculations are correct
- [ ] No data loss bugs
- [ ] No security vulnerabilities
- [ ] Works on Chrome, Safari, Firefox (desktop)
- [ ] Works on iOS and Android (mobile)

⚠️ **Should Have (P1):**
- [ ] All P1 bugs fixed
- [ ] Filtering and sorting work
- [ ] Error messages are clear
- [ ] Forms validate properly
- [ ] UI looks good on all devices

🎯 **Nice to Have (P2/P3):**
- Can launch with these bugs documented
- Fix in post-MVP iterations

---

## 7. Post-Launch Monitoring

### Error Tracking: Sentry

**Priority:** P1 - HIGH  
**Time:** 2 hours setup

#### Setup

```bash
# Backend
cd server
npm install @sentry/node

# Frontend
cd client
npm install @sentry/react
```

**`server/src/index.ts`:**
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Error handler
app.use(Sentry.Handlers.errorHandler());
```

**`client/src/main.tsx`:**
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1,
});
```

**What to Monitor:**
- ✅ 500 errors from backend
- ✅ JavaScript errors in frontend
- ✅ Failed API requests
- ✅ Unhandled promise rejections

**Alerts:**
- Slack/email when error rate > 1% of requests
- Immediate alert for P0-level errors

### User Analytics: Plausible or PostHog

**Priority:** P2 - MEDIUM (Post-MVP)  
**Time:** 1 hour setup

**Track:**
- ✅ User registrations
- ✅ Subscriptions added/edited/deleted
- ✅ Dashboard views
- ✅ Page load times

**Don't track:**
- ❌ Personal subscription data
- ❌ Costs or billing amounts

### Performance Monitoring: Vercel Analytics

**Priority:** P2 - MEDIUM  
**Time:** 30 minutes setup

**Built-in if deployed to Vercel:**
- ✅ Web Vitals (LCP, FID, CLS)
- ✅ Page load times
- ✅ API response times

**Alerts:**
- Email if page load > 3 seconds
- Email if API response > 1 second

### Uptime Monitoring: UptimeRobot (Free)

**Priority:** P2 - MEDIUM  
**Time:** 15 minutes setup

**Monitor:**
- ✅ Frontend URL (check every 5 minutes)
- ✅ Backend health endpoint (check every 5 minutes)
- ✅ Database connectivity (via health check)

**Alerts:**
- Email/SMS if down for > 2 checks (10 minutes)

---

## 8. Practical Implementation Plan

### Week-by-Week Breakdown

#### Week 1 (Days 1-7)

**Days 1-4:** Backend complete ✅  
**Days 5-7:** Frontend development + manual testing

**QA Tasks:**
- AI agents write backend integration tests **while building frontend**
- Run tests locally as frontend progresses
- No formal QA phase yet

#### Week 2 (Days 8-14)

**Days 8-10:** Frontend completion
- AI agents write Playwright tests for auth flow
- Anna & Tomasz do first manual QA pass (half-day)

**Days 11-12:** Polish & bug fixes
- Fix P0 and P1 bugs
- AI agents add dashboard tests

**Days 13-14:** Final QA & deployment prep
- Full manual QA checklist (Anna & Tomasz, 1 day)
- Setup CI/CD pipeline
- Setup Sentry error tracking
- Deployment to staging

#### Week 3 (Days 15-21) - If Needed

**Days 15-16:** Final polish
- Fix remaining P1 bugs
- Add smoke tests
- Performance testing

**Day 17:** Production deployment
- Deploy to Railway (backend)
- Deploy to Vercel (frontend)
- Run production smoke tests

**Days 18-21:** Post-launch monitoring
- Watch Sentry for errors
- Monitor uptime
- Fix critical bugs if found

### Who Writes Tests?

**AI Agents (developers):**
- Write backend integration tests while building features
- Write Playwright tests after features are complete
- Fix bugs found by tests
- Setup CI/CD pipeline

**Anna & Tomasz (reviewers):**
- Manual QA checklist (1 day before launch)
- Test on different browsers/devices
- Provide UX feedback
- Final approval to launch

### When to Test?

**Continuous (as we code):**
- Run backend tests on every commit
- Run frontend build on every commit

**Milestone-based:**
- Full manual QA after frontend completion (Day 10)
- Full manual QA before deployment (Day 14)

**Post-deployment:**
- Smoke tests immediately after deploy
- Monitor Sentry for 48 hours after launch

### Test Coverage Targets

**Realistic for MVP:**

| Area | Target Coverage | Rationale |
|------|----------------|-----------|
| Backend API | 80% | High-risk area (auth, data) |
| Backend utilities | 90% | Pure logic, easy to test |
| Frontend user flows | 60% | Critical paths only |
| Frontend components | 20% | Low priority for MVP |

**How to measure:**
```bash
# Backend
cd server
npm run test:coverage

# Frontend
cd client
npm run test:coverage
```

---

## 9. Tool Recommendations

### Final Tool Stack

| Purpose | Tool | Rationale | Cost |
|---------|------|-----------|------|
| **Backend testing** | Jest + Supertest | Industry standard, easy setup | Free |
| **Frontend testing** | Playwright | Better than Cypress, faster | Free |
| **Component testing** | Vitest + RTL | (Post-MVP only) | Free |
| **CI/CD** | GitHub Actions | Built-in, 2000 min/month free | Free |
| **Error tracking** | Sentry | Best error tracking, 5k events/month free | Free |
| **Analytics** | Plausible | Privacy-friendly, GDPR compliant | $9/month |
| **Uptime monitoring** | UptimeRobot | Simple, 50 monitors free | Free |
| **Performance** | Vercel Analytics | Built-in with Vercel | Free |
| **Bug tracking** | GitHub Issues | Integrated with repo | Free |

**Total Monthly Cost:** $9 (only Plausible)

---

## 10. Time Estimates

### QA Activities by Day

| Day | Activity | Time | Responsible |
|-----|----------|------|-------------|
| **Day 5** | Setup Jest + write auth tests | 3 hours | AI agent |
| **Day 6** | Write subscription CRUD tests | 3 hours | AI agent |
| **Day 7** | Write dashboard tests | 2 hours | AI agent |
| **Day 8** | Setup Playwright + auth flow tests | 3 hours | AI agent |
| **Day 9** | Write subscription flow tests | 2 hours | AI agent |
| **Day 10** | First manual QA pass | 4 hours | Anna & Tomasz |
| **Day 11-12** | Bug fixing | 6 hours | AI agents |
| **Day 13** | Setup CI/CD pipeline | 2 hours | AI agent |
| **Day 13** | Setup Sentry error tracking | 1 hour | AI agent |
| **Day 14** | Final manual QA checklist | 6 hours | Anna & Tomasz |
| **Day 15-16** | Polish & final bug fixes | 4 hours | AI agents |
| **Day 17** | Deployment & smoke tests | 2 hours | AI agents |

**Total QA Time:** ~38 hours over 2 weeks (2.7 days)  
**Percentage of Project:** ~13% of time (appropriate for MVP)

---

## 11. Known Limitations & Acceptable Risks

### What We're Accepting for MVP

✅ **Acceptable:**
- No load testing (MVP won't have scale issues)
- No visual regression tests (UI is simple)
- No accessibility testing (important but not blocker)
- 80% test coverage (not 100%)
- Some P2 bugs at launch (if documented)
- Manual browser testing (not automated cross-browser)

❌ **Not Acceptable:**
- P0 or P1 bugs at launch
- Security vulnerabilities
- Data loss bugs
- No error tracking
- No monitoring
- Broken critical user flows

### Risk Mitigation

**High-Risk Areas:**
1. **Authentication** - Extensive testing required
2. **Money calculations** - Must be exact
3. **Data deletion** - Must be recoverable (soft delete)

**Medium-Risk Areas:**
1. **Filtering/sorting** - Test manually, automate if time
2. **Mobile responsive** - Test on real devices
3. **Browser compatibility** - Test top 3 browsers

**Low-Risk Areas:**
1. **UI styling** - Visual issues are P3
2. **Animation/transitions** - Not critical for MVP
3. **Edge cases with 1000+ subscriptions** - MVP won't hit this

---

## 12. Success Metrics

### Definition of "Good Enough" for MVP Launch

**Technical Metrics:**
- ✅ 80%+ backend test coverage
- ✅ All critical user flows have automated tests
- ✅ All P0 and P1 bugs fixed
- ✅ CI/CD pipeline running
- ✅ Error tracking active
- ✅ Manual QA checklist 100% passed

**Quality Indicators:**
- ✅ No errors in Sentry for 24 hours pre-launch
- ✅ All tests passing in CI
- ✅ API response times < 500ms
- ✅ Frontend loads in < 2 seconds
- ✅ Works on 4 major browsers
- ✅ Works on iOS and Android

**Launch Readiness:**
- ✅ Smoke tests pass in production
- ✅ Uptime monitoring configured
- ✅ Rollback plan documented
- ✅ Support channel ready (email/Telegram)

---

## 13. QA Checklist: Implementation Order

### Priority 1 (Do First - Days 5-7)

- [ ] Setup Jest and Supertest in backend
- [ ] Write auth endpoint tests
- [ ] Write subscription CRUD tests
- [ ] Write dashboard tests
- [ ] Run tests locally, verify all pass

### Priority 2 (Do Next - Days 8-10)

- [ ] Setup Playwright in frontend
- [ ] Write auth flow tests (login, register, logout)
- [ ] Write add subscription test
- [ ] Write edit subscription test
- [ ] Write delete subscription test
- [ ] First manual QA pass by Anna & Tomasz

### Priority 3 (Do Before Launch - Days 11-14)

- [ ] Setup GitHub Actions CI/CD
- [ ] Setup Sentry error tracking
- [ ] Add pre-deployment smoke tests
- [ ] Full manual QA checklist
- [ ] Test on all browsers
- [ ] Test on mobile devices
- [ ] Fix all P0 and P1 bugs

### Priority 4 (Do After Launch - Days 15-17)

- [ ] Setup UptimeRobot monitoring
- [ ] Setup Plausible analytics (optional)
- [ ] Monitor Sentry for 48 hours
- [ ] Document known issues
- [ ] Plan post-MVP improvements

---

## 14. Conclusion

### This QA Strategy Balances:

✅ **Speed** - 7 days of QA work over 2-3 weeks  
✅ **Quality** - Catches critical bugs, 80% test coverage  
✅ **Pragmatism** - Focuses on high-risk areas  
✅ **Team Size** - Realistic for small AI agent team  
✅ **Maintainability** - Sets up CI/CD for future  

### Key Principles:

1. **Test as you code** - Don't wait for separate QA phase
2. **Automate critical paths** - Manual test everything else
3. **Fix P0/P1 bugs** - Ship with documented P2/P3 bugs
4. **Monitor post-launch** - Catch issues in production
5. **Iterate fast** - Ship MVP, improve based on real usage

### Next Steps:

1. **Review this plan** with Anna & Tomasz
2. **Setup backend testing** (Day 5)
3. **Setup frontend testing** (Day 8)
4. **Execute manual QA** (Day 10 and Day 14)
5. **Launch MVP** (Day 17)

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-28  
**Maintained by:** Tech Architect (Subagent)  
**Review Cadence:** Update after each launch phase
