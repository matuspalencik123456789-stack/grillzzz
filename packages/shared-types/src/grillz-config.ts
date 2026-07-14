import { z } from 'zod';
import {
  grillzSetTypeSchema,
  materialTypeSchema,
  patternKindSchema,
  stoneShapeSchema,
  stoneTypeSchema,
  surfaceFinishSchema,
} from './enums';
import { fdiNumberSchema } from './fdi';

/**
 * Manufacturable ranges (mm). These are physical constraints of casting and
 * stone setting; both the UI sliders and the server clamp to them.
 */
export const GEOMETRY_LIMITS = {
  thicknessMm: { min: 0.4, max: 2.5, default: 0.8 },
  offsetMm: { min: 0, max: 0.3, default: 0.05 },
  fitToleranceMm: { min: 0.02, max: 0.25, default: 0.08 },
  chamferMm: { min: 0, max: 0.6, default: 0.2 },
  edgeRadiusMm: { min: 0, max: 0.5, default: 0.15 },
  stoneSizeMm: { min: 0.8, max: 3.0, default: 1.5 },
  stoneSpacingMm: { min: 0.2, max: 2.0, default: 0.6 },
} as const;

export const diamondConfigSchema = z.object({
  enabled: z.boolean(),
  stoneType: stoneTypeSchema,
  shape: stoneShapeSchema,
  stoneSizeMm: z
    .number()
    .min(GEOMETRY_LIMITS.stoneSizeMm.min)
    .max(GEOMETRY_LIMITS.stoneSizeMm.max),
  spacingMm: z
    .number()
    .min(GEOMETRY_LIMITS.stoneSpacingMm.min)
    .max(GEOMETRY_LIMITS.stoneSpacingMm.max),
  /** fraction of pavable facial surface covered with stones */
  density: z.number().min(0).max(1),
});
export type DiamondConfig = z.infer<typeof diamondConfigSchema>;

export const grillzGeometrySchema = z.object({
  thicknessMm: z
    .number()
    .min(GEOMETRY_LIMITS.thicknessMm.min)
    .max(GEOMETRY_LIMITS.thicknessMm.max),
  offsetMm: z.number().min(GEOMETRY_LIMITS.offsetMm.min).max(GEOMETRY_LIMITS.offsetMm.max),
  fitToleranceMm: z
    .number()
    .min(GEOMETRY_LIMITS.fitToleranceMm.min)
    .max(GEOMETRY_LIMITS.fitToleranceMm.max),
  chamferMm: z.number().min(GEOMETRY_LIMITS.chamferMm.min).max(GEOMETRY_LIMITS.chamferMm.max),
  edgeRadiusMm: z
    .number()
    .min(GEOMETRY_LIMITS.edgeRadiusMm.min)
    .max(GEOMETRY_LIMITS.edgeRadiusMm.max),
});
export type GrillzGeometry = z.infer<typeof grillzGeometrySchema>;

/**
 * The complete designer document. Stored on Grillz.configJson, edited by the
 * studio UI, priced by @grillz/pricing-engine, consumed by manufacturing export.
 */
export const grillzConfigSchema = z.object({
  version: z.literal(1),
  setType: grillzSetTypeSchema,
  toothNumbers: z.array(fdiNumberSchema).min(1).max(32),
  material: materialTypeSchema,
  finish: surfaceFinishSchema,
  geometry: grillzGeometrySchema,
  diamonds: diamondConfigSchema,
  pattern: patternKindSchema,
  engravingText: z.string().max(24).optional(),
});
export type GrillzConfig = z.infer<typeof grillzConfigSchema>;

export function defaultGrillzConfig(toothNumbers: number[]): GrillzConfig {
  return {
    version: 1,
    setType: 'SINGLE',
    toothNumbers,
    material: 'GOLD_14K',
    finish: 'GLOSS',
    geometry: {
      thicknessMm: GEOMETRY_LIMITS.thicknessMm.default,
      offsetMm: GEOMETRY_LIMITS.offsetMm.default,
      fitToleranceMm: GEOMETRY_LIMITS.fitToleranceMm.default,
      chamferMm: GEOMETRY_LIMITS.chamferMm.default,
      edgeRadiusMm: GEOMETRY_LIMITS.edgeRadiusMm.default,
    },
    diamonds: {
      enabled: false,
      stoneType: 'CZ',
      shape: 'ROUND',
      stoneSizeMm: GEOMETRY_LIMITS.stoneSizeMm.default,
      spacingMm: GEOMETRY_LIMITS.stoneSpacingMm.default,
      density: 0.5,
    },
    pattern: 'CLASSIC',
  };
}

/** Clamp an arbitrary (e.g. AI-generated) partial config into manufacturable ranges. */
export function clampGrillzConfig(config: GrillzConfig): GrillzConfig {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const L = GEOMETRY_LIMITS;
  return {
    ...config,
    geometry: {
      thicknessMm: clamp(config.geometry.thicknessMm, L.thicknessMm.min, L.thicknessMm.max),
      offsetMm: clamp(config.geometry.offsetMm, L.offsetMm.min, L.offsetMm.max),
      fitToleranceMm: clamp(
        config.geometry.fitToleranceMm,
        L.fitToleranceMm.min,
        L.fitToleranceMm.max,
      ),
      chamferMm: clamp(config.geometry.chamferMm, L.chamferMm.min, L.chamferMm.max),
      edgeRadiusMm: clamp(config.geometry.edgeRadiusMm, L.edgeRadiusMm.min, L.edgeRadiusMm.max),
    },
    diamonds: {
      ...config.diamonds,
      stoneSizeMm: clamp(config.diamonds.stoneSizeMm, L.stoneSizeMm.min, L.stoneSizeMm.max),
      spacingMm: clamp(config.diamonds.spacingMm, L.stoneSpacingMm.min, L.stoneSpacingMm.max),
      density: clamp(config.diamonds.density, 0, 1),
    },
  };
}
