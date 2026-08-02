import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 no longer reads the connection URL from the schema `datasource`
// block — the client must be constructed with a driver adapter. PrismaPg
// takes DATABASE_URL directly (the server already fails fast without it).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = new PrismaClient({ adapter });

export default prisma;
