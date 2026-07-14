import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import {
  createGrillzSchema,
  updateGrillzSchema,
  type CreateGrillzDto,
  type UpdateGrillzDto,
} from '@grillz/shared-types';
import { GrillzService } from './grillz.service';
import { ManufacturingService } from './manufacturing.service';
import { CurrentUser, RateLimit, type AuthenticatedUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const priceRequestSchema = z.object({
  countryCode: z.string().length(2).default('US'),
  expedited: z.boolean().default(false),
});

@Controller('grillz')
export class GrillzController {
  constructor(
    private readonly grillz: GrillzService,
    private readonly manufacturing: ManufacturingService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createGrillzSchema)) dto: CreateGrillzDto,
  ) {
    return this.grillz.create(user.id, user.role, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.grillz.listForUser(user.id);
  }

  @Get('favorites')
  favorites(@CurrentUser() user: AuthenticatedUser) {
    return this.grillz.listFavorites(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.grillz.getOwned(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGrillzSchema)) dto: UpdateGrillzDto,
  ) {
    return this.grillz.update(id, user.id, user.role, dto);
  }

  @HttpCode(200)
  @Post(':id/price')
  price(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(priceRequestSchema)) dto: z.infer<typeof priceRequestSchema>,
  ) {
    return this.grillz.priceDesign(id, user.id, user.role, dto.countryCode, dto.expedited);
  }

  @HttpCode(200)
  @Post(':id/favorite')
  favorite(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.grillz.toggleFavorite(id, user.id, user.role);
  }

  /** Heavy: rebuilds the shell and writes 4 artifacts to S3. */
  @RateLimit({ limit: 6, windowSec: 60 })
  @HttpCode(200)
  @Post(':id/export')
  async export(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.grillz.getOwned(id, user.id, user.role); // ownership gate
    await this.manufacturing.exportAll(id, user.id);
    return this.manufacturing.presignArtifacts(id);
  }

  @Get(':id/export')
  async artifacts(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.grillz.getOwned(id, user.id, user.role);
    return this.manufacturing.presignArtifacts(id);
  }
}
