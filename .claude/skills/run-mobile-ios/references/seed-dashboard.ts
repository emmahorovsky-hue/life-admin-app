// Example seed for driving the Dashboard through its interesting states.
//
// Copy into `server/` before running (Node cannot resolve @prisma/client from
// outside the workspace), then delete it:
//
//   cp .claude/skills/run-mobile-ios/references/seed-dashboard.ts server/seed-tmp.ts
//   cd server && DATABASE_URL="postgresql://$USER@localhost:5432/lifeadmin_x_demo?schema=public" \
//     npx tsx ./seed-tmp.ts && rm seed-tmp.ts
//
// Register the account over the API first (see SKILL.md §3). Seeding directly with
// Prisma is what lets you control `createdAt`, which the spend-history sparkline
// derives its months from — the API cannot set it.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const monthsAgo = (n: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 15));
};
const inDays = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

async function main() {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'demo@example.com' },
  });
  await prisma.subscription.deleteMany({ where: { userId: user.id } });

  // Two currencies (exercises the multi-currency hero, which appends currency
  // codes), staggered createdAt (gives the sparkline a real shape), and two
  // renewals inside 7 days (exercises the due-soon dot).
  const subs = [
    ['Netflix', '15.99', 'SGD', 'monthly', monthsAgo(4), inDays(3), 'streaming'],
    ['Spotify', '12.99', 'SGD', 'monthly', monthsAgo(3), inDays(12), 'streaming'],
    ['Figma', '15.00', 'USD', 'monthly', monthsAgo(2), inDays(5), 'software'],
    ['Adobe CC', '29.99', 'SGD', 'monthly', monthsAgo(1), inDays(25), 'software'],
    ['Notion', '96.00', 'SGD', 'annual', monthsAgo(2), inDays(18), 'software'],
  ] as const;

  for (const [name, cost, currency, billingCycle, createdAt, renewalDate, category] of subs) {
    await prisma.subscription.create({
      data: { userId: user.id, name, cost, currency, billingCycle, renewalDate, category, createdAt },
    });
  }

  console.log(`seeded ${subs.length} subscriptions for ${user.email}`);
}

main().finally(() => prisma.$disconnect());
