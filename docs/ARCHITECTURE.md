# System Architecture

## Overview

Life Admin App is a full-stack subscription management system. Users track recurring subscriptions, view spending summaries, and get renewal reminders.

```
┌─────────────────────────────────────────────────────────────┐
│                     User Browser (React)                     │
│  Frontend: React 18 + Vite + TailwindCSS + shadcn/ui        │
│  - Authentication (JWT tokens in httpOnly cookies)          │
│  - Subscription CRUD interface                              │
│  - Dashboard with charts & analytics                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       │ REST API
┌──────────────────────▼──────────────────────────────────────┐
│                Backend (Express + Node.js)                   │
│  Runtime: Node.js 20                                         │
│  Framework: Express.js + TypeScript                          │
│  Authentication: JWT with httpOnly cookies                   │
│  Validation: express-validator                               │
│  Rate Limiting: express-rate-limit                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Routes:                                                │  │
│  │  • POST /api/auth/register, /login, /logout           │  │
│  │  • GET /api/auth/me (protected)                        │  │
│  │  • GET/POST/PATCH/DELETE /api/subscriptions (auth)    │  │
│  │  • GET /api/dashboard/summary (auth)                   │  │
│  │  • GET /api/dashboard/upcoming (auth)                  │  │
│  │  • GET /api/categories                                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL (via Prisma ORM)
┌──────────────────────▼──────────────────────────────────────┐
│             PostgreSQL 15+ Database                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Tables:                                              │   │
│  │  • users (id, email, password, name)                 │   │
│  │  • subscriptions (id, userId, name, cost, category)  │   │
│  │  • categories (id, name)                             │   │
│  │  • notificationLogs (id, userId, subscriptionId)     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Technology Choices & Rationale

### Backend Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Runtime** | Node.js 20 | Modern, LTS, excellent ecosystem |
| **Framework** | Express.js | Lightweight, proven, flexible |
| **Language** | TypeScript | Type safety, better DX, fewer bugs |
| **ORM** | Prisma | Type-safe, auto-generated client, migrations |
| **Database** | PostgreSQL | ACID compliance, jsonb support, scalable |
| **Auth** | JWT + httpOnly cookies | Stateless, secure against XSS, no CSRF token needed |
| **Validation** | express-validator | Express-integrated, chainable, comprehensive |
| **Rate Limiting** | express-rate-limit | Simple, effective, memory-based |
| **Password Hashing** | bcrypt | Industry standard, slow by design |

### Frontend Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Framework** | React 18 | Component-based, large ecosystem, JSX |
| **Language** | TypeScript | Type safety, better IDE support |
| **Build** | Vite | Fast, modern, excellent DX, ESM-first |
| **Styling** | TailwindCSS | Utility-first, responsive, no CSS to maintain |
| **UI Components** | shadcn/ui | Unstyled, Tailwind-based, highly customizable |
| **Routing** | React Router v6 | Modern, nested routes, search params |
| **HTTP Client** | Axios | Promise-based, interceptors, timeout support |
| **Charts** | Recharts | Composable, responsive, accessible |

## Data Flow

### Authentication Flow
```
User Registration/Login
    ↓
Express validates input (express-validator)
    ↓
Check if email exists / Verify password (bcrypt)
    ↓
Generate JWT token
    ↓
Set httpOnly cookie (secure + sameSite)
    ↓
Browser stores cookie automatically
    ↓
Subsequent requests include cookie (automatic)
    ↓
Express middleware verifies JWT from cookie
    ↓
Attach user to request object
    ↓
Routes access req.user
```

### Subscription CRUD Flow
```
Frontend Form Submit
    ↓
Vite proxy to http://localhost:3001 (dev)
    ↓
Express validation middleware (express-validator)
    ↓
Auth middleware (verify JWT cookie)
    ↓
Controller calls Prisma ORM
    ↓
Prisma generates SQL + sends to PostgreSQL
    ↓
Database returns rows
    ↓
Prisma maps to TypeScript types
    ↓
Express returns JSON response
    ↓
React updates component state
    ↓
UI re-renders
```

### Dashboard Summary Flow
```
User clicks Dashboard
    ↓
Frontend: GET /api/dashboard/summary?userId=X
    ↓
Express: Auth middleware validates JWT
    ↓
Express: Controller queries subscriptions (active only)
    ↓
Prisma: SQL aggregation
    SELECT 
      SUM(cost) as totalMonthly,
      COUNT(*) as activeCount,
      ...
    FROM subscriptions
    WHERE userId = X AND isActive = true
    ↓
Database returns aggregated result
    ↓
Express: Format & return JSON
    ↓
React: Update dashboard state
    ↓
