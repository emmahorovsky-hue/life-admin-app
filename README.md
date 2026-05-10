# Life Admin App MVP

A subscription tracker application to help users manage and monitor their recurring subscriptions.

## Project Status

**Week 1 (Days 1-4) - BACKEND COMPLETE ✅**

The backend API is fully functional with:
- ✅ User authentication (register/login/logout)
- ✅ JWT with httpOnly cookies
- ✅ Subscription CRUD operations
- ✅ Dashboard summary and upcoming renewals
- ✅ Category management
- ✅ Input validation and rate limiting
- ✅ PostgreSQL database schema (Prisma)
- ✅ Seed data for testing
- ✅ Complete API documentation

**Week 1 (Days 5-7) - Frontend (In Progress)**

Frontend React application will be built next.

## Monorepo Structure

```
life-admin-app/
├── server/          # Express + TypeScript + Prisma backend ✅
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── index.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── package.json
│   └── README.md (detailed API docs)
│
├── client/          # React + Vite frontend (placeholder)
│   └── README.md
│
├── README.md        # This file
└── .gitignore
```

## Tech Stack

### Backend
- **Runtime:** Node.js 20
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL 15+
- **Authentication:** JWT with httpOnly cookies
- **Validation:** express-validator
- **Rate Limiting:** express-rate-limit

### Frontend (Coming Soon)
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Routing:** React Router
- **HTTP Client:** Axios

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)
- npm or yarn

### 1. Setup Backend

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Setup Database

**Option A: Local PostgreSQL**
```bash
createdb lifeadmin
```

**Option B: Docker**
```bash
docker run --name postgres-lifeadmin \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=lifeadmin \
  -p 5432:5432 \
  -d postgres:15
```

### 4. Run Migrations & Seed

```bash
cd server
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

### 5. Start Development Server

```bash
cd server
npm run dev
```

Server runs on http://localhost:3001

### 6. Test API

Test credentials (after seeding):
- **Email:** test@example.com
- **Password:** testpass123

Health check:
```bash
curl http://localhost:3001/health
```

See `server/README.md` for complete API documentation.

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Subscriptions (Auth Required)
- `GET /api/subscriptions` - List subscriptions (with filters)
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions/:id` - Get single subscription
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Soft delete subscription

### Dashboard (Auth Required)
- `GET /api/dashboard/summary` - Spending overview
- `GET /api/dashboard/upcoming` - Upcoming renewals

### Categories
- `GET /api/categories` - List categories

## Database Schema

### User
- id, email, password (hashed), name
- timestamps

### Subscription
- id, userId, name, cost, currency
- billingCycle (monthly/annual/weekly/quarterly)
- renewalDate, category, notes
- isActive (soft delete flag)
- timestamps

### NotificationLog
- id, userId, subscriptionId
- type, status, sentAt
- (for email reminders - to be implemented)

## Development Scripts

### Backend
```bash
cd server

npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio (DB GUI)
npm run seed             # Seed database with test data
```

## Features

### Implemented ✅
- User registration and authentication
- Secure JWT-based auth with httpOnly cookies
- CRUD operations for subscriptions
- Dashboard with spending calculations
- Automatic monthly/annual cost calculations
- Filter subscriptions by category
- Sort subscriptions by date/cost/name
- Upcoming renewal tracking (30 days)
- Input validation and error handling
- Rate limiting on auth endpoints
- Soft delete for subscriptions
- Database seeding for testing

### Coming Next (Week 1, Days 5-7)
- Frontend React application
- Login/Register UI
- Subscription management interface
- Dashboard with charts
- Search and filter UI
- Responsive mobile design

### Future (Week 2-3)
- Email renewal reminders
- Calendar view
- Password reset
- Export to CSV
- Dark mode
- Mobile app

## Security Features

- ✅ bcrypt password hashing (10 rounds)
- ✅ JWT tokens in httpOnly cookies (XSS protection)
- ✅ CORS configured for frontend domain
- ✅ Rate limiting on auth endpoints (5 req/15 min)
- ✅ Input validation with express-validator
- ✅ SQL injection protection via Prisma ORM
- ✅ Environment variable security

## Deployment Ready

The backend is production-ready and can be deployed to:
- **Railway** (recommended - PostgreSQL bundled)
- **Render**
- **Heroku**
- **Vercel** (for frontend)

See deployment section in `server/README.md` for detailed instructions.

## Testing

**Test User** (after running seed):
- Email: `test@example.com`
- Password: `testpass123`

**Sample Subscriptions:** The seed script creates 8 sample subscriptions across different categories for testing.

## Documentation

- **Backend API:** See `server/README.md` for complete API documentation
- **Database Schema:** See `server/prisma/schema.prisma`
- **Technical Spec:** See project root for full technical specification

## Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Commit with clear messages
5. Open pull request

## License

ISC

---

**Current Status:** Backend foundation complete. Frontend development starts next.

**Last Updated:** 2026-04-28
