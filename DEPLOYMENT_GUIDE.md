# Life Admin App - Production Deployment Guide

## Overview
This guide will walk you through deploying the Life Admin App to production:
- **Backend**: Railway (Express + PostgreSQL)
- **Frontend**: Vercel (React + Vite)

## Prerequisites Checklist

### Required Accounts (Free Tier Available)
- [ ] Railway account (https://railway.app/)
- [ ] Vercel account (https://vercel.com/)
- [ ] GitHub account (for connecting repositories - optional but recommended)

### CLIs Installed ✅
- [x] Railway CLI (`railway`)
- [x] Vercel CLI (`vercel`)

---

## Step 1: Railway Authentication & Backend Deployment

### 1.1 Login to Railway
```bash
railway login
```
This will open your browser for authentication. Follow the prompts to authorize the CLI.

### 1.2 Initialize Railway Project
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway init
```
- Choose "Create a new project"
- Name it: `life-admin-backend`
- Select your environment: `production`

### 1.3 Add PostgreSQL Database
```bash
railway add
```
- Select: **PostgreSQL**
- Wait for provisioning to complete (~30 seconds)

### 1.4 Set Environment Variables
```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Set environment variables
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set JWT_EXPIRES_IN="7d"
railway variables set NODE_ENV="production"
railway variables set PORT="3001"
```

**Important:** Railway automatically provides `DATABASE_URL` from the PostgreSQL addon. You don't need to set it manually.

### 1.5 Deploy Backend
```bash
railway up
```
This will:
1. Build your TypeScript code
2. Generate Prisma client
3. Run database migrations
4. Start the server

### 1.6 Get Backend URL
```bash
railway domain
```
Copy the generated URL (e.g., `https://life-admin-backend-production.up.railway.app`)

### 1.7 Update CORS Settings
```bash
# You'll need to set this after deploying the frontend
# We'll come back to this in Step 2.7
```

---

## Step 2: Vercel Authentication & Frontend Deployment

### 2.1 Login to Vercel
```bash
vercel login
```
Follow the email verification process.

### 2.2 Update Frontend API Configuration
Edit `/Users/anna/.openclaw/workspace/life-admin-app/client/vercel.json` and replace the placeholder URL with your actual Railway backend URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "YOUR_RAILWAY_URL/api/:path*"
    },
    ...
  ]
}
```

### 2.3 Deploy Frontend (First Time)
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/client
vercel
```

Answer the prompts:
- Set up and deploy? **Y**
- Which scope? (Select your account)
- Link to existing project? **N**
- What's your project's name? `life-admin-app`
- In which directory is your code located? `./`
- Want to override settings? **N**

### 2.4 Deploy to Production
```bash
vercel --prod
```

### 2.5 Get Frontend URL
The command output will show your production URL (e.g., `https://life-admin-app.vercel.app`)

### 2.6 Set Frontend Environment Variables (Optional)
```bash
vercel env add VITE_API_URL production
# When prompted, enter: /api
```

### 2.7 Update Backend CORS Settings
Now that you have your frontend URL, update the Railway backend:

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway variables set CLIENT_URL="https://life-admin-app.vercel.app"
railway up
```

---

## Step 3: Integration Testing

### 3.1 Test Backend Health
```bash
curl https://YOUR_RAILWAY_URL/health
```
Expected: `{"status":"ok","timestamp":"..."}`

### 3.2 Test Frontend
Open your Vercel URL in a browser: `https://life-admin-app.vercel.app`

### 3.3 Test Full Registration Flow
1. Navigate to your frontend URL
2. Click "Register" or "Sign Up"
3. Fill in:
   - Email: `test@example.com`
   - Password: `Test123!@#`
   - Name: `Test User`
4. Submit the form
5. Verify you're redirected to dashboard

### 3.4 Test Login Flow
1. Logout (if logged in)
2. Click "Login"
3. Enter the credentials from 3.3
4. Verify successful login and redirect to dashboard

### 3.5 Test Adding a Subscription
1. From the dashboard, click "Add Subscription"
2. Fill in:
   - Name: `Netflix`
   - Cost: `15.99`
   - Currency: `USD`
   - Billing Cycle: `Monthly`
   - Renewal Date: (pick a future date)
   - Category: `Streaming`