Recharts: Render charts with data
```

## Key Design Decisions

### 1. JWT in httpOnly Cookies
- **Pro:** Stateless, XSS-safe, no CSRF token needed
- **Con:** CSRF still possible (mitigated by SameSite=Strict)
- **Alternative rejected:** Session tokens in server memory (doesn't scale)

### 2. Soft Delete (isActive flag)
- **Pro:** Data recovery, audit trail, no cascading deletes
- **Con:** Need WHERE isActive=true on every query
- **Implementation:** Prisma where clause in controller

### 3. Prisma ORM
- **Pro:** Type-safe, auto-migrations, great DX
- **Con:** Some advanced SQL queries need raw SQL
- **Alternative rejected:** Raw SQL (no type safety, more bugs)

### 4. PostgreSQL
- **Pro:** ACID, JSONB, window functions, scalable
- **Con:** More complex than SQLite, needs external hosting
- **Use case:** Production ready, handles concurrent users

### 5. React + Context API (no Redux)
- **Pro:** Simple auth state, no boilerplate
- **Con:** Limited for complex global state
- **Future:** Can migrate to Zustand/Redux if needed

### 6. TailwindCSS + shadcn/ui
- **Pro:** Responsive, accessible, no custom CSS
- **Con:** Learning curve for Tailwind utility classes
- **Result:** Faster development, consistent design

## Scalability & Future

### Current Limits
- Single PostgreSQL instance (Railway default)
- No caching layer (could add Redis)
- No API rate limiting per user (global only)

### Future Improvements
1. **Caching:** Redis for dashboard summaries
2. **Queue System:** Bull/BullMQ for email reminders
3. **Monitoring:** Datadog/NewRelic for APM
4. **API Versioning:** /api/v2/ for breaking changes
5. **WebSockets:** Real-time notifications via Socket.io
6. **Database Replication:** Read replicas for scaling reads

## Security Architecture

See [SECURITY.md](SECURITY.md) for detailed security practices.

**Key components:**
- JWT tokens in httpOnly cookies (XSS protection)
- bcrypt password hashing (brute-force resistant)
- express-validator (injection prevention)
- Rate limiting (DDoS mitigation)
- CORS configured (CSRF prevention)
- Environment secrets in .env (never in code)

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         Git (GitHub)                     │
│  main branch → automatic deployment triggers             │
└────────────┬─────────────────────────────┬──────────────┘
             │                             │
    ┌────────▼────────┐          ┌─────────▼────────┐
    │ Railway (Backend)│          │ Vercel (Frontend)│
    │                 │          │                  │
    │ • Node.js build │          │ • Vite build     │
    │ • npm install   │          │ • npm run build  │
    │ • prisma:deploy │          │ • dist/ → CDN    │
    │ • npm start     │          │ • Edge functions │
    │                 │          │                  │
    │ Env vars:       │          │ Env vars:        │
    │ • DATABASE_URL  │          │ • VITE_API_URL   │
    │ • JWT_SECRET    │          │                  │
    │ • NODE_ENV      │          │                  │
    └────────┬────────┘          └─────────┬────────┘
             │                             │
    ┌────────▼────────────────────────────▼────────┐
    │   PostgreSQL (Railway Managed)                │
    │   Database backups: automatic daily          │
    │   Connection pooling: included               │
    └─────────────────────────────────────────────┘
```

## Monorepo Structure

```
life-admin-app/
├── server/                    # Backend (Node.js)
│   ├── src/
│   │   ├── controllers/       # Route handlers
│   │   ├── routes/            # Express routes
│   │   ├── middleware/        # Auth, validation, logging
│   │   └── index.ts           # Server entry point
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.ts            # Test data
│   ├── docs/
│   │   ├── API.md            # API reference
│   │   └── DATABASE.md        # Schema docs
│   ├── package.json
│   └── README.md
│
├── client/                    # Frontend (React)
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── contexts/          # Auth context
│   │   ├── lib/               # API client, utils
│   │   ├── App.tsx            # Router
│   │   └── main.tsx           # Entry point
│   ├── docs/
│   │   ├── COMPONENTS.md      # Component guide
│   │   └── STYLING.md         # Design system
│   ├── package.json
│   └── README.md
│
├── docs/                      # Repo-level docs
│   ├── INDEX.md              # Documentation hub
│   ├── ARCHITECTURE.md       # This file
│   ├── SECURITY.md           # Security practices
│   └── DEVELOPMENT.md        # Dev workflows
│
├── README.md                  # Project overview
├── DEPLOYMENT.md             # Production deployment
└── CONTRIBUTING.md           # Contribution guidelines
```

---

**Last Updated:** 2026-06-02  
**Target Audience:** Technical Leads, All Developers  
**Related Docs:** [SECURITY.md](SECURITY.md), [DEVELOPMENT.md](DEVELOPMENT.md)
