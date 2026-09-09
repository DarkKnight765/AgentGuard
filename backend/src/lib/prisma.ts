import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient instance to prevent connection exhaustion.
// Every module imports from here instead of creating its own client.
const prisma = new PrismaClient();

export default prisma;
