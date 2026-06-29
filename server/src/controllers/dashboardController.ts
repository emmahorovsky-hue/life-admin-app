import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { Prisma } from '@prisma/client';
import { computeNextRenewal, toRenewalIsoString, daysUntil } from '../utils/renewal';

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

    // Get all active subscriptions. Cancelled subs (cancelledAt set) won't renew,
    // so they're excluded from spend totals and upcoming renewals.
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: req.user.userId,
        isActive: true,
        cancelledAt: null,
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

    // Get upcoming renewals (next 30 days). renewalDate is an anchor; roll it
    // forward to the next future occurrence before filtering/sorting.
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingRenewals = subscriptions
      .map((sub) => ({ sub, next: computeNextRenewal(sub.renewalDate, sub.billingCycle, now) }))
      .filter(({ next }) => next <= thirtyDaysFromNow)
      .sort((a, b) => a.next.getTime() - b.next.getTime())
      .slice(0, 5) // Limit to 5 upcoming renewals
      .map(({ sub, next }) => ({
        id: sub.id,
        name: sub.name,
        cost: sub.cost.toString(),
        renewalDate: sub.renewalDate,
        nextRenewalDate: toRenewalIsoString(next),
        daysUntilRenewal: daysUntil(next, now),
        category: sub.category,
      }));

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

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // renewalDate is a stored anchor, so the next occurrence can't be filtered
    // or sorted in Prisma — fetch active subs and roll forward in JS. Cancelled
    // subs won't renew, so they're excluded.
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: req.user.userId,
        isActive: true,
        cancelledAt: null,
      },
    });

    const upcomingRenewals = subscriptions
      .map((sub) => ({ sub, next: computeNextRenewal(sub.renewalDate, sub.billingCycle, now) }))
      .filter(({ next }) => next <= thirtyDaysFromNow)
      .sort((a, b) => a.next.getTime() - b.next.getTime())
      .map(({ sub, next }) => ({
        ...sub,
        nextRenewalDate: toRenewalIsoString(next),
        daysUntilRenewal: daysUntil(next, now),
      }));

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
