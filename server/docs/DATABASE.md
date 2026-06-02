# Database Schema & Migrations

Complete documentation of the PostgreSQL database schema.

## Overview

Life Admin App uses Prisma ORM to manage PostgreSQL database with type-safe migrations.

**Key features:**
- Automatic migration generation
- Type-safe queries
- Prisma Studio for visual data editing
- Seed data for testing

## Schema

### User Model

Represents application users.

```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  password      String         // bcrypt hashed
  name          String
  subscriptions Subscription[]
  notifications NotificationLog[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}
```

**Fields:**
- `id` - Unique identifier (CUID)
- `email` - User email, must be unique
- `password` - bcrypt hashed password (never plaintext)
- `name` - User's display name
- `createdAt` - Account creation timestamp
- `updatedAt` - Last modification timestamp

**Constraints:**
- Email must be unique (can't register twice with same email)
- Email must be valid format
- Password must be hashed with bcrypt (enforced in code)

**Relationships:**
- `subscriptions` - One-to-many: User has many subscriptions
- `notifications` - One-to-many: User has many notification logs

---

### Subscription Model

Represents user's recurring subscriptions.

```prisma
model Subscription {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  
  name           String
  cost           Decimal  @db.Decimal(10, 2)
  currency       String   @default("USD")
  billingCycle   String   // monthly, annual, weekly, quarterly
  renewalDate    DateTime
  category       String
  notes          String?  @db.VarChar(500)
  
  isActive       Boolean  @default(true)  // soft delete flag
  
  notifications  NotificationLog[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  @@index([userId])
  @@index([renewalDate])
  @@index([isActive])
}
```

**Fields:**
- `id` - Unique identifier (CUID)
- `userId` - Foreign key to User (required)
- `name` - Subscription name (Netflix, etc.)
- `cost` - Monthly or billing period cost (decimal with 2 places)
- `currency` - Currency code (USD, EUR, etc.)
- `billingCycle` - One of: `monthly`, `annual`, `weekly`, `quarterly`
- `renewalDate` - Next renewal/billing date
- `category` - Subscription category (streaming, productivity, etc.)
- `notes` - Optional user notes (max 500 chars)
- `isActive` - Soft delete flag (false = deleted)
- `createdAt` - Creation timestamp
- `updatedAt` - Last modification timestamp

**Indexes:**
- `userId` - Fast filtering by user
- `renewalDate` - Fast sorting/filtering by date
- `isActive` - Fast filtering active subscriptions

**Constraints:**
- `userId` is required (every subscription belongs to a user)
- `cost` must be positive decimal
- `billingCycle` must be one of 4 values (enforced in code)
- `renewalDate` must be valid date

**Relationships:**
- `user` - Many-to-one: Subscription belongs to one user
- `notifications` - One-to-many: Subscription has many notification logs

---

### NotificationLog Model

Audit trail for reminder notifications (future use).

```prisma
model NotificationLog {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  
  subscriptionId  String
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
  
  type            String   // email, sms, push
  status          String   // sent, failed, pending
  sentAt          DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([userId])
  @@index([subscriptionId])
  @@index([status])
}
```

**Fields:**
- `id` - Unique identifier
- `userId` - Foreign key to User
- `subscriptionId` - Foreign key to Subscription
- `type` - Notification type (email, sms, push)
- `status` - Notification status (sent, failed, pending)
- `sentAt` - When notification was actually sent
- `createdAt` - Log creation timestamp
- `updatedAt` - Last modification timestamp

**Relationships:**
- `user` - Many-to-one: Log belongs to one user
- `subscription` - Many-to-one: Log belongs to one subscription

---

## Migrations

### How Migrations Work

1. **Edit Schema**
   ```bash
   # Edit server/prisma/schema.prisma
   ```

2. **Create Migration**
   ```bash
   npm run prisma:migrate dev --name describe_change
   ```

3. **Prisma generates SQL** - Automatically creates SQL migration file

4. **Apply to Database** - Migration runs, schema updated

5. **Update Prisma Client** - Types regenerated

### Migration Files

Located in `server/prisma/migrations/`

Each migration is a folder with:
- `migration.sql` - SQL statements to apply
- `migration_lock.toml` - Lock file (do not edit)

**Example migration:**
```sql
-- server/prisma/migrations/20260602100000_add_renewal_notification_days/migration.sql

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "renewalNotificationDays" INTEGER NOT NULL DEFAULT 7;

-- CreateIndex
CREATE INDEX "Subscription_renewalNotificationDays_idx" ON "Subscription"("renewalNotificationDays");
```

### Running Migrations

```bash
cd server

# Apply migrations (development)
npm run prisma:migrate dev

# Apply migrations (production, without generate)
npm run prisma:migrate:deploy

# Reset database (dev only - DELETES DATA)
npm run prisma:migrate reset

# Create migration from schema changes
npm run prisma:migrate dev --name migration_name

# View migration status
npm run prisma:migrate status
```

### Safe Migration Practices

**Before deploying to production:**

1. ✅ Test locally
   ```bash
   npm run prisma:migrate reset
   npm run seed
   ```

2. ✅ Verify no data loss
   ```bash
   npm run prisma:studio  # View data after migration
   ```

3. ✅ Plan for downtime
   - Some migrations require downtime
   - Large migrations can lock tables

4. ✅ Have backup plan
   - Database provider should have automated backups
   - Be ready to rollback if needed

## Seed Data

### Purpose

Populate database with test data for development.

### Seed File

Located at `server/prisma/seed.ts`

```typescript
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    password: hashedPassword,  // bcrypt hashed
    name: 'Test User',
    subscriptions: {
      create: [
        {
          name: 'Netflix',
          cost: new Decimal('15.99'),
          currency: 'USD',
          billingCycle: 'monthly',
          renewalDate: new Date('2026-07-02'),
          category: 'streaming',
          notes: 'Premium plan'
        },
        // ... more subscriptions
      ]
    }
  }
});
```

### Running Seed

```bash
cd server

# Seed database (creates/updates test data)
npm run seed
```

**What it does:**
1. Deletes existing data (for dev safety)
2. Creates 1 test user: `test@example.com` / `testpass123`
3. Creates 8 sample subscriptions
4. Creates notification logs

**Test user:**
- Email: `test@example.com`
- Password: `testpass123`

### When to Seed

- ✅ After reset or fresh clone
- ✅ When schema changes add new fields
- ✅ Before testing new features
- ❌ NOT on production (destroys real data!)

## Querying Data

### Using Prisma

All queries are type-safe.

**Example queries:**

```typescript
// Find user by email
const user = await prisma.user.findUnique({
  where: { email: 'test@example.com' }
});

// Get user with subscriptions
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: { subscriptions: true }
});

// List active subscriptions for user
const subscriptions = await prisma.subscription.findMany({
  where: {
    userId: userId,
    isActive: true
  },
  orderBy: { renewalDate: 'asc' }
});

// Count subscriptions by category
const byCategory = await prisma.subscription.groupBy({
  by: ['category'],
  where: { userId: userId, isActive: true },
  _count: true,
  _sum: { cost: true }
});

// Get upcoming renewals (next 30 days)
const upcoming = await prisma.subscription.findMany({
  where: {
    userId: userId,
    isActive: true,
    renewalDate: {
      gte: new Date(),
      lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  },
  orderBy: { renewalDate: 'asc' }
});
```

### Using Prisma Studio

Visual database editor:

```bash
npm run prisma:studio
```

Opens http://localhost:5555

**Features:**
- View all records
- Create/edit/delete records
- See relationships
- Filter & sort

## Database Maintenance

### Checking Database Health

```bash
npm run prisma:studio
```

### Viewing Logs

```bash
# SQL query logs (Prisma debug mode)
DEBUG=prisma:* npm run dev
```

### Optimizing Performance

**Indexes:**
- Already optimized in schema
- `userId` for filtering
- `renewalDate` for sorting
- `isActive` for soft deletes

**Query optimization:**
- Use `include` selectively (don't fetch unneeded relations)
- Use `select` for specific fields
- Filter at database level (not in application)

### Backup & Recovery

**Responsibility:** Database provider (Railway)

**Railway includes:**
- ✅ Automatic daily backups
- ✅ Point-in-time recovery (7 days)
- ✅ Geo-redundant storage

**Restore process:**
1. Log into Railway dashboard
2. Select PostgreSQL service
3. Find "Backups" section
4. Restore to specific point in time

## Common Tasks

### Add New Subscription Field

1. **Edit schema**
   ```prisma
   model Subscription {
     // ... existing fields
     customField String?
   }
   ```

2. **Create migration**
   ```bash
   npm run prisma:migrate dev --name add_custom_field
   ```

3. **Test migration**
   ```bash
   npm run prisma:migrate reset
   npm run seed
   ```

4. **Update controller**
   - Add field to validation
   - Update type definitions
   - Test API endpoint

### Soft Delete vs Hard Delete

**Soft Delete (current approach):**
```typescript
// Mark as deleted
await prisma.subscription.update({
  where: { id },
  data: { isActive: false }
});

// Query ignores deleted
await prisma.subscription.findMany({
  where: { isActive: true }  // Only active
});
```

**Hard Delete (destructive):**
```typescript
// Permanently remove
await prisma.subscription.delete({
  where: { id }
});
```

**Use soft delete for:**
- User subscriptions (audit trail important)
- Financial records (compliance)
- Account data

---

## Related Documentation

- [Prisma Docs](https://www.prisma.io/docs/) - Official reference
- [PostgreSQL Docs](https://www.postgresql.org/docs/) - Database reference
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [API.md](API.md) - API endpoints

---

**Last Updated:** 2026-06-02  
**Target Audience:** Backend Developers, DevOps  
**Related Docs:** [API.md](API.md), [ARCHITECTURE.md](../ARCHITECTURE.md)
