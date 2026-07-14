export interface PaymentIntentResult {
  /** provider's id for the payment (e.g. Stripe PaymentIntent id) */
  providerRef: string;
  /** secret the browser uses to confirm the payment, when applicable */
  clientSecret?: string;
  /** true when the provider settled synchronously (mock/dev) */
  settled: boolean;
}

export interface WebhookEvent {
  type: 'payment.succeeded' | 'payment.failed';
  providerRef: string;
  failureReason?: string;
}

export interface PaymentProvider {
  readonly name: string;
  createIntent(amountMinor: number, currency: string, orderId: string): Promise<PaymentIntentResult>;
  /** Parses + cryptographically verifies a webhook; null = event we don't care about. */
  parseWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<WebhookEvent | null>;
}
