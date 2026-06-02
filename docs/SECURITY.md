# Security Practices

## Overview

This document outlines security practices implemented in Life Admin App to protect user data, prevent attacks, and maintain system integrity.

## Authentication & Authorization

### JWT with httpOnly Cookies

**Strategy:** JSON Web Tokens stored in httpOnly cookies.

**How it works:**
1. User logs in with email & password
2. Server validates credentials (password hashed with bcrypt)
3. Server generates JWT token with user ID
4. Server sets httpOnly cookie in response headers
5. Browser automatically includes cookie in subsequent requests
6. Middleware verifies JWT from cookie
7. Route handler accesses `req.user` with decoded token

**Security benefits:**
- ✅ **XSS Protection:** httpOnly flag prevents JavaScript from accessing token
- ✅ **Stateless:** No server-side session storage needed
- ✅ **CORS Safe:** Cookies sent automatically, no manual header manipulation
- ✅ **CSRF Mitigation:** SameSite=Strict flag prevents cross-site requests

**Implementation:**
```javascript
// Login flow
const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
  expiresIn: '7d'
});

res.cookie('token', token, {
  httpOnly: true,      // JavaScript cannot access
  secure: true,        // Only over HTTPS
  sameSite: 'strict',  // Only same-site requests
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});
```

### Password Security

**Hashing:** bcrypt with 10 rounds

**Why bcrypt:**
- ✅ Slow hash (intentional) makes brute-force attacks impractical
- ✅ Salting automatic (built-in)
- ✅ Adaptive (can increase rounds as hardware improves)
- ✅ Industry standard

**Implementation:**
```javascript
// On registration
const hashedPassword = await bcrypt.hash(password, 10);

// On login
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

**Never:**
- ❌ Store plaintext passwords
- ❌ Use simple MD5/SHA1 hashing
- ❌ Use reversible encryption
- ❌ Implement custom crypto

## Input Validation & Sanitization

### express-validator

**Purpose:** Prevent injection attacks (SQL, NoSQL, command injection, XSS)

**How it works:**
```javascript
// Example: Create subscription validation
POST /api/subscriptions
  - name: must be string, 1-255 chars
  - cost: must be decimal, positive
  - billingCycle: must be one of: monthly/annual/weekly/quarterly
  - category: must be valid category ID
  - renewalDate: must be valid date
```

**Benefits:**
- ✅ Whitelist valid inputs (reject unknowns)
- ✅ Type coercion (convert string "123" to number)
- ✅ Custom validation rules
- ✅ Error messages for frontend

**Never:**
- ❌ Trust user input
- ❌ Use regex without careful review
- ❌ Skip validation on backend (frontend validation is optional UX only)

## Rate Limiting

### express-rate-limit

**Applied to:** Authentication endpoints (login, register, logout)

**Configuration:**
- 5 requests per 15 minutes per IP
- Returns 429 (Too Many Requests)
- Prevents brute-force attacks & credential stuffing

**Implementation:**
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5                       // 5 requests
});

app.post('/api/auth/login', limiter, handleLogin);
```

**Future improvements:**
- Per-user rate limiting (track by userId, not just IP)
- Different limits for different endpoints
- Redis-based for distributed systems

## SQL Injection Prevention

### Prisma ORM

**Why this is safe:**
- Prisma generates parameterized SQL queries
- User input never directly in SQL strings
- Type-safe schema validation

**Safe example:**
```javascript
// Prisma (SAFE)
const subscription = await prisma.subscription.findUnique({
  where: { id: inputId }  // Parameterized
});

// ❌ NEVER do this:
const subscription = await db.query(
  `SELECT * FROM subscriptions WHERE id = '${inputId}'`  // SQL INJECTION!
);
```

## CORS Configuration

**Purpose:** Prevent unauthorized frontend domains from accessing API

**Current setup:**
```javascript
const cors = {
  origin: [
    'http://localhost:3000',      // Local dev
    'https://yourdomain.vercel.app'  // Production
  ],
  credentials: true  // Allow cookies
};
```

**Best practice:** Update production domains in environment variables, never hardcode.

## Environment Secrets

### Secret Management

