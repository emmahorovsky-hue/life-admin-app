# API Reference

Complete REST API documentation for Life Admin App backend.

## Base URL

- **Development:** `http://localhost:3001`
- **Production:** `https://your-backend.railway.app`

## Authentication

All endpoints except `/auth/register` and `/auth/login` require authentication.

**How it works:**
1. Login or register to get a JWT token in httpOnly cookie
2. Subsequent requests automatically include the cookie
3. Server validates JWT and attaches user to request

**Error response (401):**
```json
{
  "error": "Unauthorized"
}
```

## Request/Response Format

**Content-Type:** `application/json`

**Request example:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

**Response format:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "error": null
}
```

---

## Authentication Endpoints

### Register New User

**POST** `/api/auth/register`

Create a new user account.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Validation:**
- `email`: Valid email format, unique
- `password`: Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
- `name`: 1-100 characters

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123abc",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

**Error responses:**
- `400 Bad Request`: Validation failed
- `409 Conflict`: Email already registered

---

### Login

**POST** `/api/auth/login`

Authenticate user and set JWT cookie.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123abc",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

**Sets cookie:**
- Name: `token`
- httpOnly: true (JavaScript cannot access)
- Secure: true (HTTPS only in production)
- SameSite: Strict (CSRF protection)
- Expires: 7 days

**Error responses:**
- `400 Bad Request`: Missing email or password
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limited (5 attempts per 15 minutes)

---

### Get Current User

**GET** `/api/auth/me`

Get authenticated user's profile.

**Authentication required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123abc",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

**Error responses:**
- `401 Unauthorized`: Not authenticated

---

### Logout

**POST** `/api/auth/logout`

Clear JWT cookie and end session.

**Authentication required:** Yes

**Request body:** (empty)

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Subscription Endpoints

All subscription endpoints require authentication.

### List Subscriptions

**GET** `/api/subscriptions`

List user's subscriptions with optional filters.

**Query parameters:**
```
?category=streaming
?status=active
?sortBy=cost|name|date
?order=asc|desc
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "id": "sub_123",
        "userId": "user_123abc",
        "name": "Netflix",
        "cost": 15.99,
        "currency": "USD",
        "billingCycle": "monthly",
        "renewalDate": "2026-07-02",
        "category": "streaming",
        "notes": "Premium plan",
        "isActive": true,
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-06-02T10:30:00Z"
      }
    ],
    "total": 1,
    "count": 1
  }
}
```

**Error responses:**
- `401 Unauthorized`: Not authenticated

---

### Create Subscription

**POST** `/api/subscriptions`

Create a new subscription.

**Request body:**
```json
{
  "name": "Netflix",
  "cost": 15.99,
  "currency": "USD",
  "billingCycle": "monthly",
  "renewalDate": "2026-07-02",
  "category": "streaming",
  "notes": "Premium plan"
}
```

**Validation:**
- `name`: 1-255 characters, required
- `cost`: Positive decimal, required
- `currency`: 3-letter code (USD, EUR, etc.)
- `billingCycle`: One of: `monthly`, `annual`, `weekly`, `quarterly`
- `renewalDate`: Valid ISO date
- `category`: Valid category ID
- `notes`: Optional, max 500 characters

**Response (201):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "userId": "user_123abc",
      "name": "Netflix",
      "cost": 15.99,
      "currency": "USD",
      "billingCycle": "monthly",
      "renewalDate": "2026-07-02",
      "category": "streaming",
      "notes": "Premium plan",
      "isActive": true,
      "createdAt": "2026-06-02T10:30:00Z",
      "updatedAt": "2026-06-02T10:30:00Z"
    }
  }
}
```

**Error responses:**
- `400 Bad Request`: Validation failed
- `401 Unauthorized`: Not authenticated

---

### Get Single Subscription

**GET** `/api/subscriptions/:id`

