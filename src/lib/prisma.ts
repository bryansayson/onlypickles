import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createClient() {
  const adapter = new PrismaNeonHttp(process.env.DATABASE_URL!, {});
  return new PrismaClient({ adapter });
}

// In development, skip the global cache so that `prisma generate` changes are
// picked up immediately without restarting the dev server. The Neon HTTP
// adapter is stateless (no persistent connection pool), so creating a fresh
// client on each module load is safe.
export const prisma =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient()))
    : createClient();
