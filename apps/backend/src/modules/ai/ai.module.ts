import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService, AI_LLM_PROVIDER } from './ai.service';
import { RulesAiProvider } from './providers/rules.provider';
import { AnthropicAiProvider } from './providers/anthropic.provider';
import { PricingModule } from '../pricing/pricing.module';
import { CONFIG, type AppConfig } from '../../config/config';

@Module({
  imports: [PricingModule],
  controllers: [AiController],
  providers: [
    RulesAiProvider,
    AiService,
    {
      provide: AI_LLM_PROVIDER,
      inject: [CONFIG],
      useFactory: (config: AppConfig) =>
        config.ANTHROPIC_API_KEY
          ? new AnthropicAiProvider(config.ANTHROPIC_API_KEY, config.AI_MODEL)
          : null,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
