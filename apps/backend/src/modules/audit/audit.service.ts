import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@grillz/database';
import { PrismaService } from '../../infra/prisma.module';

export interface AuditEntry {
  actorId?: string | null;
  action: string; // dot-namespaced, e.g. "order.place"
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/**
 * Append-only audit trail. Writes are fire-and-forget: an audit failure is
 * logged but never fails the business operation it documents.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): void {
    void this.prisma.auditLog
      .create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      })
      .catch((err: unknown) => {
        this.logger.error(`audit write failed for ${entry.action}`, err as Error);
      });
  }
}
