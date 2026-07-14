import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { placeOrderSchema, type PlaceOrderDto } from '@grillz/shared-types';
import { OrdersService } from './orders.service';
import { CurrentUser, RateLimit, type AuthenticatedUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @RateLimit({ limit: 10, windowSec: 60 })
  @Post()
  place(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(placeOrderSchema)) dto: PlaceOrderDto,
  ) {
    return this.orders.place(user.id, user.role, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listForUser(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.getOwned(id, user.id, user.role);
  }

  @Get(':id/invoice')
  invoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.invoice(id, user.id, user.role);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.cancel(id, user.id, user.role);
  }
}
