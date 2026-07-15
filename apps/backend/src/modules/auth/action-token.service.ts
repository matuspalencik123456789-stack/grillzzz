import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { ActionTokenPurpose } from '@grillz/database';
import { PrismaService } from '../../infra/prisma.module';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Single-use tokens delivered by email (password reset, email verification).
 * Only the SHA-256 hash is persisted — a database leak exposes nothing usable —
 * and issuing a new token voids any outstanding one for the same purpose.
 */
@Injectable()
export class ActionTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, purpose: ActionTokenPurpose, ttlMs: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.actionToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.actionToken.create({
        data: {
          userId,
          purpose,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + ttlMs),
        },
      }),
    ]);
    return token;
  }

  /** Validates and burns the token; returns the owning user id. */
  async consume(token: string, purpose: ActionTokenPurpose): Promise<string> {
    const stored = await this.prisma.actionToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    // uniform error: no oracle for wrong / expired / spent / cross-purpose tokens
    if (!stored || stored.purpose !== purpose || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('This link is invalid or has expired');
    }
    await this.prisma.actionToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });
    return stored.userId;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
