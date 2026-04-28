# QA Roadmap - Visual Timeline

**Print this and check off as you go! 📋**

---

## 🗓 Week 1: Backend Development + Testing

### Day 5: Backend Testing Foundation

**AI Agent Tasks:**
```
□ Install Jest + Supertest
□ Create jest.config.js
□ Setup test database (lifeadmin_test)
□ Write auth endpoint tests (35 test cases)
□ Run tests - verify all pass
```

**Time:** 3 hours  
**Deliverable:** ✅ All auth tests passing

---

### Day 6: Subscription Tests

**AI Agent Tasks:**
```
□ Write subscription CRUD tests
  □ Create subscription
  □ List subscriptions (with filters)
  □ Update subscription
  □ Delete subscription (soft delete)
  □ Authorization tests (can't edit others' subs)
□ Run tests - verify all pass
```

**Time:** 3 hours  
**Deliverable:** ✅ All subscription tests passing

---

### Day 7: Dashboard Tests

**AI Agent Tasks:**
```
□ Write dashboard summary tests
  □ Monthly total calculation
  □ Annual total calculation
  □ Cost normalization (weekly → monthly)
  □ Upcoming renewals
  □ Active subscription count
□ Write upcoming renewals tests
□ Run full test suite - verify coverage >80%
```

**Time:** 2 hours  
**Deliverable:** ✅ Dashboard tests passing, 80%+ coverage

---

## 🗓 Week 2: Frontend Testing + First QA Pass

### Day 8: Frontend Testing Foundation

**AI Agent Tasks:**
```
□ Install Playwright
□ Create playwright.config.ts
□ Write auth flow tests
  □ User registration
  □ Login with correct credentials
  □ Login fails with wrong password
  □ Session persists after refresh
  □ Logout works
□ Run tests - verify all pass
```

**Time:** 3 hours  
**Deliverable:** ✅ Auth flow tests passing

---

### Day 9: Subscription Flow Tests

**AI Agent Tasks:**
```
□ Write subscription management tests
  □ Add new subscription
  □ Edit subscription
  □ Delete subscription
  □ Filter by category
  □ Sort by date/cost
□ Write dashboard view tests
□ Run full frontend test suite
```

**Time:** 2 hours  
**Deliverable:** ✅ Frontend tests passing

---

### Day 10: 🔴 FIRST MANUAL QA PASS

**Anna & Tomasz Tasks:**
```
□ Setup: Create fresh test account
□ Test authentication flow
  □ Register new account
  □ Login/logout
  □ Session persistence
□ Test subscription management
  □ Add 5-10 diverse subscriptions
  □ Edit subscriptions
  □ Delete subscriptions
□ Test dashboard
  □ Verify totals look correct
  □ Check upcoming renewals
□ Test filtering and sorting
□ Mobile testing (iPhone/Android)
  □ All features work on mobile
  □ UI looks good
□ Document all bugs in GitHub Issues
  □ Mark severity (P0/P1/P2/P3)
```

**Time:** 4 hours  
**Deliverable:** ✅ Bug list with severities

---

### Days 11-12: Bug Fixing

**AI Agent Tasks:**
```
□ Fix all P0 bugs (critical blockers)
□ Fix all P1 bugs (major issues)
□ Fix P2 bugs if time allows
□ Verify fixes with tests
□ Update tests if needed
```

**Time:** 6 hours  
**Deliverable:** ✅ P0/P1 bugs fixed, tests passing

---

### Day 13: CI/CD + Monitoring Setup

**AI Agent Tasks - Morning:**
```
□ Create .github/workflows/test.yml
□ Configure GitHub Actions
  □ Backend tests
  □ Frontend build
  □ PostgreSQL service
□ Push to GitHub
□ Verify CI pipeline runs successfully
```

**AI Agent Tasks - Afternoon:**
```
□ Create Sentry account
□ Install Sentry SDK (backend + frontend)
□ Configure Sentry error tracking
□ Test error capturing
□ Setup UptimeRobot monitoring
```

**Time:** 3 hours  
**Deliverable:** ✅ CI/CD working, error tracking active

---

### Day 14: 🔴 FINAL PRE-LAUNCH QA

