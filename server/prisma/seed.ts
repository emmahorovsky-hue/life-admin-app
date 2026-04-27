import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create test user
  const hashedPassword = await bcrypt.hash('testpass123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
    },
  });

  console.log('✅ Created test user:', user.email);

  // Create sample subscriptions
  const subscriptions = [
    {
      userId: user.id,
      name: 'Netflix Premium',
      cost: new Prisma.Decimal(19.99),
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate: new Date('2026-05-15'),
      category: 'streaming',
      notes: 'Family plan',
    },
    {
      userId: user.id,
      name: 'Spotify Premium',
      cost: new Prisma.Decimal(9.99),
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate: new Date('2026-05-01'),
      category: 'music',
      notes: 'Individual plan',
    },
    {
      userId: user.id,
      name: 'Adobe Creative Cloud',
      cost: new Prisma.Decimal(599.88),
      currency: 'USD',
      billingCycle: 'annual',
      renewalDate: new Date('2026-12-01'),
      category: 'software',
      notes: 'Photography plan',
    },
    {
      userId: user.id,
      name: 'Planet Fitness',
      cost: new Prisma.Decimal(10.00),
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate: new Date('2026-05-10'),
      category: 'fitness',
      notes: 'Black Card membership',
    },
    {
      userId: user.id,
      name: 'iCloud Storage',
      cost: new Prisma.Decimal(2.99),
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate: new Date('2026-05-20'),
      category: 'cloud',
      notes: '200GB plan',
    },
    {
      userId: user.id,
      name: 'GitHub Pro',
      cost: new Prisma.Decimal(4.00),
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate: new Date('2026-05-05'),
      category: 'software',
      notes: 'Developer account',
    },
    {
      userId: user.id,
      name: 'Disney+',
      cost: new Prisma.Decimal(7.99),
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate: new Date('2026-06-01'),
      category: 'streaming',
      notes: 'Standard plan',
    },
    {
      userId: user.id,
      name: 'Xbox Game Pass Ultimate',
      cost: new Prisma.Decimal(16.99),
      currency: 'USD',
      billingCycle: 'monthly',
      renewalDate: new Date('2026-05-25'),
      category: 'gaming',
      notes: 'Includes PC and console',
    },
  ];

  for (const sub of subscriptions) {
    const created = await prisma.subscription.upsert({
      where: { id: `seed-${sub.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: sub,
    });
    console.log(`✅ Created subscription: ${created.name}`);
  }

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
