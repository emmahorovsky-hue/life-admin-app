# 🚀 DEPLOYMENT INSTRUCTIONS - START HERE

**Ready to deploy your Life Admin App to production?**

This document gives you the exact steps to follow.

---

## 🎯 What You're About to Do

Deploy your full-stack subscription tracker app to production:
- **Backend** → Railway (Free hosting + PostgreSQL database)
- **Frontend** → Vercel (Free hosting + CDN)
- **Time needed** → ~15 minutes

---

## ✅ Prerequisites

### You Need:
1. **Railway account** - Get one at https://railway.app (free tier available)
2. **Vercel account** - Get one at https://vercel.com (free tier available)
3. **Your terminal** - The CLIs are already installed ✅

### Already Done for You:
- ✅ Railway CLI installed
- ✅ Vercel CLI installed
- ✅ Deployment scripts created
- ✅ Configuration files ready

---

## 🚦 STEP-BY-STEP DEPLOYMENT

### Step 0: Pre-Flight Check (Optional but Recommended)

Run this to make sure everything is ready:

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app
./scripts/preflight-check.sh
```

This checks:
- CLI tools installed
- Dependencies ready
- Authentication status
- Project structure

---

### Step 1: Authenticate with Railway (2 minutes)

```bash
railway login
```

- This opens your browser
- Click "Login" and authorize
- Come back to terminal when done

**Verify authentication:**
```bash
railway whoami
```

You should see your Railway username.

---

### Step 2: Deploy Backend to Railway (5 minutes)

You have two options:

#### Option A: Automated Script (Recommended)
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app
./scripts/deploy-backend.sh
```

The script will:
1. Create Railway project
2. Add PostgreSQL database
3. Set environment variables
4. Deploy your backend

#### Option B: Manual Steps

Follow the manual steps in **DEPLOYMENT_QUICKSTART.md** sections 1.1-1.7

---

**After deployment, get your backend URL:**

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway domain
```

**Copy this URL!** Example: `https://life-admin-backend-production.up.railway.app`

---

### Step 3: Authenticate with Vercel (2 minutes)

```bash
vercel login
```

- You'll receive an email
- Click the verification link
- Come back to terminal

**Verify authentication:**
```bash
vercel whoami
```

You should see your Vercel username.

---

### Step 4: Update Frontend Configuration (1 minute)

**IMPORTANT:** Update the API URL in your frontend config.

Edit this file:
```
/Users/anna/.openclaw/workspace/life-admin-app/client/vercel.json
```

Find this line (around line 5):
```json
"destination": "https://life-admin-backend.up.railway.app/api/:path*"
```

Replace `https://life-admin-backend.up.railway.app` with **YOUR actual Railway URL** from Step 2.

---

### Step 5: Deploy Frontend to Vercel (3 minutes)

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/client
vercel --prod
```

**Answer the prompts:**
- Set up and deploy? → **Y**
- Which scope? → (select your account)
- Link to existing project? → **N**
- Project name? → **life-admin-app** (or your preferred name)
- Directory? → **./** (just press Enter)
- Override settings? → **N**

Wait for deployment to complete (~1-2 minutes).

---

**After deployment, note your frontend URL:**

Example: `https://life-admin-app.vercel.app`

---

### Step 6: Update Backend CORS (1 minute)

