import express from 'express';
import { body, query } from 'express-validator';
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
import {
  BILLING_CYCLES,
  CATEGORY_IDS,
  currencies,
  SUBSCRIPTION_SORT_FIELDS,
  SORT_ORDERS,
} from '../constants/subscriptions';
import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH } from '../constants/validation';
import { receiptUpload, extractRateLimit } from '../middleware/receiptUpload';

const router = express.Router();

// Currency codes are case-insensitive on the wire but stored uppercase, so "usd"
// and "USD" are the same subscription rather than two. toUpperCase() is not a
// validator.js sanitizer, hence the custom one — and it must run *before* isIn(),
// or a lowercase code would be rejected instead of normalised.
const normaliseCurrency = (value: unknown) =>
  typeof value === 'string' ? value.toUpperCase() : value;

// All routes require authentication
router.use(authenticateToken);

// GET /api/subscriptions
router.get(
  '/',
  [
    query('sort')
      .optional()
      // express-validator runs isIn against each element of a repeated param, so
      // ?sort=name&sort=cost would otherwise pass and then silently fall back to
      // the default sort in the controller.
      .custom((_value, { req }) => !Array.isArray(req.query?.sort))
      .withMessage('sort must be a single value')
      .bail()
      .isIn([...SUBSCRIPTION_SORT_FIELDS])
      .withMessage(
        `sort must be one of: ${SUBSCRIPTION_SORT_FIELDS.join(', ')}`
      ),
    query('order')
      .optional()
      .custom((_value, { req }) => !Array.isArray(req.query?.order))
      .withMessage('order must be a single value')
      .bail()
      .isIn([...SORT_ORDERS])
      .withMessage(`order must be one of: ${SORT_ORDERS.join(', ')}`),
  ],
  getSubscriptions
);

// POST /api/subscriptions
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: MAX_NAME_LENGTH })
      .withMessage(`Name must be at most ${MAX_NAME_LENGTH} characters`),
    body('cost')
      .isFloat({ min: 0 })
      .withMessage('Cost must be a positive number'),
    body('currency')
      .optional()
      .customSanitizer(normaliseCurrency)
      .isIn(currencies)
      .withMessage(`Currency must be one of: ${currencies.join(', ')}`),
    body('billingCycle')
      .isIn([...BILLING_CYCLES])
      .withMessage('Invalid billing cycle'),
    body('renewalDate').isISO8601().withMessage('Invalid renewal date'),
    body('category')
      .trim()
      .isIn([...CATEGORY_IDS])
      .withMessage(`Category must be one of: ${CATEGORY_IDS.join(', ')}`),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: MAX_NOTES_LENGTH })
      .withMessage(`Notes must be at most ${MAX_NOTES_LENGTH} characters`),
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
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: MAX_NAME_LENGTH })
      .withMessage(`Name must be at most ${MAX_NAME_LENGTH} characters`),
    body('cost')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Cost must be a positive number'),
    body('currency')
      .optional()
      .customSanitizer(normaliseCurrency)
      .isIn(currencies)
      .withMessage(`Currency must be one of: ${currencies.join(', ')}`),
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
      .isIn([...CATEGORY_IDS])
      .withMessage(`Category must be one of: ${CATEGORY_IDS.join(', ')}`),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: MAX_NOTES_LENGTH })
      .withMessage(`Notes must be at most ${MAX_NOTES_LENGTH} characters`),
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
