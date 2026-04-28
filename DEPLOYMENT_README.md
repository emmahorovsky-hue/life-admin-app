# Production Deployment - Life Admin App

This folder contains everything you need to deploy the Life Admin App to production.

## 📚 Documentation Index

### For Quick Deployment (Recommended)
1. **[DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md)** - Deploy in 10 minutes
   - Step-by-step with exact commands
   - Perfect for first-time deployment

### For Detailed Understanding
2. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete deployment guide
   - Full explanations of each step
   - Troubleshooting section
   - Environment variables reference
   - Security checklist

### For Tracking Progress
3. **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Track your progress
   - Checkbox format
   - Document URLs and credentials
   - Post-deployment tasks

### After Successful Deployment
4. **[DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md)** - Fill this out after deployment
   - Document production URLs
   - Record environment variables
   - Track issues and resolutions
   - Maintenance commands reference

## 🚀 Quick Start

### Option 1: Automated Scripts (Easiest)

```bash
# 1. Check if you're ready to deploy
./scripts/preflight-check.sh

# 2. Deploy backend to Railway
./scripts/deploy-backend.sh

# 3. Deploy frontend to Vercel
./scripts/deploy-frontend.sh
```

### Option 2: Manual Deployment

Follow **[DEPLOYMENT_QUICKSTART.md](DEPLOYMENT_QUICKSTART.md)** for manual step-by-step instructions.

## 📋 Pre-Deployment Checklist

Before you start:

- [ ] You have a Railway account (or can create one)
- [ ] You have a Vercel account (or can create one)
- [ ] You've tested the app locally
- [ ] You've read through DEPLOYMENT_QUICKSTART.md

## 🛠️ What Gets Deployed

### Backend (Railway)
- Express.js API server
- PostgreSQL database
- Prisma ORM with migrations
- JWT authentication
- Rate limiting
- CORS protection

**Environment:**
- Node.js runtime
- Automatic HTTPS
- Continuous deployment (optional)

### Frontend (Vercel)
- React SPA with Vite
- TailwindCSS styling
- Client-side routing
- API proxy to Railway backend

**Environment:**
- Edge network (CDN)
- Automatic HTTPS
- Serverless functions (if needed)

## 📊 Architecture

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  Vercel CDN     │ Frontend (React + Vite)
│  /api/* proxy   │────────┐
└─────────────────┘        │ HTTPS
                           │
                           ▼
                    ┌──────────────┐
                    │   Railway    │ Backend (Express)
                    │  PostgreSQL  │ Database (Prisma)
                    └──────────────┘
```

## 🔑 Required Environment Variables

### Railway Backend
```bash
DATABASE_URL       # Auto-set by Railway PostgreSQL addon
JWT_SECRET         # Generated during deployment
JWT_EXPIRES_IN     # Set to "7d"
NODE_ENV          # Set to "production"
PORT              # Set to "3001"
CLIENT_URL        # Your Vercel frontend URL
```

### Vercel Frontend
```bash
VITE_API_URL      # Set to "/api" (proxied to Railway)
```

## ⏱️ Estimated Deployment Time

- **Pre-flight checks:** 2 minutes
- **Backend deployment:** 5-7 minutes
  - Railway setup: 2 min
  - Database provisioning: 1 min
  - Build & deploy: 2-4 min
- **Frontend deployment:** 3-5 minutes
  - Vercel setup: 1 min
  - Build & deploy: 2-4 min
- **Testing:** 2-3 minutes

**Total: ~15 minutes** (first time)

Subsequent deployments: ~2-3 minutes each

## 🧪 Testing Strategy

After deployment, test in this order:

1. **Backend Health Check**
   ```bash
   curl https://your-backend.railway.app/health
   ```

2. **Frontend Loading**
   - Open browser to Vercel URL
   - Check console for errors

3. **Registration Flow**
   - Create test account
   - Verify redirect to dashboard

4. **Login Flow**
   - Logout
   - Login with test account

5. **CRUD Operations**
   - Add subscription
   - Edit subscription
   - Delete subscription

6. **Data Persistence**
   - Logout and login
   - Verify data still exists

## 🚨 Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Backend won't start | Check `railway logs` for errors |
| Frontend 404 errors | Verify `vercel.json` rewrites |
| CORS errors | Update CLIENT_URL in Railway |
| Login doesn't work | Check JWT_SECRET is set |
| Database errors | Verify PostgreSQL addon installed |

Full troubleshooting: See **DEPLOYMENT_GUIDE.md**

## 📈 Free Tier Limits

### Railway
- $5/month free usage
- ~500 hours execution time
- Good for MVPs and testing

### Vercel
- 100 GB bandwidth/month
- Unlimited deployments
- Perfect for hobby projects

**Cost after free tier:**
- Railway: Pay-as-you-go (~$5-20/month for small apps)
- Vercel: Pay-as-you-go (~$20/month Pro plan)

## 🔒 Security Best Practices

✅ Implemented:
- JWT authentication
- Password hashing (bcrypt)
- CORS protection
- Rate limiting
- HTTPS everywhere
- Environment variables (not in code)

⚠️ Recommended:
- Enable 2FA on Railway and Vercel
- Rotate JWT_SECRET periodically
- Monitor logs for suspicious activity
- Set up alerts for errors

## 📞 Need Help?

1. **Check logs first:**
   ```bash
   railway logs    # Backend
   vercel logs     # Frontend
   ```

2. **Review documentation:**
   - DEPLOYMENT_GUIDE.md (detailed)
   - DEPLOYMENT_QUICKSTART.md (quick reference)

3. **Pre-flight check:**
   ```bash
   ./scripts/preflight-check.sh
   ```

4. **Platform docs:**
   - Railway: https://docs.railway.app
   - Vercel: https://vercel.com/docs

## 🎯 Success Criteria

Your deployment is successful when:

- ✅ Backend health check returns 200 OK
- ✅ Frontend loads without console errors
- ✅ User can register and login
- ✅ User can add/edit/delete subscriptions
- ✅ Data persists across sessions
- ✅ CORS is working (no CORS errors)
- ✅ HTTPS is enabled on both services

## 📝 Post-Deployment

After successful deployment:

1. Fill out **DEPLOYMENT_COMPLETE.md**
2. Save your production URLs
3. Document any issues encountered
4. Set up monitoring (optional)
5. Create backup strategy
6. Share access with your team

## 🔄 Continuous Deployment (Optional)

Want automatic deployments on git push?

### Railway (Backend)
1. Go to Railway dashboard
2. Settings → Connect to GitHub
3. Select repository and branch
4. Enable automatic deployments

### Vercel (Frontend)
1. Go to Vercel dashboard
2. Settings → Git → Connect to GitHub
3. Select repository and branch
4. Automatic by default

## 🛡️ Backup Strategy

### Database Backups (Railway)
- Automatic daily backups
- Check: Railway Dashboard → Database → Backups
- Retention: 7 days on free tier

### Code Backups
- Use Git for version control
- Tag production releases
- Keep main branch stable

## 📊 Monitoring

### Railway
- Metrics: CPU, Memory, Network
- Logs: Real-time via CLI or dashboard
- Alerts: Configure in dashboard

### Vercel
- Analytics: Page views, performance
- Logs: Build and runtime logs
- Error tracking: Third-party integration

## 🚀 Ready to Deploy?

```bash
# Start here:
./scripts/preflight-check.sh

# Then follow:
DEPLOYMENT_QUICKSTART.md
```

Good luck! 🎉

---

**Last Updated:** 2026-04-28  
**Version:** 1.0.0  
**Deployment Target:** Railway + Vercel