Your backend needs to allow requests from your frontend:

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app/server
railway variables set CLIENT_URL="https://your-actual-frontend-url.vercel.app"
```

**Replace the URL above with YOUR actual Vercel URL from Step 5!**

Then redeploy:
```bash
railway up
```

Wait ~30 seconds for redeployment.

---

### Step 7: Test Your Deployment (3 minutes)

#### 7.1 Test Backend Health

```bash
curl https://YOUR_RAILWAY_URL/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2026-04-28T11:30:00.000Z"}
```

If you get this, your backend is working! ✅

#### 7.2 Test Frontend

Open your Vercel URL in a web browser:
```
https://your-frontend-url.vercel.app
```

You should see the Life Admin App login/register page.

#### 7.3 Test Registration

1. Click "Register" or "Sign Up"
2. Fill in:
   - **Email:** test@example.com
   - **Password:** Test123!@#
   - **Name:** Test User
3. Click Submit

**Expected:** You're redirected to an empty dashboard.

#### 7.4 Test Adding a Subscription

1. Click "Add Subscription"
2. Fill in:
   - **Name:** Netflix
   - **Cost:** 15.99
   - **Currency:** USD
   - **Billing Cycle:** Monthly
   - **Renewal Date:** (pick any future date)
   - **Category:** Streaming
3. Submit

**Expected:** Subscription appears in your dashboard.

#### 7.5 Test Data Persistence

1. Click "Logout"
2. Log back in with:
   - Email: test@example.com
   - Password: Test123!@#
3. Check your dashboard

**Expected:** Your Netflix subscription is still there! ✅

---

## 🎉 SUCCESS!

If all tests passed, your app is live and working!

### Your Production URLs:

**Frontend (users will visit):**
```
https://___________________________.vercel.app
```

**Backend (API):**
```
https://___________________________.up.railway.app
```

---

## 📝 Document Your Deployment

Fill out this file with your deployment details:
```
DEPLOYMENT_COMPLETE.md
```

Include:
- Your production URLs
- Deployment date
- Any issues you encountered
- Test results

---

## ❌ Troubleshooting

### Backend Issues

**Problem:** Backend health check fails
```bash
cd server
railway logs
```
Look for error messages. Common issues:
- Database not connected → Check `railway variables` for DATABASE_URL
- Migrations failed → Check logs for Prisma errors

**Problem:** Backend won't start
```bash
railway variables
```
Ensure these are set:
- DATABASE_URL
- JWT_SECRET
- NODE_ENV
- PORT
- CLIENT_URL

### Frontend Issues

**Problem:** Blank page or "Network Error"
1. Check browser console for errors (F12 → Console tab)
2. Verify `vercel.json` has correct Railway URL
3. Check CORS:
   ```bash
   cd server
   railway variables
   ```
   Ensure CLIENT_URL matches your Vercel URL exactly

**Problem:** Login doesn't work
```bash
cd server
railway variables
```
Check that JWT_SECRET is set. If not:
```bash
railway variables set JWT_SECRET="$(openssl rand -base64 32)"
railway up
```

### CORS Errors

**Symptom:** Login/register fails with "CORS policy" error in browser console

**Fix:**
```bash
cd server
railway variables set CLIENT_URL="https://your-exact-vercel-url.vercel.app"
railway up
```

Make sure:
- No trailing slash in CLIENT_URL
- Exact match with your Vercel URL
- Includes `https://`

### Still Stuck?

1. Check detailed docs: **DEPLOYMENT_GUIDE.md**
2. Run pre-flight check: `./scripts/preflight-check.sh`
3. Check both service logs:
   ```bash
   railway logs    # Backend
   vercel logs     # Frontend
   ```

---

## 📚 Additional Resources

- **Quick Reference:** DEPLOYMENT_QUICKSTART.md
- **Detailed Guide:** DEPLOYMENT_GUIDE.md
- **Progress Tracker:** DEPLOYMENT_CHECKLIST.md
- **Post-Deployment:** DEPLOYMENT_COMPLETE.md
- **Overview:** DEPLOYMENT_README.md

---

## 🔄 Redeployment (After Code Changes)

### Backend Changes
```bash
cd server
git add .
git commit -m "Your changes"
railway up
```

### Frontend Changes
```bash
cd client
git add .
git commit -m "Your changes"
vercel --prod
```

---

## 💡 Pro Tips

1. **Save your URLs** - You'll need them often
2. **Keep credentials secure** - Never commit .env files
3. **Monitor logs** - Check Railway and Vercel dashboards regularly
4. **Use Git tags** - Tag your production releases
5. **Test before deploying** - Always test locally first

---

## 🆘 Need More Help?

### Platform Documentation
- Railway: https://docs.railway.app
- Vercel: https://vercel.com/docs
- Prisma: https://www.prisma.io/docs

### View Logs
```bash
# Backend logs
cd server && railway logs

# Frontend logs  
cd client && vercel logs

# Database console
cd server && railway run prisma studio
```

---

## ✨ You're All Set!

Your Life Admin App is now live in production! 🎉

**What's next?**
- Share the URL with users
- Monitor usage and costs
- Set up custom domain (optional)
- Configure CI/CD for automatic deployments
- Add monitoring and alerts

**Questions?** Check the documentation files or review the logs.

---

**Happy deploying!** 🚀

---

**Created:** 2026-04-28  
**For:** Anna & Tomasz  
**Project:** Life Admin App  
**Deployment:** Railway + Vercel
