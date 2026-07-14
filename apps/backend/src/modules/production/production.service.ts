import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProductionStage } from '@grillz/database';
import { PrismaService } from '../../infra/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

/** Legal stage transitions — production can also loop back to CAD_REVIEW from QC. */
const NEXT_STAGES: Record<ProductionStage, ProductionStage[]> = {
  QUEUED: ['CAD_REVIEW'],
  CAD_REVIEW: ['PRINTING'],
  PRINTING: ['CASTING'],
  CASTING: ['STONE_SETTING', 'POLISHING'],
  STONE_SETTING: ['POLISHING'],
  POLISHING: ['QUALITY_CONTROL'],
  QUALITY_CONTROL: ['SHIPPED', 'CAD_REVIEW'],
  SHIPPED: [],
};

const ORDER_STATUS_BY_STAGE: Partial<Record<ProductionStage, 'IN_PRODUCTION' | 'QUALITY_CHECK' | 'SHIPPED'>> = {
  CAD_REVIEW: 'IN_PRODUCTION',
  QUALITY_CONTROL: 'QUALITY_CHECK',
  SHIPPED: 'SHIPPED',
};

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async queue(filter?: { stage?: ProductionStage }) {
    return this.prisma.productionJob.findMany({
      where: filter?.stage ? { stage: filter.stage } : undefined,
      include: {
        order: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            items: { include: { grillz: { include: { material: true, diamondSetting: true } } } },
          },
        },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async advance(jobId: string, actorId: string, stage: ProductionStage, notes?: string) {
    const job = await this.prisma.productionJob.findUnique({
      where: { id: jobId },
      include: { order: true },
    });
    if (!job) throw new NotFoundException('Production job not found');
    if (!NEXT_STAGES[job.stage].includes(stage)) {
      throw new BadRequestException(
        `Illegal transition ${job.stage} → ${stage}. Allowed: ${NEXT_STAGES[job.stage].join(', ') || 'none'}`,
      );
    }

    const updated = await this.prisma.productionJob.update({
      where: { id: jobId },
      data: {
        stage,
        notes: notes ?? job.notes,
        startedAt: job.startedAt ?? new Date(),
        completedAt: stage === 'SHIPPED' ? new Date() : null,
      },
    });

    const orderStatus = ORDER_STATUS_BY_STAGE[stage];
    if (orderStatus) {
      await this.prisma.order.update({ where: { id: job.orderId }, data: { status: orderStatus } });
    }

    this.audit.record({
      actorId,
      action: 'production.advance',
      entityType: 'ProductionJob',
      entityId: jobId,
      metadata: { from: job.stage, to: stage },
    });
    await this.notifications.notify(job.order.userId, {
      type: 'PRODUCTION_UPDATE',
      title: `Order ${job.order.number}: ${stageLabel(stage)}`,
      body: stageDescription(stage),
      data: { orderId: job.orderId, stage },
    });
    return updated;
  }

  async assign(jobId: string, actorId: string, assigneeId: string | null) {
    const job = await this.prisma.productionJob.update({
      where: { id: jobId },
      data: { assigneeId },
    });
    this.audit.record({
      actorId,
      action: 'production.assign',
      entityType: 'ProductionJob',
      entityId: jobId,
      metadata: { assigneeId },
    });
    return job;
  }
}

function stageLabel(stage: ProductionStage): string {
  return stage.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function stageDescription(stage: ProductionStage): string {
  switch (stage) {
    case 'CAD_REVIEW': return 'Our technicians are reviewing your CAD files.';
    case 'PRINTING': return 'Your model is being 3D printed in casting resin.';
    case 'CASTING': return 'Your piece is being cast in your chosen metal.';
    case 'STONE_SETTING': return 'Stones are being hand-set by our setters.';
    case 'POLISHING': return 'Final finish and polish in progress.';
    case 'QUALITY_CONTROL': return 'Quality control — fit and finish inspection.';
    case 'SHIPPED': return 'Your grillz are on the way!';
    default: return 'Production update.';
  }
}
