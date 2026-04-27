# Quick Start Guide

Get the backend running in 5 minutes!

## Prerequisites Check

```bash
# Check Node.js version (need 20+)
node --version

# Check npm
npm --version
```

If Node.js is not installed or version is too old:
- macOS: `brew install node@20`
- Windows: Download from https://nodejs.org/
- Ubuntu: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`

---

## 3-Step Setup (Docker)

### 1. Start PostgreSQL

```bash
docker run --name postgres-lifeadmin \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=lifeadmin \
  -p 5432:5432 \
  -d postgres:15

# Verify it's running
docker ps
```

### 2. Setup Backend

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### 3. Start Server

```bash
npm run dev
```

**Done!** Server running on http://localhost:3001

---

## Test It Works

```bash
# Health check
curl http://localhost:3001/health

# Login with test user
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Get subscriptions
curl http://localhost:3001/api/subscriptions -b cookies.txt
```

You should see 8 sample subscriptions!

---

## Alternative: No Docker?

### Install PostgreSQL Locally

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
createdb lifeadmin
```

**Ubuntu:**
```bash
sudo apt-get install postgresql-15
sudo systemctl start postgresql
sudo -u postgres createdb lifeadmin
```

**Windows:**
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install and start the service
3. Create database using pgAdmin or command line

Then follow steps 2-3 from above.

---

## Alternative: Cloud Database (Railway)

1. Go to https://railway.app/
2. Sign up (free tier)
3. New Project → Add PostgreSQL
4. Copy DATABASE_URL
5. Edit `server/.env` and paste the URL
6. Continue from step 2 above

---

## What's Running?

```
📡 API Server:  http://localhost:3001
📊 Health Check: http://localhost:3001/health
📝 API Docs:     server/README.md

Test User:
  📧 Email:    test@example.com
  🔑 Password: testpass123
```

---

## Prisma Studio (Database GUI)

View and edit data visually:

```bash
cd server
npm run prisma:studio
```

Opens at http://localhost:5555

---

## Stop Everything

```bash
# Stop server: Ctrl+C in the terminal

# Stop Docker database
docker stop postgres-lifeadmin

# Remove Docker database (if you want to start fresh)
docker rm postgres-lifeadmin
```

---

## Troubleshooting

### "Port 3001 already in use"

```bash
lsof -ti:3001 | xargs kill -9
```

### "Can't reach database server"

```bash
# Check Docker is running
docker ps

# Check database logs
docker logs postgres-lifeadmin

# Restart database
docker restart postgres-lifeadmin
```

### "Prisma Client not generated"

```bash
cd server
npm run prisma:generate
```

### Start Fresh

```bash
cd server
npx prisma migrate reset
npm run seed
```

---

## Next Steps

1. ✅ Backend running
2. ⬜ Push to GitHub (see GITHUB_SETUP.md)
3. ⬜ Build frontend (React + Vite)
4. ⬜ Deploy to production (Railway + Vercel)

---

## Full Documentation

- **API Endpoints:** `server/README.md`
- **Detailed Setup:** `SETUP.md`
- **GitHub Setup:** `GITHUB_SETUP.md`
- **What Was Built:** `DELIVERABLES.md`

---

**Need Help?**

Check the troubleshooting sections in `SETUP.md` or open a GitHub issue.

---

**Quick Start Complete!** 🚀

Now you have a fully functional subscription tracker API running locally.

Test the endpoints with curl, Postman, or start building the frontend!
