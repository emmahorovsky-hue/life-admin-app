# Deployment Guide

## Environment Setup

### Production
- **Frontend:** Vercel (auto-deploys from `main` branch)
- **Backend:** Railway (auto-deploys from `main` branch)
- **Database:** Railway PostgreSQL

### PR Preview Environments
Every pull request automatically gets:
- **Frontend Preview:** Vercel creates a unique preview URL
- **Backend Preview:** Railway creates a PR environment (configure in Railway dashboard)

## Railway Service Configuration (Monorepo)

This repo is a monorepo: the deployable Node.js app lives in `./server`,
and the React client lives in `./client`. Railway must be told where the
backend service is, otherwise Nixpacks scans the repo root, fails to
detect a Node project, and the build aborts at the "Build image" step.

**Recommended setup (cleanest):**

1. Railway dashboard → backend service → **Settings** → **Source**
2. Set **Root Directory** to `server`
3. Save. Railway will then use `server/railway.json` and
   `server/nixpacks.toml`, and `npm ci` / `npm start` resolve naturally.

**Fallback (works without changing the dashboard):**

The repo also ships with a root-level `package.json`, `nixpacks.toml`,
and `railway.json` that explicitly `cd server` for install/build/start.
This means the deploy succeeds even if the service Root Directory is
left at the repo root.

## Railway PR Preview Setup

1. Go to Railway dashboard → Your project
2. Click on the backend service
3. Go to **Settings** → **Environment**
4. Enable **"PR Deployments"**
5. Configure:
   - ✅ Create ephemeral database for each PR
   - ✅ Auto-delete on PR close
   - ✅ Use same environment variables as production

## Vercel PR Preview (Already Active)

Vercel automatically creates preview URLs for every PR. Find them:
- In the PR checks section on GitHub
- In Vercel dashboard
- Bot comment on the PR

## Workflow

### For Engineers/Agents:
1. Create feature branch from `main`
2. Make changes and commit
3. Open PR to `main`
4. CI runs automatically (lint, test, build)
5. Preview environments are created
   - Frontend: `https://life-admin-app-pr-{number}-{hash}.vercel.app`
   - Backend: `https://life-admin-app-pr-{number}.up.railway.app`

### For Reviewers:
1. Check CI status (must be green)
2. Review code changes
3. Test on preview environment
4. Request changes or approve

### For Deployment:
1. PR approved + CI green
2. Merge to `main`
3. Production auto-deploys
4. Preview environments auto-deleted

## Environment Variables

### Required for PR Previews:
Backend (Railway):
- `DATABASE_URL` - automatically set by Railway
- `CLIENT_URL` - set to Vercel preview URL pattern
- `JWT_SECRET` - use different secret for previews
- `NODE_ENV=staging`

Frontend (Vercel):
- `VITE_API_URL` - set to Railway PR preview URL

### Setting Dynamic URLs:
Vercel provides these automatically:
- `VERCEL_URL` - current deployment URL
- `VERCEL_ENV` - environment type

Railway provides:
- `RAILWAY_ENVIRONMENT` - environment name
- Auto-generated URLs per PR

## Troubleshooting

### Preview environment not created
- Check Railway settings → PR deployments enabled
- Verify GitHub app permissions
- Check Railway build logs

### Database connection issues in preview
- Ensure ephemeral databases are enabled
- Check environment variables are set
- Verify network/CORS settings

### Frontend can't connect to backend preview
- Check `VITE_API_URL` points to Railway PR URL
- Verify CORS allows preview domains
- Check Railway service is running

## Cost Management

Preview environments on Railway:
- Only active while PR is open
- Auto-deleted on PR close or merge
- Database included in preview
- ~$0.01/hour per preview environment

Keep PRs short-lived to minimize costs.
