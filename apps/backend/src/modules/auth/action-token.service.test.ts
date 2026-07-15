import { describe, expect, it } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ActionTokenService, hashToken, RESET_TOKEN_TTL_MS } from './action-token.service';
import type { PrismaService } from '../../infra/prisma.module';

interface StoredToken {
  id: string;
  userId: string;
  purpose: 'PASSWORD_RESET' | 'EMAIL_VERIFICATION';
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/** In-memory stand-in exposing exactly the prisma surface the service touches. */
function fakePrisma() {
  const rows: StoredToken[] = [];
  let nextId = 1;
  const actionToken = {
    updateMany: async ({ where, data }: { where: Partial<StoredToken>; data: { usedAt: Date } }) => {
      for (const row of rows) {
        if (
          (where.userId === undefined || row.userId === where.userId) &&
          (where.purpose === undefined || row.purpose === where.purpose) &&
          (!('usedAt' in where) || row.usedAt === where.usedAt)
        ) {
          row.usedAt = data.usedAt;
        }
      }
    },
    create: async ({ data }: { data: Omit<StoredToken, 'id' | 'usedAt'> }) => {
      const row: StoredToken = { ...data, id: String(nextId++), usedAt: null };
      rows.push(row);
      return row;
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: { usedAt: Date } }) => {
      const row = rows.find((r) => r.id === where.id);
      if (row) row.usedAt = data.usedAt;
      return row;
    },
  };
  return {
    rows,
    prisma: {
      actionToken,
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    } as unknown as PrismaService,
  };
}

describe('ActionTokenService', () => {
  it('issues an opaque token and stores only its hash', async () => {
    const { rows, prisma } = fakePrisma();
    const service = new ActionTokenService(prisma);

    const token = await service.issue('user-1', 'PASSWORD_RESET', RESET_TOKEN_TTL_MS);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(rows[0].tokenHash).not.toContain(token);
  });

  it('consume returns the owner exactly once', async () => {
    const { prisma } = fakePrisma();
    const service = new ActionTokenService(prisma);

    const token = await service.issue('user-1', 'PASSWORD_RESET', RESET_TOKEN_TTL_MS);
    expect(await service.consume(token, 'PASSWORD_RESET')).toBe('user-1');
    await expect(service.consume(token, 'PASSWORD_RESET')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects wrong-purpose, expired, and unknown tokens uniformly', async () => {
    const { prisma } = fakePrisma();
    const service = new ActionTokenService(prisma);

    const crossPurpose = await service.issue('user-1', 'EMAIL_VERIFICATION', RESET_TOKEN_TTL_MS);
    await expect(service.consume(crossPurpose, 'PASSWORD_RESET')).rejects.toThrow(
      UnauthorizedException,
    );

    const expired = await service.issue('user-2', 'PASSWORD_RESET', -1);
    await expect(service.consume(expired, 'PASSWORD_RESET')).rejects.toThrow(UnauthorizedException);

    await expect(service.consume('never-issued-token-value', 'PASSWORD_RESET')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('re-issuing voids the previous outstanding token of the same purpose', async () => {
    const { prisma } = fakePrisma();
    const service = new ActionTokenService(prisma);

    const first = await service.issue('user-1', 'PASSWORD_RESET', RESET_TOKEN_TTL_MS);
    const second = await service.issue('user-1', 'PASSWORD_RESET', RESET_TOKEN_TTL_MS);

    await expect(service.consume(first, 'PASSWORD_RESET')).rejects.toThrow(UnauthorizedException);
    expect(await service.consume(second, 'PASSWORD_RESET')).toBe('user-1');
  });
});
