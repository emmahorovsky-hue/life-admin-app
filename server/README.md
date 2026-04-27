# Life Admin App - Backend API

Express + TypeScript + Prisma backend for subscription tracking.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT with httpOnly cookies
- **Validation:** express-validator

## Prerequisites

- Node.js 20 or higher
- PostgreSQL 15 or higher (or Docker)
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and JWT secret
   ```

3. **Set up PostgreSQL database:**
   
   **Option A: Local PostgreSQL**
   ```bash
   # Create database
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

4. **Run Prisma migrations:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Seed the database (optional):**
   ```bash
   npm run seed
   ```
   
   This creates a test user and sample subscriptions:
   - **Email:** test@example.com
   - **Password:** testpass123

6. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   Server runs on http://localhost:3001

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run seed` - Seed database with test data

## API Endpoints

### Authentication

#### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe" // optional
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-04-28T..."
  }
}
```

#### POST /api/auth/login
Login and receive JWT token in httpOnly cookie.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-04-28T..."
  }
}
```

#### POST /api/auth/logout
Clear authentication cookie.

**Response (200):**
```json
{
  "message": "Logout successful"
}
```

#### GET /api/auth/me
Get current user information (requires authentication).

**Response (200):**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-04-28T...",
    "updatedAt": "2026-04-28T..."
  }
}
```

---

### Subscriptions

All subscription endpoints require authentication.

#### GET /api/subscriptions
List all user's subscriptions with optional filters.

**Query Parameters:**
- `category` - Filter by category (e.g., "streaming")
- `sort` - Sort field (default: "renewalDate")
- `order` - Sort order "asc" or "desc" (default: "asc")

**Example:** `/api/subscriptions?category=streaming&sort=cost&order=desc`

**Response (200):**
```json
[
  {
    "id": "clx...",
    "userId": "clx...",
    "name": "Netflix Premium",
    "cost": "19.99",
    "currency": "USD",
    "billingCycle": "monthly",
    "renewalDate": "2026-05-15T00:00:00.000Z",
    "category": "streaming",
    "notes": "Family plan",
    "isActive": true,
    "createdAt": "2026-04-28T...",
    "updatedAt": "2026-04-28T..."
  }
]
```

#### POST /api/subscriptions
Create a new subscription.

**Request:**
```json
{
  "name": "Netflix Premium",
  "cost": 19.99,
  "currency": "USD", // optional, defaults to USD
  "billingCycle": "monthly", // monthly|annual|yearly|weekly|quarterly
  "renewalDate": "2026-05-15",
  "category": "streaming",
  "notes": "Family plan" // optional
}
```

**Response (201):**
```json
{
  "id": "clx...",
  "userId": "clx...",
  "name": "Netflix Premium",
  "cost": "19.99",
  "currency": "USD",
  "billingCycle": "monthly",
  "renewalDate": "2026-05-15T00:00:00.000Z",
  "category": "streaming",
  "notes": "Family plan",
  "isActive": true,
  "createdAt": "2026-04-28T...",
  "updatedAt": "2026-04-28T..."
}
```

#### GET /api/subscriptions/:id
Get a single subscription by ID.

**Response (200):** Same as subscription object above.

**Error (404):**
```json
{
  "error": {
    "message": "Subscription not found",
    "code": "SUBSCRIPTION_NOT_FOUND"
  }
}
```

#### PATCH /api/subscriptions/:id
Update a subscription (partial update).

**Request:** (all fields optional)
```json
{
  "name": "Netflix Premium UHD",
  "cost": 22.99,
  "renewalDate": "2026-06-01"
}
```

**Response (200):** Updated subscription object.

#### DELETE /api/subscriptions/:id
Delete (soft delete) a subscription.

**Response (200):**
```json
{
  "message": "Subscription deleted successfully"
}
```

---

### Dashboard

All dashboard endpoints require authentication.

#### GET /api/dashboard/summary
Get spending overview and upcoming renewals.

**Response (200):**
```json
{
  "totalMonthlySpend": 127.94,
  "totalAnnualSpend": 1535.28,
  "activeSubscriptions": 8,
  "upcomingRenewals": [
    {
      "id": "clx...",
      "name": "Netflix Premium",
      "cost": "19.99",
      "renewalDate": "2026-05-15T00:00:00.000Z",
      "daysUntilRenewal": 17
    }
  ]
}
```

#### GET /api/dashboard/upcoming
List all subscriptions renewing in the next 30 days.

**Response (200):**
```json
[
  {
    "id": "clx...",
    "name": "Netflix Premium",
    "cost": "19.99",
    "renewalDate": "2026-05-15T00:00:00.000Z",
    "daysUntilRenewal": 17,
    // ... other subscription fields
  }
]
```

---

### Categories

#### GET /api/categories
Get list of available subscription categories (public endpoint).

**Response (200):**
```json
[
  {
    "id": "streaming",
    "name": "Streaming",
    "description": "Netflix, Hulu, Disney+, etc."
  },
  {
    "id": "fitness",
    "name": "Fitness",
    "description": "Gym, ClassPass, Peloton, etc."
  }
  // ... more categories
]
```

---

### Health Check

#### GET /health
Check if the server is running.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-04-28T12:34:56.789Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {} // optional additional info
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` (401) - Not authenticated
- `VALIDATION_ERROR` (400) - Invalid input
- `EMAIL_EXISTS` (400) - Email already registered
- `INVALID_CREDENTIALS` (401) - Wrong email/password
- `SUBSCRIPTION_NOT_FOUND` (404) - Subscription doesn't exist
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `INTERNAL_ERROR` (500) - Server error

---

## Rate Limiting

Authentication endpoints are rate-limited to **5 requests per 15 minutes** per IP address:
- POST /api/auth/register
- POST /api/auth/login

---

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens stored in httpOnly cookies (XSS protection)
- CORS configured for frontend domain only
- Input validation on all endpoints
- SQL injection protection via Prisma ORM

---

## Database Schema

See `prisma/schema.prisma` for the full schema.

**Key tables:**
- `User` - User accounts
- `Subscription` - User subscriptions
- `NotificationLog` - Email notification tracking (for future use)

---

## Deployment

### Environment Variables (Production)

```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
JWT_SECRET="your-production-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="production"
CLIENT_URL="https://your-frontend-domain.com"
```

### Deploy to Railway

1. Create Railway account
2. Create new project from GitHub repo
3. Add PostgreSQL database
4. Set environment variables
5. Deploy automatically on push to main

### Build Commands

```bash
npm run build
npm run prisma:generate
npm run prisma:migrate
```

### Start Command

```bash
npm start
```

---

## Development Tips

### Prisma Studio

View and edit database records with a GUI:
```bash
npm run prisma:studio
```

### Reset Database

```bash
npx prisma migrate reset
npm run seed
```

### Generate New Migration

```bash
npx prisma migrate dev --name description-of-change
```

---

## Testing

**Test User Credentials (after seeding):**
- Email: test@example.com
- Password: testpass123

**Sample cURL Commands:**

Register:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new@example.com","password":"password123","name":"Test User"}'
```

Login:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

Get subscriptions:
```bash
curl http://localhost:3001/api/subscriptions \
  -b cookies.txt
```

---

## License

ISC
