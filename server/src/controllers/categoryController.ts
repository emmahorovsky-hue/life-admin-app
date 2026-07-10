import { Request, Response } from 'express';
import { CATEGORIES } from '../constants/subscriptions';
import { reportServerError } from '../utils/reportError';

export const getCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    res.status(200).json(CATEGORIES);
  } catch (error) {
    reportServerError('Get categories error', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch categories',
        code: 'FETCH_CATEGORIES_FAILED',
      },
    });
  }
};
