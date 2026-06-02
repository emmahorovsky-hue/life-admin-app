# Development Workflow & Guidelines

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Git
- Your favorite editor (VS Code recommended)

### Initial Setup

```bash
# Clone repo
git clone https://github.com/emmahorovsky-hue/life-admin-app.git
cd life-admin-app

# Backend
cd server
npm install
cp .env.example .env
# Edit .env with your database credentials

# Database setup
createdb lifeadmin
npm run prisma:migrate
npm run seed

# Start backend
npm run dev   # Runs on http://localhost:3001

# In another terminal, frontend
cd client
npm install
npm run dev   # Runs on http://localhost:3000
```

## Branching Strategy

### Branch Naming

```
main                    # Production-ready code
├── feature/LIF-42-add-notifications
├── fix/LIF-41-password-reset-bug
├── docs/update-api-reference
└── chore/upgrade-dependencies
```

**Format:** `{type}/{issue-number}-{description}`

**Types:**
- `feature/` - New functionality
- `fix/` - Bug fixes
- `docs/` - Documentation
- `chore/` - Dependency updates, refactoring (no feature changes)
- `hotfix/` - Critical production fixes (branch from `main`, PR to `main`)

### Creating a Branch

```bash
git checkout -b feature/LIF-42-add-notifications
```

## Commit Message Format

**Format:**
```
{type}({scope}): {subject}

{body}

{footer}
```

**Example:**
```
feat(subscriptions): add renewal date filter

- Add dropdown filter for renewal date range
- Filter logic in backend endpoint
- Update Prisma query to filter by renewalDate

Closes #42
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `test:` - Test only
- `chore:` - Build, deps, tooling (no code changes)
- `refactor:` - Code restructure (no behavior change)
- `perf:` - Performance improvement
- `style:` - Formatting only (spaces, semicolons, etc.)

**Rules:**
- First line: 50 characters max
- Reference issue number: `Closes #42` or `Fixes #99`
- Use present tense ("add" not "added")
- Use imperative mood ("move cursor to" not "moves cursor")

## Pull Request Process

### Before Opening PR

1. **Update your branch** from main
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run local tests**
   ```bash
   npm run lint
   npm run test
   ```

3. **Test manually**
   - If backend: test endpoints with curl/Postman
   - If frontend: test features in browser

### Opening PR

**PR Title Format:** `[SCOPE] Brief description`

Examples:
- `[backend] Add rate limiting to auth endpoints`
- `[frontend] Fix subscription filter UI`
- `[docs] Update API documentation`

**PR Description:**

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Dependency update

## Changes
- Change 1
- Change 2

## Testing
Describe how you tested this change.

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] No new warnings generated
- [ ] Related docs are updated
- [ ] Commit messages are clear
```

### PR Review

**Expect feedback on:**
- ✅ Code quality & style
- ✅ Test coverage
- ✅ Documentation
- ✅ Performance implications
- ✅ Security concerns

**Before merging:**
- [ ] At least 1 approval
- [ ] All CI checks pass
- [ ] No merge conflicts

## Code Style

### TypeScript

**Rules:**
- Use `const` by default, `let` if needed, never `var`
- Use explicit types (even if inferred)
- Avoid `any` type
- Use interfaces for objects
- Use enums for fixed options

**Example:**
```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
  name: string;
}

const getUser = async (id: string): Promise<User | null> => {
  // ...
};

// ❌ Bad
const getUser = (id) => {  // No types!
  // ...
};
```

### Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Variables | camelCase | `userId`, `isActive` |
| Functions | camelCase | `getSubscription()`, `calculateTotal()` |
| Classes | PascalCase | `UserService`, `SubscriptionController` |
| Interfaces | PascalCase | `User`, `Subscription` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| React Components | PascalCase | `AddSubscriptionDialog`, `DashboardChart` |
| React Hooks | camelCase with `use` prefix | `useAuth()`, `useSubscriptions()` |

### Comments

Only comment when the "why" is unclear, not the "what" (code should be self-documenting).

```typescript
// ✅ Good: Explains business logic
// Soft delete: keep record for audit trail, don't cascade to notifications
subscription.isActive = false;

// ❌ Bad: Obvious from code
// Set isActive to false
subscription.isActive = false;
```

## Testing

### Backend Tests

```bash
cd server

# Run all tests
npm run test

# Run specific test
npm run test -- auth.test.ts

# Watch mode (re-run on file changes)
npm run test -- --watch
```

**Test structure:**
```typescript
describe('Authentication', () => {
  test('should register new user', async () => {
    // Arrange
    const input = { email: 'test@example.com', password: 'test123' };
    
    // Act
    const response = await request(app)
      .post('/api/auth/register')
      .send(input);
    
    // Assert
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(input.email);
  });
});
```

### Frontend Tests

```bash
cd client

