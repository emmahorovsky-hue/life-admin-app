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

**The build is configured in the Railway dashboard, not in this repo.** There
are no Railway config files here: no `railway.json`, no `nixpacks.toml`, no
`Procfile`. Earlier versions of this document described such files as
"canonical" — they were never read by the running service, and the resulting
drift cost a full investigation (LIF-176). If you change the deploy, change it
in the dashboard and update the snapshot below.

**Why the root directory matters:** the server depends on the local
`@life-admin/shared` workspace package (`packages/shared`, unpublished), so the
install must run from the **monorepo root**. A `server`-only build context fails
with an npm E404 on `@life-admin/shared`.

Settings → Source → Root Directory must be `/` (the repo root) — **not**
`server/`.

#### Current configuration (verified 2026-07-19 against the Railway API)

| Setting | Value |
|---|---|
| Project / environment | `life-admin-backend` / `production` |
| Service | `loyal-magic`, deployed from `emmahorovsky-hue/life-admin-app`, branch `main` |
| Root Directory | `/` |
| Builder | **Railpack** (Railway's default; *not* Nixpacks) |
| Install | `npm ci` at the repo root — Railpack's default for a detected npm workspace; installs all four workspaces |
| Build Command | `npm run prisma:generate -w server && npm run build -w server` |
| Start Command | `npm run prisma:migrate:deploy -w server && npm run start -w server` |
| Watch Paths | `/server/**`, `/packages/shared/**`, `/package.json`, `/package-lock.json` |
| Restart policy | `ON_FAILURE`, max 10 retries |

`packages/shared/**` must stay in the watch paths: the server consumes that
package's built `dist/`, so a shared-only change has to redeploy the API.

> **Migrating to config-as-code (optional, not done).** Versioning this in the
> repo is reasonable, but do it deliberately: the file must declare
> `"builder": "RAILPACK"` and mirror the commands above exactly. Committing a
> config that names a different builder and then pointing Railway at it would
> switch a working production service onto a build system it has never used.
> Validate on a PR environment before switching production.

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
| `CLIENT_URL` | Your Vercel domain | CORS allowlist — e.g., `https://client-beta-flame.vercel.app` |
| `VERCEL_PREVIEW_HOST_SUFFIX` | `-beta-flame.vercel.app` | Optional — grants CORS access to this project's Vercel preview deployments (hostname suffix match). Use your Vercel **team/user scope slug** with a leading dash — the scope slug is the only hostname part Vercel reserves across accounts, so anything else (like a project name) could be impersonated by another user. A missing leading separator is normalized to `-`. Leave unset to disallow preview origins. |
| `API_URL` | Your Railway backend URL | Base URL embedded in verification email links — e.g., `https://your-railway-url` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Optional — enables AI receipt/invoice extraction. Without it the feature degrades to manual entry (the extract endpoint returns 503). **Read at process start, so a redeploy/restart is required after setting it.** |
| `AI_MODEL` | `claude-haiku-4-5` | Optional — defaults to `claude-haiku-4-5`. Bump to `claude-sonnet-4-6` / `claude-opus-4-8` for higher extraction accuracy. |

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

### 1.8 Verify AI Extraction (optional)

Only relevant if `ANTHROPIC_API_KEY` is set (see §1.5). To confirm receipt/invoice extraction
reaches the Anthropic API, run the opt-in smoke script with a sample receipt:

```bash
cd server && npm run smoke:extract -- <path-to-receipt.(pdf|png|jpg)>
```

- Prints `source=ai` on success.
- **Skips cleanly with no error when `ANTHROPIC_API_KEY` is unset** — so it's safe to run anywhere.
- Script: `server/src/bin/extract-receipt.ts` (npm script `smoke:extract`).

**End-to-end check on the live site:** upload a receipt in the Upload Receipt dialog — it should
advance to the review dialog with prefilled fields (not "AI extraction is unavailable").

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

Update `CLIENT_URL` in Railway to match Vercel frontend domain:

1. Railway project → Variables
2. Set `CLIENT_URL` to `https://client-beta-flame.vercel.app`
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

## Part 6: Mobile Builds (EAS)

The Expo app bakes its API URL into the binary at build time via `API_URL`
(read in `mobile/app.config.ts`, exposed as `extra.apiUrl`). There is **no
production fallback**: the localhost default only applies to local dev
(`__DEV__`), and a release build without an API URL crashes at startup with a
configuration error instead of silently calling localhost.

### 6.1 Configure the API URL

1. Open `mobile/eas.json`
2. Replace the `REPLACE-WITH-PRODUCTION-API-URL` placeholder in
   `build.production.env.API_URL` with your Railway backend URL, e.g.
   `https://your-app.up.railway.app/api` (and the staging placeholder in
   `build.preview.env.API_URL` if you use preview builds)
3. Alternatively, set `API_URL` as an [EAS environment variable](https://docs.expo.dev/eas/environment-variables/)
   on the project instead of committing it to `eas.json`

`eas build --profile production` refuses to start if `API_URL` is unset, still
a placeholder, or points at localhost — the config in `mobile/app.config.ts`
throws during build configuration.

### 6.2 Configure the logo.dev token

Brand logos on subscription rows come from [logo.dev](https://logo.dev), keyed by
`LOGO_DEV_TOKEN` (read in `mobile/app.config.ts`, exposed as
`extra.logoDevToken`). Without it every row falls back to its category icon — the
feature degrades gracefully and the build still succeeds, which is precisely how
it stayed unset and unnoticed through several releases (LIF-216).

The token is publishable (`pk_`) and ships in the app bundle, but **this repo is
public**, so unlike `API_URL` it does not belong in `eas.json`:

1. Set `LOGO_DEV_TOKEN` as an [EAS environment variable](https://docs.expo.dev/eas/environment-variables/)
   on the project, visible to the build profiles you use
2. For local development, copy `mobile/.env.example` to `mobile/.env` and set it
   there — Expo loads that file when it evaluates `app.config.ts`. `mobile/.env`
   is gitignored, and CI's `env-file-guard` job fails the build if any `.env`
   file is ever tracked

Use the same token as the web client's `VITE_LOGO_DEV_TOKEN` — one logo.dev
project covers both platforms.

### 6.3 Configure Sentry

Crash and error reporting, matching the web client (`VITE_SENTRY_DSN`) and the
API (`SENTRY_DSN` on Railway). Mobile was the one platform with no reporting:
before this, a crash on a released build was invisible unless a user described
it.

Three pieces of configuration. Only the first affects whether errors are
reported at all — but the second decides whether the build succeeds:

1. **`SENTRY_DSN`** — set it as an [EAS environment variable](https://docs.expo.dev/eas/environment-variables/)
   on the project, visible to the build profiles you use. Read in
   `mobile/app.config.ts`, exposed as `extra.sentryDsn`, consumed by
   `mobile/lib/sentry.ts`. Without it Sentry never initialises; the build still
   succeeds, and a **production** build logs a warning saying it will report
   nothing. Like `LOGO_DEV_TOKEN` it stays out of `eas.json` — a DSN is
   publishable, but this repo is public.

2. **`SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`** — needed for
   uploading source maps and debug symbols. Without them a JS stack trace
   arrives as minified bundle offsets, which is close to unreadable.

   **These are not optional the way the DSN is: without them the iOS build
   fails.** The `@sentry/react-native` config plugin adds an Xcode build phase
   that runs `sentry-cli` unconditionally; with no org configured it exits with
   `An organization ID or slug is required (provide with --org)` and EAS reports
   `XCODE_BUILD_ERROR`. This documentation previously claimed the plugin "skips
   the upload with a warning rather than failing the build" — it does not, and
   that mistake cost build 19 on 2026-08-04, the first build to include the
   plugin.

   `SENTRY_AUTH_TOKEN` is a real secret — mark it as such on EAS, never commit
   it.

3. **`SENTRY_DISABLE_AUTO_UPLOAD`** — the escape hatch, and a temporary one. Set
   it to `true` as an EAS environment variable to skip the upload step entirely
   and let a build through without the three variables above. Reporting still
   works (given a DSN); only symbolication is lost. `SENTRY_ALLOW_FAILURE=true`
   is the softer alternative — it attempts the upload and tolerates a failure,
   which also means a real failure (expired token, network) costs you
   symbolication with nothing in the build log to say so.

   It is set **per environment**, so any build profile that does not carry it
   fails the way build 19 did. Check with `eas env:list` rather than assuming —
   this document deliberately does not record which environments have it, since
   that state lives on EAS and nothing in the repo can keep the claim honest.

   **Remove it once the org/project/token trio is configured**, and do not move
   it into `eas.json`. Left in place it silently skips the upload the trio
   exists to perform, which looks exactly like Sentry working until you open a
   stack trace — the same shape of mistake as the one this section documents.

Sampling and PII follow the other two platforms: 20% of traces in release, all
of them in dev, and `sendDefaultPii: false`. Release and dist are left to the
native SDK, which derives them from the built app (e.g.
`com.paypr.live@1.0.0+18`) — that is what matches the build EAS uploaded, and a
hand-set string would drift the moment `autoIncrement` moved the build number.

To verify after a release: force an error in the app and confirm the event
arrives in Sentry tagged with the right release and `environment: production`.

### 6.4 Build

```bash
cd mobile
npx eas build --profile production --platform all
```

After a build, confirm the token actually made it in: real brand logos (not
category icons) should appear on the Subscriptions rows and in the add/edit
sheet. A subscription whose name maps to no known domain correctly keeps its
category icon.

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

#### "npm error 404 '@life-admin/shared@*' is not in this registry"
**Problem:** Railway's Root Directory is set to `server/`, so npm can't see the
`packages/shared` workspace and tries the public registry
**Solution:** Set Root Directory back to `/` (repo root) — see section 1.3

#### A change to `packages/shared` didn't redeploy the API
**Problem:** `/packages/shared/**` is missing from Settings → Build → Watch Paths
**Solution:** Restore the full watch-path set from the table in section 1.3. The
server consumes the shared package's built `dist/`, so shared-only commits must
trigger a deploy or production runs against stale shared code.

#### "Cannot connect to database"
**Problem:** `DATABASE_URL` env var missing
**Solution:** PostgreSQL service must be added; Railway sets this automatically

#### "CORS error in frontend"
**Problem:** Frontend & backend domains don't match
**Solution:** Update `CLIENT_URL` in Railway to match Vercel domain

#### "Login fails, 401 Unauthorized"
**Problem:** JWT_SECRET mismatch or database not migrated
**Solution:** 
1. Verify `JWT_SECRET` is set in Railway
2. Check database has been migrated
3. View logs for detailed error

#### "Slow database queries"
**Problem:** No indexes or inefficient queries
**Solution:** Check Prisma query logs, verify indexes exist

#### "AI extraction is unavailable" on receipt upload
**Problem:** `ANTHROPIC_API_KEY` is not set on Railway, or it was set but the service hasn't been
redeployed (the key is read at import time, so a running process won't pick it up).
**Solution:**
1. Set `ANTHROPIC_API_KEY` in Railway Variables (see §1.5)
2. Redeploy, and confirm the deployment **ID actually rolled** — Railway "Online"/health 200 can be
   served from a stale image while a new deploy fails
3. Verify with the smoke script (§1.8) or by uploading a receipt on the live site

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
- [ ] `CLIENT_URL` is production domain
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

**Last Updated:** 2026-06-20  
**Target Audience:** DevOps, Tech Leads  
**Related Docs:** [CONTRIBUTING.md](CONTRIBUTING.md), [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
