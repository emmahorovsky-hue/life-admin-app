# Quick Start: Deploy to Production in 10 Minutes

Follow these steps in order. Stop if you encounter errors.

## Prerequisites

✅ Railway CLI installed  
✅ Vercel CLI installed

Need accounts?
- Railway: https://railway.app (free tier available)
- Vercel: https://vercel.com (free tier available)

---

## Step 1: Deploy Backend to Railway (5 minutes)

### 1.1 Login
```bash
railway login
```
→ Browser opens, authorize the CLI

### 1.2 Run deployment script
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app
./scripts/deploy-backend.sh
```

The script will:
- Create Railway project
- Add PostgreSQL database
- Set environment variables
- Deploy your backend

### 1.3 Get your backend URL
```bash
cd server
railway domain
```

**Copy this URL** - you'll need it in Step 2!

Example: `https://life-admin-backend-production.up.railway.app`

---

## Step 2: Deploy Frontend to Vercel (5 minutes)

### 2.1 Login
```bash
vercel login
```
→ Check your email and verify

### 2.2 Update vercel.json with your Railway URL

Edit `/Users/anna/.openclaw/workspace/life-admin-app/client/vercel.json`:

Replace `https://life-admin-backend.up.railway.app` with YOUR actual Railway URL from Step 1.3

### 2.3 Deploy
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/client
vercel --prod
```

Answer the prompts:
- Setup and deploy? → **Y**
- Which scope? → (select your account)
- Link to existing project? → **N**
- Project name? → **life-admin-app**
- Directory? → **.**
- Override settings? → **N**

### 2.4 Get your frontend URL

The output will show something like:
```
https://life-admin-app.vercel.app
```

**Copy this URL** - you need it for Step 3!

---

## Step 3: Update CORS (1 minute)

Your backend needs to know about your frontend:

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway variables set CLIENT_URL="https://your-frontend-url-from-step-2.4.vercel.app"
railway up
```

⏳ Wait ~30 seconds for deployment to complete

---

## Step 4: Test Your App (2 minutes)

### 4.1 Open your frontend URL in browser

### 4.2 Test Registration
1. Click "Register" or "Sign Up"
2. Email: `test@example.com`
3. Password: `Test123!@#`
4. Name: `Test User`
5. Submit

✅ You should be redirected to the dashboard

### 4.3 Test Adding a Subscription
1. Click "Add Subscription"
2. Fill in:
   - Name: Netflix
   - Cost: 15.99
   - Currency: USD
   - Billing Cycle: Monthly
   - Renewal Date: (pick a future date)
   - Category: Streaming
3. Submit

✅ Subscription appears in your dashboard

### 4.4 Test Data Persistence
1. Logout
2. Login with same credentials
3. Your subscription is still there

✅ **You're done!** 🎉

---

## Your Production URLs

Save these for reference:

**Backend (Railway):**
```
https://_____________________________.up.railway.app
```

**Frontend (Vercel):**
```
https://_____________________________.vercel.app
```

---

## Troubleshooting

### Backend won't start
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway logs
```
Look for error messages. Common issues:
- Missing DATABASE_URL → Run `railway add` and select PostgreSQL
- Missing environment variables → Check with `railway variables`

### Frontend shows "Network Error"
- Check vercel.json has the correct Railway URL
- Verify CLIENT_URL is set in Railway backend
- Check CORS errors in browser console

### Login doesn't work
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway variables
```
Ensure JWT_SECRET is set. If not:
```bash
railway variables set JWT_SECRET="$(openssl rand -base64 32)"
railway up
```

### Still stuck?
Check the full guide: `DEPLOYMENT_GUIDE.md`

---

## What's Next?

- [ ] Document your URLs in `DEPLOYMENT_COMPLETE.md`
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring/alerts
- [ ] Connect GitHub for auto-deployments
- [ ] Share with your team!

---

## Quick Command Reference

```bash
# View backend logs
cd server && railway logs

# View frontend logs
cd client && vercel logs

# Check backend variables
cd server && railway variables

# Redeploy backend
cd server && railway up

# Redeploy frontend
cd client && vercel --prod
```

---

Need the detailed guide? See `DEPLOYMENT_GUIDE.md`
