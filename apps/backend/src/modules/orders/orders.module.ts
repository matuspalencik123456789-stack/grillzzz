import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderRepository } from './order.repository';
import { PricingModule } from '../pricing/pricing.module';
import { GrillzModule } from '../grillz/grillz.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PricingModule, GrillzModule, PaymentsModule, NotificationsModule, MailModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderRepository],
  exports: [OrdersService, OrderRepository],
})
export class OrdersModule {}
