import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __grillzPrisma: PrismaClient | undefined;
}

/**
 * Singleton PrismaClient. In dev, hot-reload re-evaluates modules; caching on
 * globalThis prevents connection-pool exhaustion. In production each process
 * creates exactly one client.
 */
export function getPrismaClient(): PrismaClient {
  if (!globalThis.__grillzPrisma) {
    globalThis.__grillzPrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return globalThis.__grillzPrisma;
}
