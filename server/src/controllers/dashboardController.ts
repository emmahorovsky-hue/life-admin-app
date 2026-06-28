import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { Prisma } from '@prisma/client';

export const getDashboardSummary = async (
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

    // Get all active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: req.user.userId,
        isActive: true,
      },
    });

    // Calculate totals
    let totalMonthlySpend = new Prisma.Decimal(0);
    let totalAnnualSpend = new Prisma.Decimal(0);

    subscriptions.forEach((sub) => {
      const cost = new Prisma.Decimal(sub.cost);
      
      switch (sub.billingCycle.toLowerCase()) {
        case 'monthly':
          totalMonthlySpend = totalMonthlySpend.add(cost);
          totalAnnualSpend = totalAnnualSpend.add(cost.mul(12));
          break;
        case 'annual':
        case 'yearly':
          totalMonthlySpend = totalMonthlySpend.add(cost.div(12));
          totalAnnualSpend = totalAnnualSpend.add(cost);
          break;
        case 'weekly':
          totalMonthlySpend = totalMonthlySpend.add(cost.mul(52).div(12));
          totalAnnualSpend = totalAnnualSpend.add(cost.mul(52));
          break;
        case 'quarterly':
          totalMonthlySpend = totalMonthlySpend.add(cost.div(3));
          totalAnnualSpend = totalAnnualSpend.add(cost.mul(4));
          break;
        default:
          // Default to monthly if billing cycle is unknown
          totalMonthlySpend = totalMonthlySpend.add(cost);
          totalAnnualSpend = totalAnnualSpend.add(cost.mul(12));
      }
    });

    // Get upcoming renewals (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingRenewals = subscriptions
      .filter((sub) => new Date(sub.renewalDate) <= thirtyDaysFromNow)
      .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime())
      .slice(0, 5) // Limit to 5 upcoming renewals
      .map((sub) => {
        const now = new Date();
        const renewal = new Date(sub.renewalDate);
        const daysUntilRenewal = Math.ceil(
          (renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          id: sub.id,
          name: sub.name,
          cost: sub.cost.toString(),
          renewalDate: sub.renewalDate,
          daysUntilRenewal,
          category: sub.category,
        };
      });

    res.status(200).json({
      totalMonthlySpend: parseFloat(totalMonthlySpend.toFixed(2)),
      totalAnnualSpend: parseFloat(totalAnnualSpend.toFixed(2)),
      activeSubscriptions: subscriptions.length,
      upcomingRenewals,
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch dashboard summary',
        code: 'FETCH_DASHBOARD_FAILED',
      },
    });
  }
};

export const getUpcomingRenewals = async (
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

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: req.user.userId,
        isActive: true,
        renewalDate: {
          lte: thirtyDaysFromNow,
        },
      },
      orderBy: {
        renewalDate: 'asc',
      },
    });

    const upcomingRenewals = subscriptions.map((sub) => {
      const now = new Date();
      const renewal = new Date(sub.renewalDate);
      const daysUntilRenewal = Math.ceil(
        (renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...sub,
        daysUntilRenewal,
      };
    });

    res.status(200).json(upcomingRenewals);
  } catch (error) {
    console.error('Get upcoming renewals error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch upcoming renewals',
        code: 'FETCH_UPCOMING_FAILED',
      },
    });
  }
};
