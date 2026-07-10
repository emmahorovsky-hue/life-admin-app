import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { Prisma } from '@prisma/client';
import { extractSubscription } from '../services/aiService';
import { withNextRenewal, computeNextRenewal } from '../utils/renewal';
import { reportServerError } from '../utils/reportError';

/**
 * POST /api/subscriptions/extract
 * Accepts an uploaded receipt/invoice (multipart `file`), runs LLM extraction, and returns
 * review candidates. Does NOT create anything — the user confirms via the normal create path.
 */
export const extractSubscriptionFromFile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' },
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: { message: 'No file uploaded.', code: 'NO_FILE' },
      });
      return;
    }

    const result = await extractSubscription(req.file.buffer, req.file.mimetype);

    if (result.source === 'none') {
      // Same user-facing copy either way — the value is in the code + logs so an
      // operator can tell a missing/unconfigured key apart from a transient API
      // failure without exposing provider internals to the user.
      if (result.reason === 'not_configured') {
        console.warn(
          '[extract] ANTHROPIC_API_KEY is not configured in this environment — receipt extraction is disabled.'
        );
      }
      res.status(503).json({
        error: {
          message:
            'AI extraction is unavailable right now. Please add the subscription manually.',
          code:
            result.reason === 'not_configured'
              ? 'EXTRACTION_NOT_CONFIGURED'
              : 'EXTRACTION_FAILED',
        },
      });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    reportServerError('Extract subscription error', error);
    res.status(500).json({
      error: {
        message: 'Failed to extract subscription from file',
        code: 'EXTRACT_SUBSCRIPTION_FAILED',
      },
    });
  }
};

export const createSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        },
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
      });
      return;
    }

    const { name, cost, currency, billingCycle, renewalDate, category, notes } =
      req.body;

    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user.userId,
        name,
        cost: new Prisma.Decimal(cost),
        currency: currency || 'SGD',
        billingCycle,
        renewalDate: new Date(renewalDate),
        category,
        notes,
      },
    });

    res.status(201).json(withNextRenewal(subscription));
  } catch (error) {
    reportServerError('Create subscription error', error);
    res.status(500).json({
      error: {
        message: 'Failed to create subscription',
        code: 'CREATE_SUBSCRIPTION_FAILED',
      },
    });
  }
};

export const getSubscriptions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
      });
      return;
    }

    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'renewalDate';
    const order = typeof req.query.order === 'string' ? req.query.order : 'asc';

    const where: any = {
      userId: req.user.userId,
      isActive: true,
    };

    if (category && typeof category === 'string') {
      where.category = category;
    }

    const orderBy: any = {};
    if (typeof sort === 'string') {
      orderBy[sort] = order === 'desc' ? 'desc' : 'asc';
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      orderBy,
    });

    const now = new Date();
    const withRenewal = subscriptions.map((sub) => withNextRenewal(sub, now));

    // Sorting by renewalDate means the *next* occurrence, which Prisma can't
    // express — re-sort the computed field in JS (other sorts keep Prisma order).
    if (sort === 'renewalDate') {
      const dir = order === 'desc' ? -1 : 1;
      withRenewal.sort(
        (a, b) =>
          dir * (new Date(a.nextRenewalDate).getTime() - new Date(b.nextRenewalDate).getTime())
      );
    }

    res.status(200).json(withRenewal);
  } catch (error) {
    reportServerError('Get subscriptions error', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch subscriptions',
        code: 'FETCH_SUBSCRIPTIONS_FAILED',
      },
    });
  }
};

export const getSubscriptionById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
      });
      return;
    }

    const { id } = req.params;
    const subscriptionId = typeof id === 'string' ? id : id[0];

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: req.user.userId,
      },
    });

    if (!subscription) {
      res.status(404).json({
        error: {
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json(withNextRenewal(subscription));
  } catch (error) {
    reportServerError('Get subscription error', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch subscription',
        code: 'FETCH_SUBSCRIPTION_FAILED',
      },
    });
  }
};

