import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { PaymentProvider, WebhookEvent } from './payment-provider.interface';

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER' as const;

export type PaymentSuccessListener = (orderId: string) => Promise<void>;

/**
 * Payment lifecycle. Order fulfillment subscribes via onPaymentSucceeded()
 * (observer pattern) so payments stay ignorant of order semantics and the
 * module graph stays acyclic.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly successListeners: PaymentSuccessListener[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  onPaymentSucceeded(listener: PaymentSuccessListener): void {
    this.successListeners.push(listener);
  }

  async createPayment(orderId: string, amountMinor: number, currency: string) {
    const intent = await this.provider.createIntent(amountMinor, currency, orderId);

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: this.provider.name,
        providerRef: intent.providerRef,
        amountMinor,
        currency,
        status: intent.settled ? 'SUCCEEDED' : 'REQUIRES_ACTION',
        capturedAt: intent.settled ? new Date() : null,
      },
    });
    this.audit.record({
      action: 'payment.create',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { orderId, amountMinor, provider: this.provider.name },
    });

    if (intent.settled) await this.emitSuccess(orderId);

    return {
      paymentId: payment.id,
      provider: this.provider.name,
      status: payment.status,
      clientSecret: intent.clientSecret ?? null,
    };
  }

  async handleWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<void> {
    const event = await this.provider.parseWebhook(rawBody, signatureHeader);
    if (!event) return;
    await this.applyEvent(event);
  }

  private async applyEvent(event: WebhookEvent): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { provider: this.provider.name, providerRef: event.providerRef },
    });
    if (!payment) throw new NotFoundException(`Unknown payment ref ${event.providerRef}`);
    // idempotency: webhooks are at-least-once
    if (payment.status === 'SUCCEEDED' && event.type === 'payment.succeeded') return;

    if (event.type === 'payment.succeeded') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED', capturedAt: new Date() },
      });
      this.audit.record({
        action: 'payment.succeeded',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: { orderId: payment.orderId },
      });
      await this.emitSuccess(payment.orderId);
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureReason: event.failureReason ?? 'declined' },
      });
      this.audit.record({
        action: 'payment.failed',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: { orderId: payment.orderId, reason: event.failureReason },
      });
    }
  }

  private async emitSuccess(orderId: string): Promise<void> {
    for (const listener of this.successListeners) {
      try {
        await listener(orderId);
      } catch (err) {
        // fulfillment failures are recoverable from the admin queue; the
        // payment record itself is already durable
        this.logger.error(`payment success listener failed for order ${orderId}`, err as Error);
      }
    }
  }
}
