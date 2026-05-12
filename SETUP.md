# Setup Guide - Life Admin App

Complete setup instructions for development and deployment.

## Development Setup

### 1. Prerequisites

Install the following on your development machine:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **PostgreSQL 15+** - Choose one:
  - [Local Install](https://www.postgresql.org/download/)
  - [Docker](https://www.docker.com/) (recommended for quick start)
  - [Railway](https://railway.app/) (cloud database)
- **Git** - [Download](https://git-scm.com/)

### 2. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/life-admin-app.git
cd life-admin-app
```

### 3. Backend Setup

#### Install Dependencies

```bash
cd server
npm install
```

#### Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and update:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
JWT_SECRET="your-generated-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="development"
CLIENT_URL="http://localhost:3000"
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
```

#### Setup PostgreSQL Database

Choose one of the following options:

**Option A: Docker (Easiest)**

```bash
# Start PostgreSQL container
docker run --name postgres-lifeadmin \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=lifeadmin \
  -p 5432:5432 \
  -d postgres:15

# Verify it's running
docker ps
```

Update `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lifeadmin?schema=public"
```

**Option B: Local PostgreSQL**

```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql-15
sudo systemctl start postgresql

# Create database
createdb lifeadmin

# Or with psql
psql -U postgres
CREATE DATABASE lifeadmin;
\q
```

Update `.env` with your local credentials.

**Option C: Railway Cloud Database**

1. Go to [Railway.app](https://railway.app/)
2. Create account (free tier available)
3. Create new project → Add PostgreSQL
4. Copy connection string
5. Update `.env` with Railway DATABASE_URL

#### Run Database Migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

You should see:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your schema
```

#### Seed Database (Optional)

```bash
npm run seed
```

Creates:
- Test user: `test@example.com` / `testpass123`
- 8 sample subscriptions

#### Start Development Server

```bash
npm run dev
```

Server runs on http://localhost:3001

#### Verify Installation

Test health endpoint:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-04-28T..."
}
```

Test login:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### 4. Frontend Setup (Coming Soon)

```bash
cd client
npm install
npm run dev
```

Frontend will run on http://localhost:3000

---

## Production Deployment

### Deploy Backend to Railway

#### 1. Create Railway Account

Go to [Railway.app](https://railway.app/) and sign up.

#### 2. Create New Project

- Click "New Project"
- Select "Deploy from GitHub repo"
- Connect your GitHub account
- Select `life-admin-app` repository

#### 3. Add PostgreSQL Database

- Click "New" → "Database" → "PostgreSQL"
- Railway automatically provisions a database
- Copy the `DATABASE_URL` connection string

#### 4. Configure Environment Variables

In Railway dashboard, add these variables:

```env
DATABASE_URL=<paste from Railway PostgreSQL>
JWT_SECRET=<your-generated-secret>
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
CLIENT_URL=https://your-frontend-domain.vercel.app
```

#### 5. Configure Build Settings

**Root Directory:** `server`

**Build Command:**
```bash
npm install && npm run build && npm run prisma:generate
```

**Start Command:**
```bash
npm start
```

**Install Command:**
```bash
npm install
```

#### 6. Deploy

- Push to `main` branch
- Railway auto-deploys
- Get your backend URL: `https://life-admin-app-production.up.railway.app`

#### 7. Run Migrations (First Deploy)

In Railway dashboard:
- Open your service
- Click "Settings" → "Deploy"
- Add custom deploy command:
```bash
npm run prisma:migrate deploy
```

Or use Railway CLI:
```bash
railway run npm run prisma:migrate deploy
```

### Deploy Frontend to Vercel

#### 1. Create Vercel Account

Go to [Vercel.com](https://vercel.com/) and sign up.

#### 2. Import Project

- Click "New Project"
- Import `life-admin-app` from GitHub
- Framework Preset: Vite
- Root Directory: `client`

#### 3. Configure Environment Variables

Add in Vercel dashboard:

```env
VITE_API_URL=https://your-backend.railway.app
```

#### 4. Deploy

- Push to `main` branch
- Vercel auto-deploys
- Get your frontend URL: `https://life-admin-app.vercel.app`

#### 5. Update Backend CORS

Update your Railway environment variables:
```env
CLIENT_URL=https://life-admin-app.vercel.app
```

Redeploy backend.

---

## Database Management

### Prisma Studio (GUI)

```bash
cd server
npm run prisma:studio
```

Opens at http://localhost:5555

### Create New Migration

After changing `schema.prisma`:

```bash
npm run prisma:migrate dev --name description-of-change
```

### Reset Database (Development)

**⚠️ Warning: This deletes all data!**

```bash
npx prisma migrate reset
npm run seed
```

### View Database

**Local PostgreSQL:**
```bash
psql -d lifeadmin
\dt          # List tables
\d users     # Describe users table
SELECT * FROM "User" LIMIT 5;
```

**Docker:**
```bash
docker exec -it postgres-lifeadmin psql -U postgres -d lifeadmin
```

---

## Troubleshooting

### "Error: P1001: Can't reach database server"

**Solution:**
- Check PostgreSQL is running: `docker ps` or `brew services list`
- Verify DATABASE_URL in `.env`
- Check port 5432 is not blocked
- Try connecting with `psql`: `psql -d lifeadmin`

### "Prisma Client is not generated"

**Solution:**
```bash
npm run prisma:generate
```

### "Migration failed"

**Solution:**
```bash
# Reset and try again
npx prisma migrate reset
npm run prisma:migrate
```

### "CORS error in frontend"

**Solution:**
- Check `CLIENT_URL` in backend `.env`
- Verify backend CORS middleware is configured
- Check browser console for exact error

### "JWT token not working"

**Solution:**
- Check `JWT_SECRET` is set in `.env`
- Verify cookies are enabled in browser
- Check cookie settings in production (secure flag)

### "Port 3001 already in use"

**Solution:**
```bash
# Find process using port
lsof -ti:3001

# Kill process
kill -9 <PID>

# Or change PORT in .env
PORT=3002
```

---

## Useful Commands

### Development

```bash
# Start dev server with logs
npm run dev | bunyan  # If using bunyan logger

# Watch database changes
npx prisma studio

# Run TypeScript compiler check
npx tsc --noEmit

# Format code (if Prettier configured)
npx prettier --write "src/**/*.ts"
```

### Database

```bash
# Generate Prisma client
npm run prisma:generate

# Create new migration
npx prisma migrate dev --name add_new_field

# Deploy migrations (production)
npx prisma migrate deploy

# View migration status
npx prisma migrate status

# Reset database (dev only)
npx prisma migrate reset

# Seed database
npm run seed

# Open Prisma Studio
npm run prisma:studio
```

### Testing

```bash
# Test auth endpoints
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test"}'

# Login and save cookies
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Get current user (with cookies)
curl http://localhost:3001/api/auth/me -b cookies.txt

# Create subscription
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Test Sub",
    "cost": 9.99,
    "billingCycle": "monthly",
    "renewalDate": "2026-05-15",
    "category": "streaming"
  }'

# Get subscriptions
curl http://localhost:3001/api/subscriptions -b cookies.txt

# Get dashboard
curl http://localhost:3001/api/dashboard/summary -b cookies.txt
```

---

## CI/CD (Optional)

### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Test Backend

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: lifeadmin_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd server
          npm install
      
      - name: Run migrations
        run: |
          cd server
          npm run prisma:generate
          npm run prisma:migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/lifeadmin_test
      
      - name: Run tests
        run: |
          cd server
          npm test
```

---

## Next Steps

1. ✅ Backend setup complete
2. ⬜ Frontend React app (Week 1, Days 5-7)
3. ⬜ Email reminders (Week 2)
4. ⬜ Deploy to production (Week 2)
5. ⬜ Custom domain setup (Week 2)

---

## Support

- **Issues:** Open GitHub issue
- **Documentation:** See `server/README.md` for API docs
- **Technical Spec:** See root `life-admin-app-technical-spec.md`

---

**Last Updated:** 2026-04-28
