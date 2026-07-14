import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  grillzConfigSchema,
  materialTypeSchema,
  stoneShapeSchema,
  stoneTypeSchema,
  type AiDesignRequest,
  type AiValidationIssue,
  type GrillzConfig,
} from '@grillz/shared-types';
import type {
  AiProvider,
  DiamondRecommendation,
  MaterialRecommendation,
  RawDesignSuggestion,
  RecommendationContext,
} from '../provider.interface';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

const designsResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        name: z.string().max(60),
        rationale: z.string().max(500),
        config: grillzConfigSchema,
      }),
    )
    .min(1)
    .max(4),
});

const validationResponseSchema = z.object({
  issues: z.array(
    z.object({
      severity: z.enum(['INFO', 'WARNING', 'BLOCKER']),
      code: z.string().max(40),
      message: z.string().max(300),
      field: z.string().max(60).optional(),
    }),
  ),
});

const recommendResponseSchema = z.object({
  materials: z.array(z.object({ material: materialTypeSchema, reason: z.string().max(200) })).max(3),
  diamonds: z
    .array(
      z.object({
        stoneType: stoneTypeSchema,
        shape: stoneShapeSchema,
        reason: z.string().max(200),
      }),
    )
    .max(3),
});

const CONFIG_SHAPE_DOC = `GrillzConfig JSON shape:
{
  "version": 1,
  "setType": "SINGLE|DUO|QUAD|SIX|EIGHT|UPPER|LOWER|FULL_SET",
  "toothNumbers": [FDI numbers, e.g. 11,12,21],
  "material": "GOLD_10K|GOLD_14K|GOLD_18K|WHITE_GOLD|ROSE_GOLD|SILVER|PLATINUM",
  "finish": "GLOSS|MATTE|BRUSHED|HAMMERED",
  "geometry": { "thicknessMm": 0.4-2.5, "offsetMm": 0-0.3, "fitToleranceMm": 0.02-0.25, "chamferMm": 0-0.6, "edgeRadiusMm": 0-0.5 },
  "diamonds": { "enabled": bool, "stoneType": "NATURAL_DIAMOND|LAB_DIAMOND|CZ", "shape": "ROUND|PRINCESS|EMERALD|HEART", "stoneSizeMm": 0.8-3.0, "spacingMm": 0.2-2.0, "density": 0-1 },
  "pattern": "CLASSIC|HONEYCOMB|BAGUETTE|FLOODED|ICED|SNAKE|FLAME|CUSTOM_ENGRAVING",
  "engravingText": "optional, max 24 chars"
}`;

/**
 * Anthropic-backed provider. Prompts request pure JSON; every response is
 * Zod-validated and the caller (AiService) additionally clamps configs, so a
 * malformed or adversarial completion can never reach the client or DB.
 * Failures throw — AiService falls back to the rules provider.
 */
@Injectable()
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic' as const;
  private readonly logger = new Logger(AnthropicAiProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateDesigns(request: AiDesignRequest): Promise<RawDesignSuggestion[]> {
    const budget = request.budgetMinor
      ? `Customer budget: $${(request.budgetMinor / 100).toFixed(0)} USD total.`
      : 'No stated budget.';
    const json = await this.complete(
      `You are the design engine of a custom dental grillz studio.
${CONFIG_SHAPE_DOC}

Customer prompt: "${request.prompt}"
Teeth to cover (FDI): ${request.toothNumbers.join(', ')}
${budget}

Produce exactly 3 distinct design presets as JSON: {"suggestions":[{"name","rationale","config"}]}.
Names ≤ 40 chars, evocative but professional. Rationales ≤ 2 sentences, cite concrete
choices. Configs must use only the teeth listed and respect all numeric ranges.
Vary price tier across the three (statement / balanced / essential).`,
      1600,
    );
    return designsResponseSchema.parse(json).suggestions;
  }

  async validateDesign(config: GrillzConfig): Promise<AiValidationIssue[]> {
    const json = await this.complete(
      `You are a dental-jewelry manufacturing reviewer. Evaluate this grillz design
for manufacturability (casting, stone setting, wearer comfort, bite clearance):

${JSON.stringify(config, null, 2)}

Return JSON {"issues":[{"severity":"INFO|WARNING|BLOCKER","code":"SNAKE_CASE","message","field?"}]}.
Only report real physical/manufacturing concerns; empty array if clean.`,
      1200,
    );
    return validationResponseSchema.parse(json).issues;
  }

  async recommend(context: RecommendationContext): Promise<{
    materials: MaterialRecommendation[];
    diamonds: DiamondRecommendation[];
  }> {
    const budget = context.budgetMinor
      ? `Budget: $${(context.budgetMinor / 100).toFixed(0)} USD.`
      : 'No stated budget.';
    const json = await this.complete(
      `You advise customers of a custom grillz studio on materials and stones.
Style direction: "${context.prompt}". ${budget}
Materials available: GOLD_10K, GOLD_14K, GOLD_18K, WHITE_GOLD, ROSE_GOLD, SILVER, PLATINUM.
Stones: NATURAL_DIAMOND, LAB_DIAMOND, CZ. Shapes: ROUND, PRINCESS, EMERALD, HEART.

Return JSON {"materials":[{"material","reason"}],"diamonds":[{"stoneType","shape","reason"}]}
with at most 3 of each, ordered by fit. Reasons ≤ 1 sentence.`,
      800,
    );
    return recommendResponseSchema.parse(json);
  }

  private async complete(prompt: string, maxTokens: number): Promise<unknown> {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system:
          'You output only valid JSON. No markdown fences, no prose before or after the JSON object.',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
      throw new Error(`Anthropic API error ${res.status}`);
    }

    const payload = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = payload.content?.find((b) => b.type === 'text')?.text;
    if (!text) throw new Error('Anthropic API returned no text content');
    return extractJson(text);
  }
}

/** Tolerates accidental markdown fences around the JSON object. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    : trimmed;
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model response');
  return JSON.parse(unfenced.slice(start, end + 1));
}
