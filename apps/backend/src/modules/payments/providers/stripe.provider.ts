import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentIntentResult, PaymentProvider, WebhookEvent } from '../payment-provider.interface';

const API_BASE = 'https://api.stripe.com/v1';
/** reject webhook timestamps older than this (replay protection) */
const TOLERANCE_SEC = 300;

/**
 * Stripe adapter over the REST API (fetch — no SDK dependency to version-chase).
 * Webhook signatures are verified per Stripe's v1 scheme:
 * HMAC-SHA256(secret, "<timestamp>.<rawBody>") compared against the v1 entries.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
  ) {}

  async createIntent(
    amountMinor: number,
    currency: string,
    orderId: string,
  ): Promise<PaymentIntentResult> {
    const body = new URLSearchParams({
      amount: String(amountMinor),
      currency: currency.toLowerCase(),
      'metadata[orderId]': orderId,
      'automatic_payment_methods[enabled]': 'true',
    });
    const res = await fetch(`${API_BASE}/payment_intents`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Stripe intent creation failed ${res.status}: ${detail.slice(0, 300)}`);
      throw new Error(`Stripe error ${res.status}`);
    }
    const intent = (await res.json()) as { id: string; client_secret: string };
    return { providerRef: intent.id, clientSecret: intent.client_secret, settled: false };
  }

  async parseWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<WebhookEvent | null> {
    if (!signatureHeader) throw new Error('Missing Stripe-Signature header');

    const parts = new Map<string, string[]>();
    for (const pair of signatureHeader.split(',')) {
      const [key, value] = pair.split('=', 2);
      if (!key || !value) continue;
      const list = parts.get(key.trim()) ?? [];
      list.push(value.trim());
      parts.set(key.trim(), list);
    }
    const timestamp = parts.get('t')?.[0];
    const signatures = parts.get('v1') ?? [];
    if (!timestamp || signatures.length === 0) throw new Error('Malformed Stripe-Signature header');

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > TOLERANCE_SEC) throw new Error('Stale webhook timestamp');

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');
    const expectedBuf = Buffer.from(expected);
    const valid = signatures.some((sig) => {
      const sigBuf = Buffer.from(sig);
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    });
    if (!valid) throw new Error('Invalid webhook signature');

    const event = JSON.parse(rawBody.toString('utf8')) as {
      type: string;
      data: { object: { id: string; last_payment_error?: { message?: string } } };
    };

    if (event.type === 'payment_intent.succeeded') {
      return { type: 'payment.succeeded', providerRef: event.data.object.id };
    }
    if (event.type === 'payment_intent.payment_failed') {
      return {
        type: 'payment.failed',
        providerRef: event.data.object.id,
        failureReason: event.data.object.last_payment_error?.message,
      };
    }
    return null;
  }
}
