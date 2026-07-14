import { Injectable } from '@nestjs/common';
import { Prisma, type Order, type OrderStatus } from '@grillz/database';
import type { PriceQuote, ShippingAddress } from '@grillz/shared-types';
import { PrismaService } from '../../infra/prisma.module';

/**
 * Repository over the order aggregate. Order creation is transactional and
 * owns its invariants: sequential human-readable numbering, item snapshot,
 * design locking, and production-job creation on payment — none of which may
 * be composed piecemeal by callers.
 */
@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPendingOrder(input: {
    userId: string;
    projectId: string;
    grillzId: string;
    quote: PriceQuote;
    shippingAddress: ShippingAddress;
  }): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const number = await this.nextOrderNumber(tx);
      const order = await tx.order.create({
        data: {
          number,
          userId: input.userId,
          projectId: input.projectId,
          subtotalMinor: input.quote.subtotalMinor,
          taxMinor: input.quote.taxMinor,
          shippingMinor: input.quote.shippingMinor,
          totalMinor: input.quote.totalMinor,
          quoteJson: input.quote as unknown as Prisma.InputJsonValue,
          shippingAddress: input.shippingAddress as unknown as Prisma.InputJsonValue,
          items: {
            create: {
              grillzId: input.grillzId,
              unitPriceMinor: input.quote.totalMinor - input.quote.taxMinor - input.quote.shippingMinor,
            },
          },
        },
      });
      // the design is frozen the moment it is ordered
      await tx.grillz.update({ where: { id: input.grillzId }, data: { status: 'LOCKED' } });
      await tx.project.update({ where: { id: input.projectId }, data: { status: 'ORDERED' } });
      return order;
    });
  }

  /** Payment success → order PAID + production job enqueued, atomically. */
  async markPaid(orderId: string): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
        include: { items: true },
      });
      await tx.productionJob.upsert({
        where: { orderId },
        update: {},
        create: { orderId, stage: 'QUEUED' },
      });
      for (const item of order.items) {
        await tx.grillz.update({ where: { id: item.grillzId }, data: { status: 'IN_PRODUCTION' } });
      }
      return order;
    });
  }

  async transitionStatus(orderId: string, status: OrderStatus): Promise<Order> {
    return this.prisma.order.update({ where: { id: orderId }, data: { status } });
  }

  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `GS-${year}-`;
    const last = await tx.order.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const lastSeq = last ? Number(last.number.slice(prefix.length)) : 0;
    return `${prefix}${String(lastSeq + 1).padStart(6, '0')}`;
  }
}
