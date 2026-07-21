import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { Prisma } from '@prisma/client';
import { computeNextRenewal, toRenewalIsoString, daysUntil } from '../utils/renewal';
import { reportServerError } from '../utils/reportError';

// What one subscription contributes to the monthly and annual spend figures.
const spendContribution = (
  cost: Prisma.Decimal,
  billingCycle: string
): { monthly: Prisma.Decimal; annual: Prisma.Decimal } => {
  switch (billingCycle.toLowerCase()) {
    case 'annual':
    case 'yearly':
      return { monthly: cost.div(12), annual: cost };
    case 'weekly':
      return { monthly: cost.mul(52).div(12), annual: cost.mul(52) };
    case 'quarterly':
      return { monthly: cost.div(3), annual: cost.mul(4) };
    case 'monthly':
    default:
      // Unknown cycles are treated as monthly, as they always have been.
      return { monthly: cost, annual: cost.mul(12) };
  }
};

// Reconstructed monthly-spend history for the last `months` calendar months
// (oldest → newest, current month last), for the dashboard trend sparkline.
//
// There is no charge ledger, so each month is *modelled*: a subscription
// contributes its monthly-normalized cost to month M if it existed by the end of
// M (`createdAt`) and had not been cancelled before M began (`cancelledAt`).
// Soft-deleted subs (isActive=false) carry no timestamp, so they can't be
// reconstructed — an accepted approximation (LIF-212). Per-currency, never
// summed across currencies (LIF-107).
type HistorySub = {
  cost: Prisma.Decimal;
  currency: string;
  billingCycle: string;
  createdAt: Date;
  cancelledAt: Date | null;
};

const computeSpendHistory = (
  subs: HistorySub[],
  now: Date,
  months = 6
): { month: string; byCurrency: { currency: string; total: string }[] }[] => {
  const history = [];
  for (let k = months - 1; k >= 0; k--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)); // exclusive
    const byCurrency = new Map<string, Prisma.Decimal>();

    for (const sub of subs) {
      if (sub.createdAt >= end) continue; // didn't exist yet this month
      if (sub.cancelledAt && sub.cancelledAt < start) continue; // cancelled before it began
      const { monthly } = spendContribution(new Prisma.Decimal(sub.cost), sub.billingCycle);
      byCurrency.set(
        sub.currency,
        (byCurrency.get(sub.currency) ?? new Prisma.Decimal(0)).add(monthly)
      );
    }

    history.push({
      month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
      byCurrency: [...byCurrency.entries()]
        .map(([currency, total]) => ({ currency, total: total.toFixed(2) }))
        .sort(
          (a, b) => parseFloat(b.total) - parseFloat(a.total) || a.currency.localeCompare(b.currency)
        ),
    });
  }
  return history;
};

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

    // History includes cancelled-but-not-deleted subs: they still count toward
    // the months they were active in (see computeSpendHistory).
    const historySubscriptions = await prisma.subscription.findMany({
      where: { userId: req.user.userId, isActive: true },
      select: { cost: true, currency: true, billingCycle: true, createdAt: true, cancelledAt: true },
    });

    // Totals, per currency. There is no exchange-rate source in this project, so
    // costs in different currencies cannot be added into one figure — a $10 +
    // €10 total is meaningless (LIF-107). Clients render one line per currency.
    const spendByCurrency = new Map<
      string,
      { monthly: Prisma.Decimal; annual: Prisma.Decimal; count: number }
    >();

    // Kept for older clients, which read these instead of spendByCurrency: the
    // raw sum across every subscription. Only meaningful for a single-currency
    // user, which is why it isn't what we render any more.
    let totalMonthlySpend = new Prisma.Decimal(0);
    let totalAnnualSpend = new Prisma.Decimal(0);

    subscriptions.forEach((sub) => {
      const { monthly, annual } = spendContribution(
        new Prisma.Decimal(sub.cost),
        sub.billingCycle
      );

      const entry = spendByCurrency.get(sub.currency) ?? {
        monthly: new Prisma.Decimal(0),
        annual: new Prisma.Decimal(0),
        count: 0,
      };
      spendByCurrency.set(sub.currency, {
        monthly: entry.monthly.add(monthly),
        annual: entry.annual.add(annual),
        count: entry.count + 1,
      });

      totalMonthlySpend = totalMonthlySpend.add(monthly);
      totalAnnualSpend = totalAnnualSpend.add(annual);
    });

    // Most-used currency first — that's the one the UI leads with.
    const spend = [...spendByCurrency.entries()]
      .map(([currency, { monthly, annual, count }]) => ({
        currency,
        totalMonthlySpend: monthly.toFixed(2),
        totalAnnualSpend: annual.toFixed(2),
        activeSubscriptions: count,
      }))
      .sort(
        (a, b) =>
          b.activeSubscriptions - a.activeSubscriptions ||
          parseFloat(b.totalMonthlySpend) - parseFloat(a.totalMonthlySpend) ||
          a.currency.localeCompare(b.currency)
      );

    // Get upcoming renewals (next 30 days). renewalDate is an anchor; roll it
    // forward to the next future occurrence before filtering/sorting.
    const now = new Date();
    const spendHistory = computeSpendHistory(historySubscriptions, now, 6);

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

    // Money crosses the API boundary as decimal strings (LIF-125) — same shape
    // as per-item `cost` (Prisma Decimal → JSON string). Clients parse once for
    // display; keeping floats out of the payload avoids precision drift.
    res.status(200).json({
      totalMonthlySpend: totalMonthlySpend.toFixed(2),
      totalAnnualSpend: totalAnnualSpend.toFixed(2),
      activeSubscriptions: subscriptions.length,
      spendByCurrency: spend,
      spendHistory,
      upcomingRenewals,
    });
  } catch (error) {
    reportServerError('Get dashboard summary error', error);
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
    reportServerError('Get upcoming renewals error', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch upcoming renewals',
        code: 'FETCH_UPCOMING_FAILED',
      },
    });
  }
};
