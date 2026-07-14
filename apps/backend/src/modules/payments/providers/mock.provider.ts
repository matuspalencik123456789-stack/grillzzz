import { randomUUID } from 'node:crypto';
import type { PaymentIntentResult, PaymentProvider, WebhookEvent } from '../payment-provider.interface';

/**
 * Development/test provider: every intent settles immediately. Selected
 * automatically when no STRIPE_SECRET_KEY is configured so local stacks and
 * CI can exercise the full order → paid → production flow.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createIntent(): Promise<PaymentIntentResult> {
    return { providerRef: `mock_${randomUUID()}`, settled: true };
  }

  async parseWebhook(): Promise<WebhookEvent | null> {
    return null; // mock settles synchronously; no webhooks
  }
}
