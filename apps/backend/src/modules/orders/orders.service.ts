import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type { PlaceOrderDto } from '@grillz/shared-types';
import { PrismaService } from '../../infra/prisma.module';
import { PricingService } from '../pricing/pricing.service';
import { GrillzService } from '../grillz/grillz.service';
import { ManufacturingService } from '../grillz/manufacturing.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { orderPaidTemplate } from '../mail/templates';
import { CONFIG, type AppConfig } from '../../config/config';
import { OrderRepository } from './order.repository';
import { Inject } from '@nestjs/common';

@Injectable()
export class OrdersService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: OrderRepository,
    private readonly pricing: PricingService,
    private readonly grillz: GrillzService,
    private readonly manufacturing: ManufacturingService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    // fulfillment subscribes to settlement; payments stays order-agnostic
    this.payments.onPaymentSucceeded((orderId) => this.handlePaymentSucceeded(orderId));
  }

  /**
   * Order placement:
   * 1. ownership + design state checks
   * 2. quote re-verification against the live price book (tamper/staleness gate)
   * 3. transactional order creation (locks the design)
   * 4. payment intent
   */
  async place(userId: string, role: string, dto: PlaceOrderDto) {
    const design = await this.grillz.getOwned(dto.grillzId, userId, role);
    if (design.status === 'IN_PRODUCTION' || design.status === 'LOCKED') {
      throw new BadRequestException('This design is already part of an order');
    }

    const quoteValid = await this.pricing.verifyQuote(dto.quote);
    if (!quoteValid) {
      throw new BadRequestException(
        'Quote is no longer valid — prices changed since it was computed. Re-price the design.',
      );
    }
    if (dto.quote.input.config.toothNumbers.join(',') !== design.toothNumbers.join(',')) {
      throw new BadRequestException('Quote does not match the current design');
    }

    const order = await this.repository.createPendingOrder({
      userId,
      projectId: design.projectId,
      grillzId: design.id,
      quote: dto.quote,
      shippingAddress: dto.shippingAddress,
    });

    const payment = await this.payments.createPayment(order.id, order.totalMinor, order.currency);

    this.audit.record({
      actorId: userId,
      action: 'order.place',
      entityType: 'Order',
      entityId: order.id,
      metadata: { number: order.number, totalMinor: order.totalMinor },
    });
    await this.notifications.notify(userId, {
      type: 'ORDER_STATUS',
      title: `Order ${order.number} created`,
      body: 'Complete payment to send your design to production.',
      data: { orderId: order.id },
    });

    return { order, payment };
  }

  /** Called by PaymentsService on a confirmed charge (webhook or mock capture). */
  async handlePaymentSucceeded(orderId: string): Promise<void> {
    const order = await this.repository.markPaid(orderId);

    // manufacturing artifacts are generated as soon as the order is real
    const items = await this.prisma.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await this.manufacturing.exportAll(item.grillzId, order.userId).catch(() => {
        // artifact generation failure must not lose the paid order;
        // production staff can re-trigger from the admin queue
      });
    }

    this.audit.record({
      action: 'order.paid',
      entityType: 'Order',
      entityId: orderId,
      metadata: { number: order.number },
    });
    await this.notifications.notify(order.userId, {
      type: 'ORDER_STATUS',
      title: `Order ${order.number} paid`,
      body: 'Your grillz are heading to production. We will keep you posted at every stage.',
      data: { orderId },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { email: true, name: true },
    });
    if (user) {
      await this.mail.sendSafe(
        orderPaidTemplate({
          to: user.email,
          name: user.name,
          orderNumber: order.number,
          totalMinor: order.totalMinor,
          currency: order.currency,
          orderUrl: `${this.config.APP_URL}/orders/${orderId}`,
        }),
      );
    }
  }

  async listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { grillz: { include: { material: true } } } },
        payments: true,
        productionJob: true,
      },
      orderBy: { placedAt: 'desc' },
    });
  }

  async getOwned(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { grillz: { include: { material: true, pattern: true } } } },
        payments: true,
        productionJob: true,
        project: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId && role !== 'ADMIN') throw new ForbiddenException('Not your order');
    return order;
  }

  /** Machine-readable invoice payload rendered by the frontend. */
  async invoice(orderId: string, userId: string, role: string) {
    const order = await this.getOwned(orderId, userId, role);
    const user = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { name: true, email: true },
    });
    return {
      number: order.number,
      issuedAt: order.placedAt,
      status: order.status,
      billTo: { name: user?.name ?? '', email: user?.email ?? '' },
      shippingAddress: order.shippingAddress,
      quote: order.quoteJson,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      taxMinor: order.taxMinor,
      shippingMinor: order.shippingMinor,
      totalMinor: order.totalMinor,
      payments: order.payments.map((p) => ({
        provider: p.provider,
        status: p.status,
        amountMinor: p.amountMinor,
        capturedAt: p.capturedAt,
      })),
    };
  }

  async cancel(orderId: string, userId: string, role: string) {
    const order = await this.getOwned(orderId, userId, role);
    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Only unpaid orders can be cancelled');
    }
    const updated = await this.repository.transitionStatus(orderId, 'CANCELLED');
    await this.prisma.grillz.updateMany({
      where: { id: { in: order.items.map((i) => i.grillzId) } },
      data: { status: 'PRICED' },
    });
    this.audit.record({
      actorId: userId,
      action: 'order.cancel',
      entityType: 'Order',
      entityId: orderId,
    });
    return updated;
  }
}
