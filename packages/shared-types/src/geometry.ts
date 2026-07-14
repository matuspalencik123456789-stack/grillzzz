import { z } from 'zod';

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof vec3Schema>;

export const boundingBoxSchema = z.object({
  min: vec3Schema,
  max: vec3Schema,
});
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

export const meshStatsSchema = z.object({
  vertexCount: z.number().int().nonnegative(),
  triangleCount: z.number().int().nonnegative(),
  surfaceAreaMm2: z.number().nonnegative(),
  volumeMm3: z.number().nonnegative(),
  watertight: z.boolean(),
});
export type MeshStats = z.infer<typeof meshStatsSchema>;

export const triangleRangeSchema = z.object({
  start: z.number().int().nonnegative(),
  count: z.number().int().positive(),
});
export type TriangleRange = z.infer<typeof triangleRangeSchema>;

export const toothRegionSchema = z.object({
  fdiNumber: z.number().int(),
  centroid: vec3Schema,
  boundingBox: boundingBoxSchema,
  surfaceAreaMm2: z.number().nonnegative(),
  triangleRange: triangleRangeSchema,
  confidence: z.number().min(0).max(1),
});
export type ToothRegion = z.infer<typeof toothRegionSchema>;
