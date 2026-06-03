import { PrismaClient } from '@prisma/client';
import os from 'os';

// If running tests and DATABASE_URL exists but has no username, inject the OS user.
if (process.env.NODE_ENV === 'test') {
	if (!process.env.DATABASE_URL) {
		const user = os.userInfo().username;
		process.env.DATABASE_URL = `postgresql://${user}@localhost:5432/lifeadmin_test?schema=public`;
	} else {
		try {
			const parsed = new URL(process.env.DATABASE_URL);
			if (!parsed.username) {
				parsed.username = os.userInfo().username;
				// keep empty password if none provided
				process.env.DATABASE_URL = parsed.toString();
			}
		} catch (e) {
			// If parsing fails, leave DATABASE_URL as-is
		}
	}
}

const prisma = new PrismaClient();

export default prisma;
