import express from 'express';
import { body } from 'express-validator';
import {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
} from '../controllers/subscriptionController';
import { authenticateToken } from '../middleware/auth';
import { BILLING_CYCLES } from '../constants/subscriptions';

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

export default router;
