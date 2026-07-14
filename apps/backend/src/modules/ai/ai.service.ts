import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  clampGrillzConfig,
  grillzConfigSchema,
  type AiDesignRequest,
  type AiDesignResponse,
  type AiRecommendationResponse,
  type AiValidationReport,
  type GrillzConfig,
} from '@grillz/shared-types';
import { estimateFacialAreaMm2 } from '@grillz/pricing-engine';
import type { AiProvider, RawDesignSuggestion } from './provider.interface';
import { RulesAiProvider } from './providers/rules.provider';
import { PricingService } from '../pricing/pricing.service';

export const AI_LLM_PROVIDER = 'AI_LLM_PROVIDER' as const;

/**
 * Orchestrates AI features over interchangeable providers. The LLM provider
 * is optional (keyless deployments run rules-only); when present, its
 * failures degrade gracefully to the rules engine. All configs pass through
 * schema validation + manufacturable-range clamping before leaving this
 * service, and price estimates always come from the deterministic pricing
 * engine — never from the model.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly rules: RulesAiProvider,
    private readonly pricing: PricingService,
    @Optional() @Inject(AI_LLM_PROVIDER) private readonly llm: AiProvider | null,
  ) {}

  async generateDesigns(request: AiDesignRequest): Promise<AiDesignResponse> {
    const { provider, result } = await this.withFallback(
      (p) => p.generateDesigns(request),
      'generateDesigns',
    );

    const suggestions = await Promise.all(
      result
        .map((s) => this.sanitize(s, request))
        .filter((s): s is RawDesignSuggestion => s !== null)
        .map(async (s) => ({
          name: s.name,
          rationale: s.rationale,
          config: s.config,
          estimatedPriceMinor: await this.estimatePrice(s.config),
        })),
    );

    if (suggestions.length === 0) {
      // LLM produced garbage across the board — regenerate with rules
      const fallback = await this.rules.generateDesigns(request);
      return {
        provider: 'rules',
        suggestions: await Promise.all(
          fallback.map(async (s) => ({
            name: s.name,
            rationale: s.rationale,
            config: clampGrillzConfig(s.config),
            estimatedPriceMinor: await this.estimatePrice(s.config),
          })),
        ),
      };
    }
    return { provider, suggestions };
  }

  async validateDesign(config: GrillzConfig): Promise<AiValidationReport> {
    // physical rules always run — the LLM can only add findings, not remove them
    const ruleIssues = await this.rules.validateDesign(config);

    let issues = ruleIssues;
    let provider: 'anthropic' | 'rules' = 'rules';
    if (this.llm) {
      try {
        const llmIssues = await this.llm.validateDesign(config);
        const known = new Set(ruleIssues.map((i) => i.code));
        issues = [...ruleIssues, ...llmIssues.filter((i) => !known.has(i.code))];
        provider = this.llm.name;
      } catch (err) {
        this.logger.warn(`LLM validation failed, using rules only: ${(err as Error).message}`);
      }
    }

    return {
      manufacturable: !issues.some((i) => i.severity === 'BLOCKER'),
      issues,
      provider,
    };
  }

  async recommend(prompt: string, budgetMinor?: number): Promise<AiRecommendationResponse> {
    const { provider, result } = await this.withFallback(
      (p) => p.recommend({ prompt, budgetMinor }),
      'recommend',
    );
    return { ...result, provider };
  }

  /** Deterministic estimate used for AI suggestion price tags. */
  async estimatePrice(config: GrillzConfig): Promise<number> {
    const quote = await this.pricing.quote({
      config,
      facialSurfaceAreaMm2: estimateFacialAreaMm2(config.toothNumbers.length),
      countryCode: 'US',
      expedited: false,
    });
    return quote.totalMinor;
  }

  private async withFallback<T>(
    call: (provider: AiProvider) => Promise<T>,
    operation: string,
  ): Promise<{ provider: 'anthropic' | 'rules'; result: T }> {
    if (this.llm) {
      try {
        return { provider: this.llm.name, result: await call(this.llm) };
      } catch (err) {
        this.logger.warn(`LLM ${operation} failed, falling back to rules: ${(err as Error).message}`);
      }
    }
    return { provider: 'rules', result: await call(this.rules) };
  }

  /** Schema-check, restrict to requested teeth, clamp to manufacturable ranges. */
  private sanitize(
    suggestion: RawDesignSuggestion,
    request: AiDesignRequest,
  ): RawDesignSuggestion | null {
    const parsed = grillzConfigSchema.safeParse(suggestion.config);
    if (!parsed.success) return null;
    const allowed = new Set(request.toothNumbers);
    const teeth = parsed.data.toothNumbers.filter((n) => allowed.has(n));
    if (teeth.length === 0) return null;
    return {
      name: suggestion.name.slice(0, 60),
      rationale: suggestion.rationale.slice(0, 500),
      config: clampGrillzConfig({ ...parsed.data, toothNumbers: teeth }),
    };
  }
}
