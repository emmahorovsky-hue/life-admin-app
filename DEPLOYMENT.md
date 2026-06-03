# Production Deployment Guide

Deploy Life Admin App to production using Railway (backend) and Vercel (frontend).

## Architecture

```
GitHub Repository (main branch)
    ↓
    ├─→ Railway (Backend)
    │   ├─ Node.js + Express
    │   ├─ PostgreSQL Database
    │   └─ Auto-deploys on push
    │
    └─→ Vercel (Frontend)
        ├─ React + Vite
        ├─ CDN + Edge functions
        └─ Auto-deploys on push
```

## Prerequisites

### Accounts (Free Tier Available)

- [ ] GitHub account with repo access
- [ ] Railway account (https://railway.app - free tier available)
- [ ] Vercel account (https://vercel.com - free tier available)

### Local Requirements

- Node.js 20+
- PostgreSQL 15+ (locally for testing)
- Git

### Environment Files

Have ready:
- `.env.example` values for production
- Strong JWT secret
- Database URL format for Railway

## Part 1: Backend Deployment (Railway)

### 1.1 Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub (easiest)
3. Authorize repository access

### 1.2 Create New Project

1. Click "New Project" → "Deploy from GitHub repo"
2. Select `emmahorovsky-hue/life-admin-app`
3. Railway auto-detects monorepo and Node.js app

### 1.3 Configure Monorepo

**Critical:** Railway must know where the deployable code is (in `./server`).

1. In Railway project dashboard
2. Go to "Settings" → "Root Directory"
3. Set to `server/`
4. Save

**Without this, build fails with "No Procfile detected"**

> With Root Directory set to `server/`, Railway reads the canonical build/deploy
> config from `server/railway.json` and `server/nixpacks.toml` (and `server/Procfile`
> as a fallback). There are no root-level Railway config files — they were removed
> to avoid two divergent build definitions.

### 1.4 Add PostgreSQL Service

1. In Railway project
2. Click "+ Add Service" → "Database" → "PostgreSQL"
3. Railway creates managed PostgreSQL instance
4. Automatically sets `DATABASE_URL` environment variable

### 1.5 Configure Environment Variables

1. Go to "Variables" tab
2. Add these variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Enables production mode |
| `JWT_SECRET` | Generate strong secret | Use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGIN` | Your Vercel domain | e.g., `https://client-beta-flame.vercel.app` |

**Environment variables already set by Railway:**
- `DATABASE_URL` - PostgreSQL connection string

### 1.6 Deploy Backend

1. Click "Deploy" button
2. Railway builds and deploys Node.js server
3. Check logs for errors
4. Note the backend URL (e.g., `https://life-admin-api.railway.app`)

**Expected output:**
```
> Compiling TypeScript
> Build successful
> Starting server on port 3001
> Database connected
```

### 1.7 Test Backend

```bash
# Health check
curl https://your-railway-url/health

# Should return:
# { "status": "ok" }
```

## Part 2: Database Setup (Railway PostgreSQL)

### 2.1 Connect to Database

Via Railway dashboard:

1. Go to PostgreSQL service
2. Copy connection string
3. Use with database GUI or psql CLI

### 2.2 Run Migrations

Railway runs migrations automatically on each deploy (via `npm run prisma:migrate:deploy` in build script).

**To manually run:**

```bash
# Login to Railway CLI
railway login

# Link project
railway link

# Run migrations
railway run npm run prisma:migrate:deploy

# Seed database (optional, for testing)
railway run npm run seed
```

### 2.3 Verify Database

1. Go to PostgreSQL service in Railway
2. Check "Data" tab
3. Should see `users`, `subscriptions`, `categories`, `notificationLogs` tables

## Part 3: Frontend Deployment (Vercel)

### 3.1 Create Vercel Account

1. Go to https://vercel.com
2. Sign up with GitHub
3. Authorize repository access

### 3.2 Import Project

1. Click "Add New..." → "Project"
2. Select `emmahorovsky-hue/life-admin-app` repository
3. Vercel scans project

### 3.3 Configure Build Settings

Vercel should auto-detect, but verify:

| Setting | Value |
|---------|-------|
| Framework | Vite |
| Root Directory | `client/` |
| Build Command | `npm run build` |
| Output Directory | `dist/` |
| Install Command | `npm install` |

### 3.4 Add Environment Variables

1. Go to "Settings" → "Environment Variables"
2. Add:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | Backend URL from Railway |

**Example:** `https://loyal-magic-production.up.railway.app`

### 3.5 Deploy Frontend

1. Click "Deploy"
2. Vercel builds React app with Vite
3. Deploys to CDN
4. Get production URL (e.g., `https://client-beta-flame.vercel.app`)

**Expected build:**
```
> Building production bundle with Vite
> Build successful
> Deployed to https://client-beta-flame.vercel.app
```

### 3.6 Test Frontend

1. Open https://client-beta-flame.vercel.app
2. Test login: `test@example.com` / `testpass123`
3. Create a subscription
4. Verify dashboard loads

## Part 4: Update Configuration

### 4.1 Backend CORS

Update `CORS_ORIGIN` in Railway to match Vercel frontend domain:

1. Railway project → Variables
2. Set `CORS_ORIGIN` to `https://client-beta-flame.vercel.app`
3. Redeploy backend

### 4.2 Vercel API URL

Verify `VITE_API_URL` in Vercel environment matches Railway backend:

1. Vercel project → Settings → Environment Variables
2. `VITE_API_URL` = your Railway backend URL
3. Redeploy frontend

## Part 5: Custom Domains (Optional)

### Add Custom Domain to Vercel

1. Vercel project → Settings → Domains
2. Add your domain
3. Follow DNS instructions
4. Wait for propagation (10-30 minutes)

### Add Custom Domain to Railway (Optional)

1. Railway project → Settings → Domains
2. Add custom domain
3. Update DNS records
4. Wait for SSL certificate (automatic)

## Monitoring & Troubleshooting

### Check Backend Logs

**Railway dashboard:**
1. Select backend service
2. Click "Logs" tab
3. View real-time logs
4. Check for errors

### Check Frontend Logs

**Vercel dashboard:**
1. Select deployment
2. Click "Logs" tab
3. View build & runtime logs

### Common Issues

#### "No Procfile detected"
**Problem:** Railway can't find Node.js app
**Solution:** Set root directory to `server/` in Railway settings

#### "Cannot connect to database"
**Problem:** `DATABASE_URL` env var missing
**Solution:** PostgreSQL service must be added; Railway sets this automatically

#### "CORS error in frontend"
**Problem:** Frontend & backend domains don't match
**Solution:** Update `CORS_ORIGIN` in Railway to match Vercel domain

#### "Login fails, 401 Unauthorized"
**Problem:** JWT_SECRET mismatch or database not migrated
**Solution:** 
1. Verify `JWT_SECRET` is set in Railway
2. Check database has been migrated
3. View logs for detailed error

#### "Slow database queries"
**Problem:** No indexes or inefficient queries
**Solution:** Check Prisma query logs, verify indexes exist

## Rollback Plan

### Rollback Frontend (Vercel)

1. Vercel dashboard → Deployments
2. Find previous good deployment
3. Click "Redeploy" on that version
4. Automatic rollback

### Rollback Backend (Railway)

1. Railway dashboard → Deployments
2. Find previous good deployment
3. Click "Rollback" button
4. Automatic rollback

### Rollback Database (PostgreSQL)

1. Railway PostgreSQL → Backups
2. Select point-in-time backup
3. Restore to that backup
4. Run migrations again

**⚠️ Warning:** Database restoration requires downtime

## Continuous Deployment (Auto-Deploy)

### How It Works

1. **On GitHub:** Commit & push to `main` branch
2. **Railway:** Auto-deploys backend (watches `main`)
3. **Vercel:** Auto-deploys frontend (watches `main`)
4. **Result:** New features live within 5-10 minutes

### Disable Auto-Deploy

If needed (e.g., during major refactor):

**Railway:**
1. Settings → Auto Deploy
2. Toggle off
3. Deploy manually when ready

**Vercel:**
1. Settings → Git
2. Uncheck "Automatic deployments"
3. Deploy manually via dashboard

## Performance Tips

### Backend (Railway)

- Monitor CPU/memory usage
- Use Railway's auto-scaling (optional)
- Cache frequent queries with Redis (future)
- Monitor database slow logs

### Frontend (Vercel)

- Use Vercel Analytics
- Monitor Core Web Vitals
- Check bundle size
- Enable image optimization

### Database (PostgreSQL)

- Monitor connection pool
- Check for long-running queries
- Enable query logging
- Set up automated backups (Railway does this)

## Security Checklist

Before going live:

- [ ] `NODE_ENV` = `production` in Railway
- [ ] `JWT_SECRET` is strong (32+ characters)
- [ ] `CORS_ORIGIN` is production domain
- [ ] No hardcoded secrets in code
- [ ] HTTPS enabled (automatic on both)
- [ ] Database backups configured (automatic)
- [ ] Error messages don't leak info
- [ ] Rate limiting active on auth endpoints
- [ ] No default test credentials in production

## Maintenance

### Regular Tasks

**Weekly:**
- Check error logs
- Monitor database size
- Verify backups are being created

**Monthly:**
- Review performance metrics
- Update dependencies
- Test disaster recovery plan

### Database Migrations

```bash
# Create migration
npm run prisma:migrate dev --name describe_change

# Commit migration files
git add prisma/migrations/
git commit -m "migration: describe_change"

# Push to main
git push origin main

# Railway auto-runs: prisma:migrate:deploy
```

## Support & Documentation

- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs

---

**Last Updated:** 2026-06-02  
**Target Audience:** DevOps, Tech Leads  
**Related Docs:** [CONTRIBUTING.md](CONTRIBUTING.md), [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