3. Submit and verify it appears in your dashboard

### 3.6 Verify Data Persistence
1. Logout
2. Login again
3. Verify your subscription is still there

---

## Step 4: Database Verification

### 4.1 Check Railway Logs
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway logs
```
Look for:
- `🚀 Server running on port 3001`
- Successful migration messages
- No error stack traces

### 4.2 Access Database Console (Optional)
```bash
railway run prisma studio
```
This opens a browser interface to view your production database.

---

## Troubleshooting

### Backend Issues

**Problem**: `DATABASE_URL` not found
**Solution**: 
```bash
railway variables
# Verify DATABASE_URL exists
# If not, ensure PostgreSQL addon is installed
railway add # Select PostgreSQL
```

**Problem**: Migrations fail
**Solution**:
```bash
railway run npx prisma migrate reset --force
railway up
```

**Problem**: Server not responding
**Solution**:
```bash
railway logs --tail
# Check for errors
```

### Frontend Issues

**Problem**: API calls fail (CORS errors)
**Solution**: Verify `CLIENT_URL` in Railway matches your Vercel URL exactly (including https://)

**Problem**: 404 on routes
**Solution**: Verify `vercel.json` has the correct rewrites configuration

**Problem**: Blank page
**Solution**: 
```bash
vercel logs
# Check for build errors
```

### Authentication Issues

**Problem**: Can't login after deployment
**Solution**: Ensure `JWT_SECRET` is set in Railway:
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway variables
```

---

## Environment Variables Reference

### Railway Backend Variables
```bash
DATABASE_URL        # Auto-set by PostgreSQL addon
JWT_SECRET          # Your secure secret
JWT_EXPIRES_IN      # "7d"
NODE_ENV           # "production"
PORT               # "3001"
CLIENT_URL         # Your Vercel frontend URL
```

### Vercel Frontend Variables (Optional)
```bash
VITE_API_URL       # "/api"
```

---

## Useful Commands

### Railway
```bash
railway link          # Link to existing project
railway variables     # List all environment variables
railway logs          # View server logs
railway run           # Run commands in Railway environment
railway status        # Check deployment status
```

### Vercel
```bash
vercel               # Deploy to preview
vercel --prod        # Deploy to production
vercel logs          # View logs
vercel domains       # Manage custom domains
vercel env ls        # List environment variables
```

---

## Security Checklist

- [ ] JWT_SECRET is cryptographically secure (32+ characters)
- [ ] DATABASE_URL is not exposed in frontend code
- [ ] CORS is configured with specific frontend URL (not wildcard in production)
- [ ] Rate limiting is enabled (already configured in backend)
- [ ] Passwords are hashed (bcrypt - already configured)
- [ ] Environment variables are set via CLI/dashboard (not committed to git)

---

## Next Steps After Deployment

1. **Custom Domain** (Optional)
   - Railway: `railway domain add your-api.yourdomain.com`
   - Vercel: Add custom domain through dashboard

2. **Monitoring**
   - Railway: Built-in metrics in dashboard
   - Vercel: Analytics available in dashboard

3. **Backups**
   - Railway PostgreSQL includes automatic backups
   - Verify in Railway dashboard → Database → Backups

4. **CI/CD** (Optional)
   - Connect GitHub repository for automatic deployments
   - Railway: Settings → GitHub → Connect repo
   - Vercel: Settings → Git → Connect repo

---

## Cost Estimates (Free Tier Limits)

### Railway Free Tier
- $5 of free usage per month
- ~500 hours of execution time
- Suitable for MVP/testing

### Vercel Free Tier
- 100 GB bandwidth per month
- Unlimited deployments
- 100 build executions per day

**Recommendation**: Monitor usage in first month to estimate costs.

---

## Support Resources

- Railway Docs: https://docs.railway.app/
- Vercel Docs: https://vercel.com/docs
- Prisma Docs: https://www.prisma.io/docs

---

**Ready to deploy?** Start with Step 1! 🚀
