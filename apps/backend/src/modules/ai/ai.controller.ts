import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import {
  aiDesignRequestSchema,
  grillzConfigSchema,
  type AiDesignRequest,
  type GrillzConfig,
} from '@grillz/shared-types';
import { AiService } from './ai.service';
import { RateLimit } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

const recommendSchema = z.object({
  prompt: z.string().min(3).max(500),
  budgetMinor: z.number().int().positive().optional(),
});

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @RateLimit({ limit: 10, windowSec: 60 })
  @HttpCode(200)
  @Post('designs')
  designs(@Body(new ZodValidationPipe(aiDesignRequestSchema)) dto: AiDesignRequest) {
    return this.ai.generateDesigns(dto);
  }

  @RateLimit({ limit: 20, windowSec: 60 })
  @HttpCode(200)
  @Post('validate')
  validate(@Body(new ZodValidationPipe(grillzConfigSchema)) config: GrillzConfig) {
    return this.ai.validateDesign(config);
  }

  @RateLimit({ limit: 20, windowSec: 60 })
  @HttpCode(200)
  @Post('recommend')
  recommend(@Body(new ZodValidationPipe(recommendSchema)) dto: z.infer<typeof recommendSchema>) {
    return this.ai.recommend(dto.prompt, dto.budgetMinor);
  }
}