Get details of a specific subscription.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "userId": "user_123abc",
      "name": "Netflix",
      "cost": 15.99,
      "currency": "USD",
      "billingCycle": "monthly",
      "renewalDate": "2026-07-02",
      "category": "streaming",
      "notes": "Premium plan",
      "isActive": true,
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-06-02T10:30:00Z"
    }
  }
}
```

**Error responses:**
- `404 Not Found`: Subscription not found
- `401 Unauthorized`: Not authenticated

---

### Update Subscription

**PATCH** `/api/subscriptions/:id`

Update subscription details.

**Request body:** (all fields optional)
```json
{
  "name": "Netflix Premium",
  "cost": 22.99,
  "renewalDate": "2026-07-02",
  "notes": "New plan"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "name": "Netflix Premium",
      "cost": 22.99,
      "renewalDate": "2026-07-02",
      "notes": "New plan",
      "updatedAt": "2026-06-02T11:00:00Z"
    }
  }
}
```

**Error responses:**
- `400 Bad Request`: Validation failed
- `404 Not Found`: Subscription not found
- `401 Unauthorized`: Not authenticated

---

### Delete Subscription

**DELETE** `/api/subscriptions/:id`

Soft delete a subscription (mark as inactive).

**Response (200):**
```json
{
  "success": true,
  "message": "Subscription deleted"
}
```

**Note:** This performs a soft delete. The subscription is marked as `isActive: false` but remains in the database for audit trail.

**Error responses:**
- `404 Not Found`: Subscription not found
- `401 Unauthorized`: Not authenticated

---

## Dashboard Endpoints

All dashboard endpoints require authentication.

### Dashboard Summary

**GET** `/api/dashboard/summary`

Get spending overview and statistics.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalMonthly": 95.97,
      "totalAnnual": 1151.64,
      "activeCount": 6,
      "currency": "USD",
      "byCategory": [
        {
          "category": "streaming",
          "count": 3,
          "monthlyTotal": 45.97,
          "annualTotal": 551.64
        },
        {
          "category": "productivity",
          "count": 2,
          "monthlyTotal": 30.00,
          "annualTotal": 360.00
        }
      ]
    }
  }
}
```

**Error responses:**
- `401 Unauthorized`: Not authenticated

---

### Upcoming Renewals

**GET** `/api/dashboard/upcoming`

Get subscriptions renewing within 30 days.

**Query parameters:**
```
?days=30    # Look ahead X days (default: 30)
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "upcoming": [
      {
        "id": "sub_123",
        "name": "Netflix",
        "cost": 15.99,
        "currency": "USD",
        "billingCycle": "monthly",
        "renewalDate": "2026-06-15",
        "daysUntilRenewal": 13,
        "category": "streaming"
      },
      {
        "id": "sub_456",
        "name": "Adobe Creative Cloud",
        "cost": 54.99,
        "currency": "USD",
        "billingCycle": "monthly",
        "renewalDate": "2026-06-20",
        "daysUntilRenewal": 18,
        "category": "productivity"
      }
    ],
    "count": 2
  }
}
```

**Error responses:**
- `401 Unauthorized`: Not authenticated

---

## Categories Endpoint

### List Categories

**GET** `/api/categories`

Get all available subscription categories.

**Authentication required:** No

**Response (200):**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "id": "cat_1", "name": "streaming" },
      { "id": "cat_2", "name": "productivity" },
      { "id": "cat_3", "name": "fitness" },
      { "id": "cat_4", "name": "education" },
      { "id": "cat_5", "name": "entertainment" },
      { "id": "cat_6", "name": "other" }
    ]
  }
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

### Validation Error Example

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

---

## Rate Limiting

Auth endpoints are rate limited to prevent brute force attacks.

**Limit:** 5 requests per 15 minutes per IP address

**Response (429):**
```json
{
  "error": "Too many requests. Try again later."
}
```

---

## Examples

### Complete Flow: Register, Login, Create Subscription

```bash
# 1. Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'

# 2. Login (sets cookie automatically with curl -b)
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'

# 3. Create subscription (use saved cookies)
curl -b cookies.txt -X POST http://localhost:3001/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Netflix",
    "cost": 15.99,
    "currency": "USD",
    "billingCycle": "monthly",
    "renewalDate": "2026-07-02",
    "category": "streaming"
  }'

# 4. List subscriptions
curl -b cookies.txt http://localhost:3001/api/subscriptions

# 5. Get dashboard summary
curl -b cookies.txt http://localhost:3001/api/dashboard/summary
```

---

**Last Updated:** 2026-06-02  
**Target Audience:** Backend Developers, Frontend Developers, API Consumers  
**Related Docs:** [SECURITY.md](../SECURITY.md), [DATABASE.md](DATABASE.md)
