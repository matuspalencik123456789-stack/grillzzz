import { z } from 'zod';
import { grillzConfigSchema } from './grillz-config';
import { materialTypeSchema, stoneShapeSchema, stoneTypeSchema } from './enums';

export const aiDesignRequestSchema = z.object({
  prompt: z.string().min(3).max(500),
  toothNumbers: z.array(z.number().int()).min(1).max(32),
  budgetMinor: z.number().int().positive().optional(),
});
export type AiDesignRequest = z.infer<typeof aiDesignRequestSchema>;

export const aiDesignSuggestionSchema = z.object({
  name: z.string().max(60),
  rationale: z.string().max(500),
  config: grillzConfigSchema,
  estimatedPriceMinor: z.number().int().nonnegative(),
});
export type AiDesignSuggestion = z.infer<typeof aiDesignSuggestionSchema>;

export const aiDesignResponseSchema = z.object({
  suggestions: z.array(aiDesignSuggestionSchema).min(1).max(4),
  provider: z.enum(['anthropic', 'rules']),
});
export type AiDesignResponse = z.infer<typeof aiDesignResponseSchema>;

export const aiValidationIssueSchema = z.object({
  severity: z.enum(['INFO', 'WARNING', 'BLOCKER']),
  code: z.string(),
  message: z.string(),
  field: z.string().optional(),
});
export type AiValidationIssue = z.infer<typeof aiValidationIssueSchema>;

export const aiValidationReportSchema = z.object({
  manufacturable: z.boolean(),
  issues: z.array(aiValidationIssueSchema),
  provider: z.enum(['anthropic', 'rules']),
});
export type AiValidationReport = z.infer<typeof aiValidationReportSchema>;

export const aiMaterialRecommendationSchema = z.object({
  material: materialTypeSchema,
  reason: z.string(),
});
export const aiDiamondRecommendationSchema = z.object({
  stoneType: stoneTypeSchema,
  shape: stoneShapeSchema,
  reason: z.string(),
});
export const aiRecommendationResponseSchema = z.object({
  materials: z.array(aiMaterialRecommendationSchema).max(3),
  diamonds: z.array(aiDiamondRecommendationSchema).max(3),
  provider: z.enum(['anthropic', 'rules']),
});
export type AiRecommendationResponse = z.infer<typeof aiRecommendationResponseSchema>;
