# Contributing to Life Admin App

Thank you for your interest in contributing! This guide explains how to submit changes.

## Code of Conduct

Be respectful and constructive. We're here to build great software together.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
   ```bash
   git clone https://github.com/YOUR-USERNAME/life-admin-app.git
   cd life-admin-app
   ```
3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/emmahorovsky-hue/life-admin-app.git
   ```

## Making Changes

### Branch Strategy

Create a branch with the format: `{type}/{issue-number}-{description}`

**Types:**
- `feature/` - New functionality
- `fix/` - Bug fixes
- `docs/` - Documentation
- `chore/` - Dependencies, tooling (no code changes)

**Example:**
```bash
git checkout -b feature/LIF-42-add-email-reminders
```

### Development Setup

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

This is an npm-workspaces monorepo (`server`, `client`, `mobile`, `packages/shared`). Install once
from the repo root — the hoisted tree is what lets `client` and `mobile` resolve `@life-admin/shared`.

**Quick start:**
```bash
npm install            # from the repo root, covers every workspace

# Backend
cd server
cp .env.example .env
# Edit .env with your database
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

See [mobile/AGENTS.md](mobile/AGENTS.md) before touching the Expo app — its auth differs from web
(SecureStore + `Authorization: Bearer`, not the httpOnly cookie), and its API URL is baked in at
build time.

### Code Style

**TypeScript:**
- Use `const` by default
- Explicit types (avoid `any`)
- Use interfaces for objects
- camelCase for variables/functions
- PascalCase for classes/components

**Comments:**
- Only comment the "why", not the "what"
- Code should be self-documenting

**Testing:**
- Write tests for new features
- Run tests before committing: `npm run test`
- Aim for >80% coverage

### Commit Messages

**Format:**
```
{type}({scope}): {subject}

{body}

{footer}
```

**Example:**
```
feat(subscriptions): add email reminder notifications

- Implement email sending via Resend service
- Add NotificationLog table to track sent emails
- Create notification queue with Bull
- Add tests for notification workflow

Closes #42
```

**Rules:**
- First line: 50 chars max
- Present tense: "add" not "added"
- Imperative mood: "move cursor" not "moves cursor"
- Reference issue: `Closes #42` or `Fixes #99`
- No period at end of subject

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `test:` - Test additions
- `docs:` - Documentation
- `refactor:` - Code restructure (no behavior change)
- `perf:` - Performance improvement
- `chore:` - Build, deps, tooling
- `style:` - Formatting only

### Running Linters & Tests

**Before pushing:**

```bash
# Backend — no ESLint here; CI runs the suite plus a typecheck
cd server
npm run test
npx tsc --noEmit

# Frontend
cd client
npm run lint
npm run lint -- --fix  # Auto-fix
npm run test:unit      # Vitest; npm run test:e2e for Playwright

# Mobile — no lint or test scripts yet; typecheck before pushing
cd mobile
npx tsc --noEmit
```

**Tests must pass.** If they don't, the PR will be blocked.

## Submitting a Pull Request

### Before Opening PR

1. **Update from upstream**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/LIF-42-add-email-reminders
   ```

3. **Create Pull Request on GitHub**

### PR Title

Format: `[SCOPE] Brief description`

Examples:
- `[backend] Add email reminder service`
- `[frontend] Fix subscription filter UI`
- `[docs] Update API reference`

### PR Description

Use this template:

```markdown
## Description
What does this PR accomplish?

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Dependency upgrade

## Related Issue
Closes #42

## Changes
- Change 1
- Change 2

## How to Test
1. Step 1 to reproduce the change
2. Step 2
3. Expected result

## Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Related docs are updated
- [ ] No console.log() or debug code
- [ ] Commits are clean & descriptive
```

### PR Review Process

**A reviewer will:**
- ✅ Review code quality
- ✅ Verify tests pass
- ✅ Check security implications
- ✅ Request changes if needed

**You can expect feedback on:**
- Code style & clarity
- Performance implications
- Security concerns
- Missing test coverage
- Documentation updates

**Don't take feedback personally!** Review comments are about the code, not you.

### Addressing Feedback

1. **Make requested changes** in your branch
2. **Commit with descriptive message**
   ```bash
   git commit -m "fix: address review feedback - add error handling"
   ```
3. **Push to your branch**
   ```bash
   git push origin feature/LIF-42-add-email-reminders
   ```
4. **Comment in PR** saying changes are ready

**Don't squash or force-push** to main branch PRs.

### Merging

Once approved:
1. Ensure all tests pass
2. Ensure branch is up-to-date with `main`
3. Maintainer will merge and delete your branch

## Architecture & Design Decisions

Before proposing major changes:

1. **Check existing issues** - Someone might already be working on it
2. **Open a discussion issue** - Describe the problem & proposed solution
3. **Get feedback** - Ensure alignment with project goals
4. **Start implementation** - Reference the discussion issue

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design decisions.

## Documentation

**Update docs for:**
- ✅ New features
- ✅ API changes
- ✅ New configuration options
- ✅ Breaking changes

**Documentation files:**
- [README.md](README.md) - Quick overview
- [docs/](docs/) - Comprehensive guides
- [server/docs/](server/docs/) - Backend documentation
- [client/docs/](client/docs/) - Frontend documentation

## Testing Requirements

### Backend Tests

```bash
cd server
npm run test
```

**Test new:**
- API endpoints (request/response)
- Validation rules
- Error cases
- Auth & authorization
- Database queries

**Example test:**
```typescript
describe('POST /api/subscriptions', () => {
  test('should create subscription with valid data', async () => {
    const response = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Netflix',
        cost: 15.99,
        billingCycle: 'monthly'
      });

    expect(response.status).toBe(201);
    expect(response.body.data.subscription.name).toBe('Netflix');
  });
});
```

### Frontend Tests

```bash
cd client
npm run test
```

**Test new:**
- Component rendering
- User interactions
- API calls
- Form validation
- State management

## Security

**Never commit:**
- API keys or secrets
- Passwords or tokens
- Private configuration
- Database credentials

**Always:**
- Use environment variables for secrets
- Add to `.env.example` (without values)
- Verify no secrets in `git log`

## Performance

**When contributing:**
- Avoid N+1 queries (use JOIN, include, select)
- Don't fetch unnecessary data
- Use pagination for large lists
- Test with production-like data volumes

**Measure:**
- Browser DevTools for frontend performance
- Database query logs for slow queries

## Reporting Bugs

**Found a bug?**

1. **Check existing issues** - Is it already reported?
2. **Create detailed issue** with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment (OS, browser, Node version)
   - Screenshots/logs

**Example:**
```markdown
## Description
Login page throws error when email is empty

## Steps to Reproduce
1. Navigate to /login
2. Leave email field empty
3. Click submit

## Expected
Show validation error message

## Actual
Blank error, page freezes

## Environment
- OS: macOS 14.5
- Browser: Chrome 125
- Node: 20.10.0
```

## Feature Requests

**Have an idea?**

1. **Create an issue** with:
   - Problem statement
   - Proposed solution
   - Why it's valuable
   - Any alternatives considered

2. **Wait for feedback** - Maintainers will discuss feasibility

3. **If approved** - Submit PR with implementation

## Questions?

- **Check [docs/](docs/)** for existing answers
- **Search issues** - Others might have asked
- **Open a discussion** - For questions about architecture
- **Ask in PR comments** - During review process

## License

By contributing, you agree your code will be licensed under the ISC license (see LICENSE file).

## Thank You!

Your contributions make this project better. We appreciate your time and effort! 🎉

---

**Last Updated:** 2026-06-02  
**Maintainers:** Development Team  
**Related Docs:** [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