export const updateSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        },
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
      });
      return;
    }

    const { id } = req.params;
    const subscriptionId = typeof id === 'string' ? id : id[0];
    const { name, cost, currency, billingCycle, renewalDate, category, notes } =
      req.body;

    // Check if subscription exists and belongs to user
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: req.user.userId,
      },
    });

    if (!existingSubscription) {
      res.status(404).json({
        error: {
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND',
        },
      });
      return;
    }

    // Update subscription
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (cost !== undefined) data.cost = new Prisma.Decimal(cost);
    if (currency !== undefined) data.currency = currency;
    if (billingCycle !== undefined) data.billingCycle = billingCycle;
    if (renewalDate !== undefined) data.renewalDate = new Date(renewalDate);
    if (category !== undefined) data.category = category;
    if (notes !== undefined) data.notes = notes;

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data,
    });

    res.status(200).json(withNextRenewal(subscription));
  } catch (error) {
    reportServerError('Update subscription error', error);
    res.status(500).json({
      error: {
        message: 'Failed to update subscription',
        code: 'UPDATE_SUBSCRIPTION_FAILED',
      },
    });
  }
};

export const deleteSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
      });
      return;
    }

    const { id } = req.params;
    const subscriptionId = typeof id === 'string' ? id : id[0];

    // Check if subscription exists and belongs to user
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: req.user.userId,
      },
    });

    if (!existingSubscription) {
      res.status(404).json({
        error: {
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND',
        },
      });
      return;
    }

    // Soft delete by setting isActive to false
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });

    res.status(200).json({
      message: 'Subscription deleted successfully',
    });
  } catch (error) {
    reportServerError('Delete subscription error', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete subscription',
        code: 'DELETE_SUBSCRIPTION_FAILED',
      },
    });
  }
};

/**
 * POST /api/subscriptions/:id/cancel
 * Stops the subscription renewing. Unlike delete, the subscription stays active
 * (and visible) until its current renewalDate — it just won't renew after that.
 * Idempotent: re-cancelling refreshes cancelledAt.
 */
export const cancelSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' },
      });
      return;
    }

    const { id } = req.params;
    const subscriptionId = typeof id === 'string' ? id : id[0];

    const existingSubscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: req.user.userId },
    });

    if (!existingSubscription) {
      res.status(404).json({
        error: {
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND',
        },
      });
      return;
    }

    // Freeze the end of the current paid period into renewalDate so it stops
    // rolling forward — the sub stays active until this date, then becomes "ended".
    const now = new Date();
    const periodEnd = computeNextRenewal(
      existingSubscription.renewalDate,
      existingSubscription.billingCycle,
      now
    );

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelledAt: now, renewalDate: periodEnd },
    });

    res.status(200).json(withNextRenewal(subscription, now));
  } catch (error) {
    reportServerError('Cancel subscription error', error);
    res.status(500).json({
      error: {
        message: 'Failed to cancel subscription',
        code: 'CANCEL_SUBSCRIPTION_FAILED',
      },
    });
  }
};

/**
 * POST /api/subscriptions/:id/resume
 * Reverses a pending cancellation (clears cancelledAt) so the subscription will
 * renew again. Only meaningful before the period ends, but harmless either way.
 */
export const resumeSubscription = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' },
      });
      return;
    }

    const { id } = req.params;
    const subscriptionId = typeof id === 'string' ? id : id[0];

    const existingSubscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: req.user.userId },
    });

    if (!existingSubscription) {
      res.status(404).json({
        error: {
          message: 'Subscription not found',
          code: 'SUBSCRIPTION_NOT_FOUND',
        },
      });
      return;
    }

    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelledAt: null },
    });

    res.status(200).json(withNextRenewal(subscription));
  } catch (error) {
    reportServerError('Resume subscription error', error);
    res.status(500).json({
      error: {
        message: 'Failed to resume subscription',
        code: 'RESUME_SUBSCRIPTION_FAILED',
      },
    });
  }
};
