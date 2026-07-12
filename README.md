# Life Admin App

A modern subscription tracker application to help users manage and monitor their recurring subscriptions.

**[📚 Full Documentation Hub](docs/INDEX.md)** — Start here for guides by role.

## Quick Start

### Run Locally

**Prerequisites:** Node.js 20+, PostgreSQL 15+

This is an npm-workspaces monorepo — **install once from the repo root**. The hoisted tree is what
lets `client/` and `mobile/` resolve `@life-admin/shared`.

```bash
npm install            # from the repo root, covers every workspace

# Backend
cd server
cp .env.example .env
# Edit .env with your database credentials
npm run prisma:migrate
npm run seed
npm run dev

# Frontend (in another terminal)
cd client
npm run dev

# Mobile (in another terminal)
cd mobile
npm run ios            # or: npm run android / npm run web
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000
- Mobile: Expo dev server (point it at your machine's LAN IP, not localhost, when running on a device)

**Test credentials:** `test@example.com` / `testpass123`

## Tech Stack

**Backend:** Node.js 20 + Express + TypeScript + Prisma + PostgreSQL  
**Frontend:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui  
**Mobile:** Expo SDK 57 + React Native + expo-router + TypeScript  
**Shared:** `@life-admin/shared` — types, constants, and subscription/date utilities used by web and mobile  
**Hosting:** Railway (backend) + Vercel (frontend) + EAS (mobile builds)

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
| **Mobile App** | [mobile/AGENTS.md](mobile/AGENTS.md) |
| **Mobile Builds (EAS)** | [DEPLOYMENT.md](DEPLOYMENT.md) — Part 6 |
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
life-admin-app/                # npm workspaces monorepo
├── server/                    # Express API + TypeScript
│   ├── src/                   # Controllers, routes, middleware
│   ├── prisma/                # Database schema & migrations
│   ├── docs/                  # API & Database documentation
│   └── README.md
│
├── client/                    # React + Vite frontend (web SPA)
│   ├── src/                   # Components, pages, contexts
│   ├── docs/                  # Component & styling guides
│   └── README.md
│
├── mobile/                    # Expo (SDK 57) React Native app
│   ├── app/                   # expo-router routes: (auth) and (app) groups
│   ├── lib/                   # API client, SecureStore token storage
│   ├── eas.json               # EAS build profiles
│   └── AGENTS.md              # Mobile architecture & auth notes
│
├── packages/shared/           # @life-admin/shared — types, constants, utils
│                              # consumed by client and mobile (raw TS, no build)
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

