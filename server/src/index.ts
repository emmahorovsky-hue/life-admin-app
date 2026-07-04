import './instrument';
import * as Sentry from '@sentry/node';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import subscriptionRoutes from './routes/subscriptions';
import dashboardRoutes from './routes/dashboard';
import categoryRoutes from './routes/categories';
import { errorHandler } from './middleware/errorHandler';
import { csrfMiddleware } from './middleware/csrf';
import { startCronJobs } from './jobs';

// Load environment variables
dotenv.config();

// Startup validation for required environment variables (prevents silent failures in production)
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`FATAL ERROR: Missing required environment variable: ${varName}`);
    console.error('Please set all required env vars in your deployment platform (e.g. Railway).');
    process.exit(1);
  }
}

console.log('Environment validation passed. Starting server...');

const app = express();

// Railway (and most PaaS) terminate TLS at a single reverse-proxy hop and
// forward the client IP in X-Forwarded-For. Trust exactly one hop so req.ip and
// express-rate-limit key on the real client IP rather than the proxy's — without
// this, every user shares one rate-limit bucket and rate-limit v7 warns about an
// unexpected X-Forwarded-For header.
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// CORS configuration to allow Vercel preview deployments
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow any Vercel deployment
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    // Allow the configured CLIENT_URL
    if (origin === CLIENT_URL) {
      return callback(null, true);
    }
    
    // Reject all other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  // Expose the CSRF token header so the cross-origin SPA can read it (the
  // csrf_token cookie itself is invisible to document.cookie across origins).
  exposedHeaders: ['x-csrf-token'],
};

// Middleware
app.use(helmet({
  // The frontend is served from a different origin (Vercel), so resources must
  // be accessible cross-origin. All other helmet defaults remain in effect.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(csrfMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoryRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND',
    },
  });
});

// Sentry error handler (must be before custom error handler).
// Only captures 5xx — 4xx client errors are expected and not worth alerting on.
Sentry.setupExpressErrorHandler(app, {
  shouldHandleError(error) {
    return ((error as any).statusCode ?? 500) >= 500;
  },
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: ${CLIENT_URL}`);

  // Background jobs (disable with ENABLE_CRON=false, e.g. in tests)
  if (process.env.ENABLE_CRON !== 'false') {
    startCronJobs();
  }
});

export default app;
