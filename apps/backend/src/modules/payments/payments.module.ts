import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService, PAYMENT_PROVIDER } from './payments.service';
import { StripePaymentProvider } from './providers/stripe.provider';
import { MockPaymentProvider } from './providers/mock.provider';
import { CONFIG, type AppConfig } from '../../config/config';
import type { PaymentProvider } from './payment-provider.interface';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [CONFIG],
      useFactory: (config: AppConfig): PaymentProvider =>
        config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET
          ? new StripePaymentProvider(config.STRIPE_SECRET_KEY, config.STRIPE_WEBHOOK_SECRET)
          : new MockPaymentProvider(),
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
