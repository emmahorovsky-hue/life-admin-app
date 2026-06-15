import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { Prisma } from '@prisma/client';
import { extractSubscription } from '../services/aiService';

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
      res.status(503).json({
        error: {
          message:
            'AI extraction is unavailable right now. Please add the subscription manually.',
          code: 'EXTRACTION_UNAVAILABLE',
        },
      });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Extract subscription error:', error);
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

    res.status(201).json(subscription);
  } catch (error) {
    console.error('Create subscription error:', error);
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

    res.status(200).json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
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

    res.status(200).json(subscription);
  } catch (error) {
    console.error('Get subscription error:', error);
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

    res.status(200).json(subscription);
  } catch (error) {
    console.error('Update subscription error:', error);
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
    console.error('Delete subscription error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete subscription',
        code: 'DELETE_SUBSCRIPTION_FAILED',
      },
    });
  }
};
