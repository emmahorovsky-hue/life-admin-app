import express from 'express';
import { body } from 'express-validator';
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
  cancelSubscription,
  resumeSubscription,
  extractSubscriptionFromFile,
} from '../controllers/subscriptionController';
import { authenticateToken } from '../middleware/auth';
import { BILLING_CYCLES } from '../constants/subscriptions';
import { receiptUpload, extractRateLimit } from '../middleware/receiptUpload';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/subscriptions
router.get('/', getSubscriptions);

// POST /api/subscriptions
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('cost')
      .isFloat({ min: 0 })
      .withMessage('Cost must be a positive number'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter ISO code'),
    body('billingCycle')
      .isIn([...BILLING_CYCLES])
      .withMessage('Invalid billing cycle'),
    body('renewalDate').isISO8601().withMessage('Invalid renewal date'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('notes').optional().trim(),
  ],
  createSubscription
);

// POST /api/subscriptions/extract — upload a receipt/invoice → AI extracts review candidates
router.post('/extract', extractRateLimit, receiptUpload, extractSubscriptionFromFile);

// GET /api/subscriptions/:id
router.get('/:id', getSubscriptionById);

// PATCH /api/subscriptions/:id
router.patch(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('cost')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Cost must be a positive number'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-letter ISO code'),
    body('billingCycle')
      .optional()
      .isIn([...BILLING_CYCLES])
      .withMessage('Invalid billing cycle'),
    body('renewalDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid renewal date'),
    body('category')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Category cannot be empty'),
    body('notes').optional().trim(),
  ],
  updateSubscription
);

// DELETE /api/subscriptions/:id
router.delete('/:id', deleteSubscription);

// POST /api/subscriptions/:id/cancel — stop renewal, keep until period end
router.post('/:id/cancel', cancelSubscription);

// POST /api/subscriptions/:id/resume — reverse a pending cancellation
router.post('/:id/resume', resumeSubscription);

export default router;
