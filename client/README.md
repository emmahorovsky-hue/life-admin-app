# Life Admin App - Frontend

React + TypeScript + Vite frontend for subscription tracking.

## Features

- User authentication (register/login/logout)
- Subscription management (CRUD operations)
- Dashboard with spending overview
- Category breakdown chart
- Upcoming renewals
- Search and filter subscriptions
- Responsive design (mobile-first)

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Routing:** React Router v6
- **Styling:** TailwindCSS + shadcn/ui components
- **API Client:** Axios
- **Charts:** Recharts
- **Date Formatting:** date-fns

## Prerequisites

- Node.js 20 or higher
- Backend server running on `http://localhost:3001`

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```
   
   App runs on http://localhost:3000

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run preview
   ```

## Project Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── Layout.tsx             # Main layout with navigation
│   ├── ProtectedRoute.tsx     # Auth route wrapper
│   ├── AddSubscriptionDialog.tsx
│   └── EditSubscriptionDialog.tsx
├── contexts/
│   └── AuthContext.tsx        # Auth state management
├── lib/
│   ├── api.ts                 # Axios instance
│   ├── subscriptions.ts       # Subscription API
│   ├── dashboard.ts           # Dashboard API
│   └── utils.ts               # Utility functions
├── pages/
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Dashboard.tsx
│   └── Subscriptions.tsx
├── App.tsx                    # Router setup
├── main.tsx                   # Entry point
└── index.css                  # Global styles + TailwindCSS

## Design System

### Brand Colors
- **Primary Blue:** `oklch(0.55 0.22 250)` - Main actions, links
- **Accent Teal:** `oklch(0.60 0.15 190)` - Highlights, success states
- **Success Green:** `oklch(0.65 0.18 145)` - Confirmations
- **Warning Orange:** `oklch(0.70 0.20 70)` - Renewals, attention
- **Destructive Red:** `oklch(0.58 0.24 27)` - Delete actions

### Typography
- **Font:** Inter (via Google Fonts)
- **Weights:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Components
All UI components follow shadcn/ui patterns with custom theming.

## API Integration

Backend API base URL: `/api` (proxied to `http://localhost:3001`)

### Endpoints Used
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/subscriptions` - List subscriptions
- `POST /api/subscriptions` - Create subscription
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/dashboard/summary` - Dashboard summary
- `GET /api/dashboard/upcoming` - Upcoming renewals

## Authentication

- Uses JWT tokens stored in httpOnly cookies
- Automatic redirect to login on 401 errors
- Protected routes require authentication

## Responsive Breakpoints

- **Mobile:** < 768px (stacked layout, simplified views)
- **Tablet:** 768px - 1024px (2-column grids)
- **Desktop:** > 1024px (3-column grids, full features)

## Development Tips

### Hot Module Replacement
Vite provides instant HMR - changes appear immediately.

### API Proxy
Vite dev server proxies `/api/*` requests to `http://localhost:3001` to avoid CORS issues.

### TypeScript
Type errors show in terminal and IDE. Fix before committing.

### Testing Authentication Flow
1. Register a new account at `/register`
2. Login at `/login`
3. Access protected routes (`/dashboard`, `/subscriptions`)

## Available Scripts

- `npm run dev` - Start development server (port 3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Deployment

### Vercel (Recommended)
1. Connect GitHub repo
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variable: `VITE_API_URL` (if needed)

### Environment Variables
For production deployment:
```env
VITE_API_URL=https://your-backend-api.com
```

For development (uses proxy):
```env
# No env vars needed - uses Vite proxy
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

ISC
