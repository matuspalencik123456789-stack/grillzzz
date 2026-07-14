import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { productionStageSchema } from '@grillz/shared-types';
import { ProductionService } from './production.service';
import { CurrentUser, Roles, type AuthenticatedUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const advanceSchema = z.object({
  stage: productionStageSchema,
  notes: z.string().max(2000).optional(),
});
const assignSchema = z.object({ assigneeId: z.string().nullable() });
const queueQuerySchema = z.object({ stage: productionStageSchema.optional() });

@Roles('ADMIN', 'MANUFACTURER')
@Controller('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get('queue')
  queue(@Query(new ZodValidationPipe(queueQuerySchema)) query: z.infer<typeof queueQuerySchema>) {
    return this.production.queue(query);
  }

  @HttpCode(200)
  @Post('jobs/:id/advance')
  advance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(advanceSchema)) dto: z.infer<typeof advanceSchema>,
  ) {
    return this.production.advance(id, user.id, dto.stage, dto.notes);
  }

  @HttpCode(200)
  @Post('jobs/:id/assign')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignSchema)) dto: z.infer<typeof assignSchema>,
  ) {
    return this.production.assign(id, user.id, dto.assigneeId);
  }
}
