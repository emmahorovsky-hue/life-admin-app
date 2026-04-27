# Life Admin App - Quick Start Guide

## 🚀 Get Running in 2 Minutes

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Step 1: Clone and Setup
```bash
cd /Users/anna/.openclaw/workspace/life-admin-app
```

### Step 2: Backend Setup
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run prisma:generate
npm run prisma:migrate
npm run seed  # Optional: Creates test user
npm run dev   # Runs on http://localhost:3001
```

### Step 3: Frontend Setup (New Terminal)
```bash
cd client
npm install
npm run dev   # Runs on http://localhost:3000
```

### Step 4: Test the App
1. Open http://localhost:3000
2. Register a new account
3. Add your first subscription
4. View the dashboard

## Test User (if seeded)
- Email: test@example.com
- Password: testpass123

## Project Structure
```
life-admin-app/
├── server/          # Express + Prisma backend (port 3001)
├── client/          # React + Vite frontend (port 3000)
├── FRONTEND-COMPLETE.md    # Detailed frontend docs
└── QUICKSTART.md           # This file
```

## Key Features
- ✅ User authentication (JWT cookies)
- ✅ Subscription CRUD
- ✅ Dashboard with spending insights
- ✅ Category breakdown chart
- ✅ Upcoming renewal reminders
- ✅ Search & filter
- ✅ Mobile responsive

## Tech Stack
**Backend:** Node.js + Express + TypeScript + Prisma + PostgreSQL
**Frontend:** React + TypeScript + Vite + TailwindCSS + shadcn/ui

## API Docs
See `server/README.md` for full API documentation.

## Deployment
**Backend:** Railway (with PostgreSQL)
**Frontend:** Vercel

See technical spec for detailed deployment instructions.

## Troubleshooting

**Backend won't start:**
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Run `npm run prisma:generate`

**Frontend won't start:**
- Check Node.js version (20+)
- Delete node_modules and npm install again
- Check if port 3000 is available

**API errors:**
- Ensure backend is running on port 3001
- Check browser console for errors
- Verify CORS is configured correctly

## Next Steps
1. Add more subscriptions
2. Explore the dashboard
3. Test on mobile devices
4. Deploy to production

## Documentation
- Backend: `server/README.md`
- Frontend: `client/README.md`
- Complete report: `FRONTEND-COMPLETE.md`
- Technical spec: `life-admin-app-technical-spec.md`
- Design spec: `life-admin-app-design-spec.md`

---

**Status:** ✅ MVP Complete - Ready for production deployment
