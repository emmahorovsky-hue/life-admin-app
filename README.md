# Life Admin App

A modern subscription tracker application to help users manage and monitor their recurring subscriptions.

**[📚 Full Documentation Hub](docs/INDEX.md)** — Start here for guides by role.

## Quick Start

### Run Locally

**Prerequisites:** Node.js 20+, PostgreSQL 15+

```bash
# Backend
cd server
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run prisma:migrate
npm run seed
npm run dev

# Frontend (in another terminal)
cd client
npm install
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000

**Test credentials:** `test@example.com` / `testpass123`

## Tech Stack

**Backend:** Node.js 20 + Express + TypeScript + Prisma + PostgreSQL  
**Frontend:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui  
**Hosting:** Railway (backend) + Vercel (frontend)

## Documentation

| For | Start With |
|-----|-----------|
| **Getting Started** | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| **System Architecture** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Security & Auth** | [docs/SECURITY.md](docs/SECURITY.md) |
| **Backend Setup** | [server/README.md](server/README.md) |
| **API Reference** | [server/docs/API.md](server/docs/API.md) |
| **Database Schema** | [server/docs/DATABASE.md](server/docs/DATABASE.md) |
| **Frontend Setup** | [client/README.md](client/README.md) |
| **Components** | [client/docs/COMPONENTS.md](client/docs/COMPONENTS.md) |
| **Design System** | [client/docs/STYLING.md](client/docs/STYLING.md) |
| **Production Deploy** | [DEPLOYMENT.md](DEPLOYMENT.md) |
| **Contributing** | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Features Implemented ✅

- User registration & authentication (JWT + httpOnly cookies)
- Subscription CRUD operations
- Dashboard with spending summaries
- Upcoming renewals tracking
- Category management & filtering
- Input validation & rate limiting
- PostgreSQL database with Prisma ORM
- Production-ready deployment setup

## Project Structure

```
life-admin-app/
├── server/                    # Express API + TypeScript
│   ├── src/                   # Controllers, routes, middleware
│   ├── prisma/                # Database schema & migrations
│   ├── docs/                  # API & Database documentation
│   └── README.md
│
├── client/                    # React + Vite frontend
│   ├── src/                   # Components, pages, contexts
│   ├── docs/                  # Component & styling guides
│   └── README.md
│
├── docs/                      # Repo-level documentation
│   ├── INDEX.md              # Documentation hub (start here!)
│   ├── ARCHITECTURE.md        # System design
│   ├── SECURITY.md            # Auth & security practices
│   └── DEVELOPMENT.md         # Development workflows
│
├── README.md                  # This file
├── DEPLOYMENT.md             # Production deployment
└── CONTRIBUTING.md           # Contribution guidelines
```

## Getting Help

1. **Check [docs/INDEX.md](docs/INDEX.md)** for quick links by role
2. **Search existing docs** - answers are probably there
3. **Read relevant section:**
   - Backend issue → [server/docs/](server/docs/)
   - Frontend issue → [client/docs/](client/docs/)
   - DevOps question → [DEPLOYMENT.md](DEPLOYMENT.md)
   - Contributing → [CONTRIBUTING.md](CONTRIBUTING.md)

## Next Steps

- 🚀 Deploy to production: [DEPLOYMENT.md](DEPLOYMENT.md)
- 🤝 Start contributing: [CONTRIBUTING.md](CONTRIBUTING.md)
- 🏗️ Understand architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

**Status:** Production-ready MVP  
**Last Updated:** 2026-06-02  
**License:** ISC