# Run tests
npm run test

# Watch mode
npm run test -- --watch

# Coverage
npm run test -- --coverage
```

## Linting & Formatting

### Backend

```bash
cd server

# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Frontend

```bash
cd client

# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## Local Development

### Backend Development

```bash
cd server
npm run dev
```

Features:
- ✅ Hot reload on file changes
- ✅ TypeScript compilation with ts-node
- ✅ Nodemon for process restart

**Debugging:**
```bash
# Debug mode (Chrome DevTools)
node --inspect-brk ./node_modules/.bin/ts-node src/index.ts
```

### Frontend Development

```bash
cd client
npm run dev
```

Features:
- ✅ Hot Module Replacement (HMR) - instant updates
- ✅ Fast refresh on component changes
- ✅ Proxy to backend (`/api` → `http://localhost:3001`)

**Debugging:**
- Use React DevTools browser extension
- Use Chrome DevTools (F12)

## Database Management

### View Data with Prisma Studio

```bash
cd server
npm run prisma:studio
```

Opens http://localhost:5555 with GUI editor.

### Create Migration

```bash
cd server

# After editing prisma/schema.prisma
npm run prisma:migrate dev --name add_field_name
```

### Reset Database (dev only!)

```bash
cd server
npm run prisma:migrate reset
```

⚠️ **Warning:** This deletes all data. Only use in development.

## Making Changes

### Backend Change Example: Add Field to Subscription

1. **Update schema**
   ```prisma
   // server/prisma/schema.prisma
   model Subscription {
     id String @id @default(cuid())
     // ... existing fields
     renewalNotificationDays Int @default(7)  // NEW
   }
   ```

2. **Create migration**
   ```bash
   npm run prisma:migrate dev --name add_renewal_notification_days
   ```

3. **Update controller validation**
   ```typescript
   // server/src/controllers/subscriptionController.ts
   const result = validationResult(req);
   if (!result.isEmpty()) {
     return res.status(400).json({ errors: result.array() });
   }
   ```

4. **Add test**
   ```typescript
   test('should save renewalNotificationDays', async () => {
     // Test code
   });
   ```

5. **Run tests**
   ```bash
   npm run test
   ```

6. **Commit with clear message**
   ```bash
   git commit -m "feat(subscriptions): add renewal notification days"
   ```

### Frontend Change Example: Add Component

1. **Create component**
   ```typescript
   // client/src/components/RenewalAlert.tsx
   export function RenewalAlert() {
     return <div>...</div>;
   }
   ```

2. **Add TypeScript types**
   ```typescript
   interface RenewalAlertProps {
     days: number;
   }
   ```

3. **Update parent component**
   ```typescript
   // client/src/pages/Dashboard.tsx
   import { RenewalAlert } from '../components/RenewalAlert';
   ```

4. **Run linter**
   ```bash
   npm run lint -- --fix
   ```

5. **Test in browser**
   - http://localhost:3000

6. **Commit**
   ```bash
   git commit -m "feat(dashboard): add renewal alert component"
   ```

## Troubleshooting

### Backend won't start

```bash
cd server

# Clear node_modules & reinstall
rm -rf node_modules package-lock.json
npm install

# Verify database connection
npm run prisma:studio

# Check if port 3001 is in use
lsof -i :3001
```

### Frontend won't load

```bash
cd client

# Clear cache & reinstall
rm -rf node_modules .vite package-lock.json
npm install

# Check if port 3000 is in use
lsof -i :3000
```

### Database migration issues

```bash
cd server

# Reset database (⚠️ deletes data)
npm run prisma:migrate reset

# Create migration from schema changes
npm run prisma:migrate dev --name migration_name
```

## Performance Tips

### Backend
- Use `prisma:studio` to analyze queries
- Check database indexes
- Use `npm run build` before production

### Frontend
- Use React DevTools Profiler
- Check bundle size: `npm run build`
- Enable CSS coverage in Chrome DevTools

## Getting Help

1. **Check existing issues:** GitHub Issues
2. **Search docs:** [docs/INDEX.md](INDEX.md)
3. **Ask in PR:** Link to related code
4. **Local debugging:** Add console.log/debugger, trace execution

---

**Last Updated:** 2026-06-02  
**Target Audience:** All Developers  
**Related Docs:** [CONTRIBUTING.md](../CONTRIBUTING.md), [ARCHITECTURE.md](ARCHITECTURE.md)
