import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  completeScanUploadSchema,
  createScanUploadSchema,
  type CompleteScanUploadDto,
  type CreateScanUploadDto,
} from '@grillz/shared-types';
import { ScansService } from './scans.service';
import { CurrentUser, RateLimit, type AuthenticatedUser } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@Controller('scans')
export class ScansController {
  constructor(private readonly scans: ScansService) {}

  @RateLimit({ limit: 20, windowSec: 60 })
  @Post('uploads')
  createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createScanUploadSchema)) dto: CreateScanUploadDto,
  ) {
    return this.scans.createUpload(user.id, user.role, dto);
  }

  @HttpCode(200)
  @Post('uploads/complete')
  completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(completeScanUploadSchema)) dto: CompleteScanUploadDto,
  ) {
    return this.scans.completeUpload(user.id, user.role, dto.scanId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scans.get(id, user.id, user.role);
  }

  @Get(':id/mesh-url')
  meshUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scans.getMeshUrl(id, user.id, user.role);
  }

  @Get(':id/thumbnail-url')
  thumbnailUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scans.getThumbnailUrl(id, user.id, user.role);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.scans.remove(id, user.id, user.role);
  }
}
