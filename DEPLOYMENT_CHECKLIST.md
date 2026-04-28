# Production Deployment Checklist

Use this checklist to track your deployment progress.

## Pre-Deployment

- [ ] Railway account created (https://railway.app/)
- [ ] Vercel account created (https://vercel.com/)
- [ ] Railway CLI installed ✅
- [ ] Vercel CLI installed ✅
- [ ] Local app tested and working

## Railway Backend Deployment

- [ ] Authenticated with Railway (`railway login`)
- [ ] Railway project created (`railway init`)
- [ ] PostgreSQL database added (`railway add` → PostgreSQL)
- [ ] Environment variables set:
  - [ ] JWT_SECRET
  - [ ] JWT_EXPIRES_IN
  - [ ] NODE_ENV
  - [ ] PORT
  - [ ] DATABASE_URL (auto-set by PostgreSQL addon)
- [ ] Backend deployed (`railway up`)
- [ ] Backend URL obtained (`railway domain`)
- [ ] Backend health check passed (curl backend-url/health)
- [ ] Database migrations completed successfully
- [ ] Backend logs checked for errors (`railway logs`)

### Backend URL
```
https://________________________.up.railway.app
```

## Vercel Frontend Deployment

- [ ] Authenticated with Vercel (`vercel login`)
- [ ] Updated `vercel.json` with Railway backend URL
- [ ] Frontend built successfully (`npm run build`)
- [ ] Frontend deployed to Vercel (`vercel --prod`)
- [ ] Frontend URL obtained
- [ ] Frontend loads in browser
- [ ] CLIENT_URL updated in Railway backend
- [ ] Backend redeployed with new CORS settings

### Frontend URL
```
https://________________________.vercel.app
```

## Integration Testing

### Registration Flow
- [ ] Navigate to frontend URL
- [ ] Click "Register" / "Sign Up"
- [ ] Fill in test credentials:
  - Email: test@example.com
  - Password: Test123!@#
  - Name: Test User
- [ ] Form submits successfully
- [ ] Redirected to dashboard
- [ ] No console errors

### Login Flow
- [ ] Logout from test account
- [ ] Click "Login"
- [ ] Enter test credentials
- [ ] Login successful
- [ ] Redirected to dashboard
- [ ] Session persists on page refresh

### Subscription Management
- [ ] Click "Add Subscription"
- [ ] Fill in subscription details:
  - Name: Netflix
  - Cost: 15.99
  - Currency: USD
  - Billing Cycle: Monthly
  - Renewal Date: (future date)
  - Category: Streaming
- [ ] Subscription appears in dashboard
- [ ] Subscription persists after logout/login
- [ ] Can edit subscription
- [ ] Can delete subscription

### Data Persistence
- [ ] Logout
- [ ] Login again
- [ ] All subscriptions still visible
- [ ] Check Railway database console (`railway run prisma studio`)

## Security Verification

- [ ] JWT_SECRET is secure (32+ characters)
- [ ] CORS configured with specific frontend URL (not wildcard)
- [ ] Environment variables not in git history
- [ ] No sensitive data in logs
- [ ] HTTPS enabled on both frontend and backend
- [ ] Rate limiting working (check backend code)

## Monitoring Setup

- [ ] Railway dashboard metrics checked
- [ ] Vercel dashboard analytics enabled
- [ ] Error tracking configured (optional)
- [ ] Backend logs monitored for errors
- [ ] Database backup settings verified

## Documentation

- [ ] Production URLs documented
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Troubleshooting guide created
- [ ] Team notified of deployment

## Post-Deployment (Optional)

- [ ] Custom domain configured
- [ ] SSL certificate verified
- [ ] DNS records propagated
- [ ] Email notifications configured
- [ ] Monitoring alerts set up
- [ ] Backup strategy documented
- [ ] CI/CD pipeline configured

## Rollback Plan

In case something goes wrong:

### Backend Rollback
```bash
cd server
railway rollback
railway logs
```

### Frontend Rollback
```bash
cd client
vercel rollback
```

### Database Rollback
```bash
railway run prisma migrate reset --force
# Restore from backup if needed
```

## Notes

**Deployment Date**: ___________

**Deployed By**: ___________

**Production URLs**:
- Frontend: ___________
- Backend: ___________

**Issues Encountered**:
- 
- 

**Solutions Applied**:
- 
- 

**Post-Deployment Tasks**:
- 
- 

---

## Quick Commands Reference

### Railway
```bash
railway login
railway init
railway add
railway variables
railway up
railway logs
railway domain
railway rollback
```

### Vercel
```bash
vercel login
vercel --prod
vercel logs
vercel domains
vercel rollback
```

### Testing
```bash
# Backend health check
curl https://your-backend.railway.app/health

# Frontend check
curl https://your-frontend.vercel.app

# Database console
cd server && railway run prisma studio
```

---

**Status**: 🔴 Not Started | 🟡 In Progress | 🟢 Complete
