import type {
  AiDesignRequest,
  AiValidationIssue,
  GrillzConfig,
  MaterialType,
  StoneShape,
  StoneType,
} from '@grillz/shared-types';

/** Un-priced, un-clamped suggestion as produced by a provider. */
export interface RawDesignSuggestion {
  name: string;
  rationale: string;
  config: GrillzConfig;
}

export interface RecommendationContext {
  prompt: string;
  budgetMinor?: number;
}

export interface MaterialRecommendation {
  material: MaterialType;
  reason: string;
}
export interface DiamondRecommendation {
  stoneType: StoneType;
  shape: StoneShape;
  reason: string;
}

/**
 * Every provider returns the same shapes; AiService clamps configs to
 * manufacturable ranges and prices them, so providers can be creative without
 * being trusted.
 */
export interface AiProvider {
  readonly name: 'anthropic' | 'rules';
  generateDesigns(request: AiDesignRequest): Promise<RawDesignSuggestion[]>;
  validateDesign(config: GrillzConfig): Promise<AiValidationIssue[]>;
  recommend(context: RecommendationContext): Promise<{
    materials: MaterialRecommendation[];
    diamonds: DiamondRecommendation[];
  }>;
}
