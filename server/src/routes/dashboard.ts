import express from 'express';
import {
  getDashboardSummary,
  getUpcomingRenewals,
} from '../controllers/dashboardController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/dashboard/summary
router.get('/summary', getDashboardSummary);

// GET /api/dashboard/upcoming
router.get('/upcoming', getUpcomingRenewals);

export default router;
