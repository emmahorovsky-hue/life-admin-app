import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 no longer reads the connection URL from the schema `datasource`
// block — the client must be constructed with a driver adapter, so PrismaPg
// takes DATABASE_URL directly.
//
// This runs at module scope, i.e. before index.ts's requiredEnvVars check in
// its module body (imports resolve first). That's safe only because the pool
// is lazy — nothing connects until the first query — so the missing-env exit
// still wins the race. Any entrypoint that isn't index.ts must check for
// DATABASE_URL itself: pg silently falls back to libpq defaults rather than
// erroring on an undefined connection string (see prisma/seed.ts).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

export default prisma;