**Anna & Tomasz Tasks:**
```
□ Full Manual QA Checklist (Section 4 of QA_STRATEGY.md)

Authentication Flow:
□ Register with valid email
□ Register fails with invalid email
□ Register fails with short password
□ Login with correct credentials
□ Login fails with wrong password
□ Logout clears session
□ Cannot access protected routes when logged out

Subscription Management:
□ Add subscription (monthly)
□ Add subscription (annual)
□ Add subscription (weekly)
□ Add subscription (quarterly)
□ Edit subscription name
□ Edit subscription cost
□ Edit renewal date
□ Delete subscription
□ Cannot add negative cost
□ Cannot add empty name

Dashboard:
□ Monthly total is correct
□ Annual total is correct
□ Active subscription count is correct
□ Upcoming renewals show (next 30 days)
□ Renewals sorted by date
□ Dashboard updates after adding subscription
□ Dashboard updates after editing
□ Dashboard updates after deleting

Filtering & Sorting:
□ Filter by each category
□ "All Categories" shows all
□ Sort by renewal date (asc/desc)
□ Sort by cost (asc/desc)
□ Sort by name (alphabetical)

UI/UX:
□ Forms have clear labels
□ Error messages are helpful
□ Success messages appear
□ Loading states show
□ Buttons clearly clickable
□ No console errors
□ No visual glitches

Browser Testing:
□ Chrome (desktop)
□ Safari (desktop)
□ Firefox (desktop)
□ iOS Safari (iPhone)
□ Android Chrome

Security:
□ Cannot access other users' data
□ Cannot edit other users' subscriptions
□ Cannot delete other users' subscriptions
□ JWT is httpOnly cookie
□ Password not in API responses

Edge Cases:
□ Dashboard with 0 subscriptions
□ Very long subscription names
□ Very large costs ($999,999)
□ Past renewal dates
```

**Time:** 6 hours  
**Deliverable:** ✅ Complete checklist, launch approval

---

## 🗓 Week 3: Polish + Launch

### Days 15-16: Final Polish

**AI Agent Tasks:**
```
□ Fix remaining P2 bugs
□ Performance optimization (if needed)
□ Add any missing tests
□ Update documentation
□ Create deployment guide
```

**Time:** 4 hours  
**Deliverable:** ✅ Production-ready code

---

### Day 17: 🚀 PRODUCTION LAUNCH

**Pre-Deployment:**
```
□ Run pre-deployment script
  ./scripts/pre-deploy-check.sh
□ Verify all checks pass
□ Create production environment variables
```

**Deployment:**
```
□ Deploy backend to Railway
  □ Configure DATABASE_URL
  □ Configure JWT_SECRET
  □ Configure SENTRY_DSN
  □ Run migrations
□ Deploy frontend to Vercel
  □ Configure VITE_API_URL
  □ Configure VITE_SENTRY_DSN
□ Verify deployment
```

**Post-Deployment:**
```
□ Run production smoke tests
  PROD_URL="https://your-app.com" ./scripts/smoke-test-prod.sh
□ Create test account in production
□ Add test subscription
□ Verify all features work
□ Check Sentry dashboard (should see test data)
□ Check UptimeRobot (should be monitoring)
```

**Time:** 2 hours  
**Deliverable:** ✅ Live production app!

---

### Days 18-21: Post-Launch Monitoring

**Monitoring Schedule:**
```
Day 1 (First 24 hours):
□ Check Sentry every 6 hours
□ Monitor uptime status
□ Watch for user reports
□ Be ready to rollback if critical errors

Days 2-3:
□ Check Sentry twice daily
□ Review any error patterns
□ Collect user feedback
□ Plan first patch release

Week 1:
□ Daily Sentry check
□ Weekly review meeting
□ Prioritize post-MVP improvements
□ Document lessons learned
```

**Deliverable:** ✅ Stable production app

---

## 📊 Success Metrics

### Technical Metrics

```
□ Backend test coverage: >80%
□ Frontend test coverage: >60%
□ CI/CD pipeline: 100% passing
□ API response time: <500ms
□ Frontend load time: <2s
□ Sentry error rate: <1%
□ Uptime: >99%
```

### Quality Metrics

```
□ All P0 bugs fixed: 100%
□ All P1 bugs fixed: 100%
□ P2 bugs: Documented for post-MVP
□ Manual QA checklist: 100% passed
□ Works on 4 major browsers: ✅
□ Works on mobile: ✅
```

---

## 🎯 Quick Reference

### Run Backend Tests
```bash
cd server
npm test
```

### Run Frontend Tests
```bash
cd client
npx playwright test
```

### Pre-Deployment Check
```bash
./scripts/pre-deploy-check.sh
```

### Production Smoke Test
```bash
PROD_URL="https://your-app.com" ./scripts/smoke-test-prod.sh
```

### Check Test Coverage
```bash
cd server
npm run test:coverage
```

### View Test Report (Frontend)
```bash
cd client
npx playwright show-report
```

---

## 📁 QA Documentation

1. **QA_SUMMARY.md** (8KB) - Executive overview for quick review
2. **QA_STRATEGY.md** (28KB) - Complete 14-section strategy
3. **QA_IMPLEMENTATION_GUIDE.md** (16KB) - Step-by-step implementation
4. **QA_ROADMAP.md** (this file) - Visual timeline with checkboxes

---

## 🎉 Launch Readiness

**Before you press "Deploy":**

```
□ All backend tests passing
□ All frontend tests passing
□ CI/CD pipeline green
□ Manual QA 100% complete
□ P0 and P1 bugs fixed
□ Sentry configured
□ UptimeRobot configured
□ Pre-deployment script passed
□ Rollback plan documented
```

**When all ✅ are checked, you're ready to launch! 🚀**

---

_Print this roadmap and check off items as you complete them._  
_Keep it visible during your 2-3 week sprint!_
