import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { priceQuoteInputSchema, type PriceQuoteInput } from '@grillz/shared-types';
import { PricingService } from './pricing.service';
import { RateLimit } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** Realtime quote endpoint; the client previews with the same engine locally. */
  @RateLimit({ limit: 300, windowSec: 60 })
  @HttpCode(200)
  @Post('quote')
  quote(@Body(new ZodValidationPipe(priceQuoteInputSchema)) input: PriceQuoteInput) {
    return this.pricing.quote(input);
  }
}
