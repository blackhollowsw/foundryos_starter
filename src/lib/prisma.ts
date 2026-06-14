// FILE: src/lib/prisma.ts
// Purpose: Shared Prisma client singleton using the pg driver adapter.
// The singleton pattern prevents connection exhaustion during Next.js hot reloads.
// Uses the pooled DATABASE_URL at runtime (not the direct URL used for migrations).

import { PrismaClient } from "@prisma/client";
import { PrismaPg }     from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
