# Documentation Hub

Welcome to Life Admin App documentation. Use this index to find what you need.

## 🚀 Getting Started

**New to the project?** Start here:
- [README.md](../README.md) - Project overview & quick start
- [CONTRIBUTING.md](../CONTRIBUTING.md) - How to contribute

## 👨‍💻 For Developers

### Frontend Developers
- [client/README.md](../client/README.md) - Frontend setup & architecture
- [client/docs/COMPONENTS.md](COMPONENTS.md) - UI component documentation
- [client/docs/STYLING.md](STYLING.md) - Design system & TailwindCSS

### Backend Developers
- [server/README.md](../server/README.md) - Backend setup
- [server/docs/API.md](../server/docs/API.md) - API reference & endpoints
- [server/docs/DATABASE.md](../server/docs/DATABASE.md) - Database schema & migrations

### All Developers
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design & data flow
- [SECURITY.md](SECURITY.md) - Authentication, validation, security practices
- [DEVELOPMENT.md](DEVELOPMENT.md) - Development workflow & guidelines

## 🧭 For Product

- [CUSTOMER-JOURNEY.md](CUSTOMER-JOURNEY.md) - The eight-stage journey review: what the customer experiences, where it breaks, and what to fix first

## 🚢 Deployment & DevOps

- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment (Railway & Vercel)

## 📋 Quick Reference

### API Endpoints
See [server/docs/API.md](../server/docs/API.md) for complete reference.

**Auth:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

**Subscriptions:**
- `GET /api/subscriptions` - List with filters
- `POST /api/subscriptions` - Create
- `PATCH /api/subscriptions/:id` - Update
- `DELETE /api/subscriptions/:id` - Delete

**Dashboard:**
- `GET /api/dashboard/summary` - Spending overview
- `GET /api/dashboard/upcoming` - Upcoming renewals

### Tech Stack

**Backend:** Node.js 20 + Express + TypeScript + Prisma + PostgreSQL
**Frontend:** React 18 + TypeScript + Vite + TailwindCSS
**Hosting:** Railway (backend) + Vercel (frontend)

## 📚 Table of Contents

| Document | Audience | Purpose |
|----------|----------|---------|
| [README.md](../README.md) | Everyone | Project overview |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | DevOps/Leads | Production setup |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contributors | PR & code standards |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical leads | System design |
| [CUSTOMER-JOURNEY.md](CUSTOMER-JOURNEY.md) | Product/Leads | Customer journey review & priorities |
| [SECURITY.md](SECURITY.md) | Security-conscious devs | Security practices |
| [DEVELOPMENT.md](DEVELOPMENT.md) | All developers | Workflows & standards |
| [server/README.md](../server/README.md) | Backend devs | Backend setup |
| [server/docs/API.md](../server/docs/API.md) | Backend/Frontend devs | API reference |
| [server/docs/DATABASE.md](../server/docs/DATABASE.md) | Backend devs | Database schema |
| [client/README.md](../client/README.md) | Frontend devs | Frontend setup |
| [client/docs/COMPONENTS.md](COMPONENTS.md) | Frontend devs | Component guide |
| [client/docs/STYLING.md](STYLING.md) | Frontend devs | Design system |

## ❓ FAQ

**Q: How do I get the backend running?**  
A: See [server/README.md](../server/README.md) for setup instructions.

**Q: Where's the API documentation?**  
A: Check [server/docs/API.md](../server/docs/API.md).

**Q: How do I deploy to production?**  
A: See [DEPLOYMENT.md](../DEPLOYMENT.md).

**Q: What are the security practices?**  
A: Read [SECURITY.md](SECURITY.md).

**Q: How do I contribute?**  
A: See [CONTRIBUTING.md](../CONTRIBUTING.md).

---

**Last Updated:** 2026-06-02  
**Maintainer:** Development Team