**Secrets stored in:** `.env` file (never committed to Git)

**Critical secrets:**
- `JWT_SECRET` - Token signing key (use strong random value)
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - production/development
- `CORS_ORIGIN` - Frontend domain

**Generate strong secrets:**
```bash
# Generate random 32-character secret
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Accessing secrets:**
```javascript
const secret = process.env.JWT_SECRET;  // ✅ Safe
const secret = 'my-secret-here';        // ❌ NEVER hardcode
```

## Data Protection

### Soft Delete (Audit Trail)

**Pattern:** Mark as deleted, don't remove

```javascript
// Delete subscription
PATCH /api/subscriptions/:id
  { isActive: false }  // Mark as inactive

// Query doesn't return deleted items
WHERE isActive = true
```

**Benefits:**
- ✅ Data recovery
- ✅ Audit trail (can see what was deleted)
- ✅ Referential integrity
- ❌ Requires WHERE clause on every query (handled in code)

### Database Backups

**Responsibility:** PostgreSQL provider (Railway)
- Automatic daily backups
- Point-in-time recovery (last 7 days)
- Geo-redundant storage

## API Security Headers

### Recommended Headers

```javascript
// Prevent clickjacking
app.use(helmet.frameguard({ action: 'deny' }));

// Prevent MIME type sniffing
app.use(helmet.noSniff());

// XSS Protection (older browsers)
app.use(helmet.xssFilter());

// Strict Transport Security (HTTPS only)
app.use(helmet.hsts({ maxAge: 31536000 }));
```

## Logging & Monitoring

### What to Log (Non-sensitive)

```javascript
// ✅ Safe to log
- API endpoint & HTTP method
- Response status code
- Request duration
- User ID (not email/password)
- Error type (not error message with data)

// ❌ Never log
- Passwords
- JWT tokens
- API keys
- Email addresses
- Personal user data
```

## Security Checklist

Before deploying to production:

- [ ] JWT_SECRET is strong random value (32+ chars)
- [ ] DATABASE_URL points to production database
- [ ] CORS_ORIGIN matches production domain
- [ ] NODE_ENV = 'production'
- [ ] Cookies are `secure` & `sameSite: strict`
- [ ] HTTPS enabled (not HTTP)
- [ ] Rate limiting active on auth routes
- [ ] No console.log() of sensitive data
- [ ] express-validator validates all inputs
- [ ] Passwords hashed with bcrypt
- [ ] Database backups configured
- [ ] No secrets in .env.example or code
- [ ] Error messages don't leak implementation details

## Common Vulnerabilities & Mitigations

| Vulnerability | Risk | Mitigation |
|---------------|------|-----------|
| **SQL Injection** | Data breach | Use Prisma ORM, parameterized queries |
| **XSS (Cross-Site Scripting)** | Session hijack | httpOnly cookies, React auto-escaping |
| **CSRF (Cross-Site Request Forgery)** | Unauthorized actions | SameSite cookies, CORS validation |
| **Brute Force (Password)** | Account takeover | bcrypt slow hash, rate limiting |
| **Session Hijack** | Account takeover | httpOnly + secure cookies, short expiry |
| **Man-in-the-Middle** | Data interception | HTTPS only, HSTS header |
| **Clickjacking** | UI spoofing | X-Frame-Options: DENY header |
| **Privilege Escalation** | Unauthorized access | Verify userId in every request |

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Common vulnerabilities
- [express-validator Docs](https://express-validator.github.io/docs/) - Validation patterns
- [JWT.io](https://jwt.io/) - JWT best practices
- [bcrypt npm](https://www.npmjs.com/package/bcrypt) - Password hashing
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/) - Official guide

## Incident Response

If you discover a security vulnerability:

1. **Do not commit** a fix that mentions the vulnerability
2. **Create a private security issue** if available
3. **Email** security concerns to maintainers (check GitHub)
4. **Wait for response** before public disclosure (standard: 90 days)

---

**Last Updated:** 2026-06-02  
**Target Audience:** All Developers, Security-conscious teams  
**Related Docs:** [ARCHITECTURE.md](ARCHITECTURE.md), [server/docs/API.md](../server/docs/API.md)
