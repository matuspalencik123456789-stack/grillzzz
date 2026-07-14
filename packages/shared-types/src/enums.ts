import { z } from 'zod';

/**
 * Zod mirrors of Prisma enums. These are the wire-format source of truth;
 * a unit test asserts they stay in sync with the generated Prisma client.
 */

export const roleSchema = z.enum(['CUSTOMER', 'MANUFACTURER', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const organizationTypeSchema = z.enum(['STUDIO', 'MANUFACTURER']);
export type OrganizationType = z.infer<typeof organizationTypeSchema>;

export const projectStatusSchema = z.enum([
  'DRAFT',
  'SCANNING',
  'DESIGNING',
  'REVIEW',
  'ORDERED',
  'ARCHIVED',
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const scanFormatSchema = z.enum(['STL', 'PLY', 'OBJ', 'GLB', 'GLTF']);
export type ScanFormat = z.infer<typeof scanFormatSchema>;

export const jawKindSchema = z.enum(['UPPER', 'LOWER', 'FULL', 'UNKNOWN']);
export type JawKind = z.infer<typeof jawKindSchema>;

export const scanStatusSchema = z.enum([
  'AWAITING_UPLOAD',
  'UPLOADED',
  'VALIDATING',
  'OPTIMIZING',
  'ANALYZING',
  'SEGMENTING',
  'READY',
  'FAILED',
]);
export type ScanStatus = z.infer<typeof scanStatusSchema>;

export const materialTypeSchema = z.enum([
  'GOLD_10K',
  'GOLD_14K',
  'GOLD_18K',
  'WHITE_GOLD',
  'ROSE_GOLD',
  'SILVER',
  'PLATINUM',
]);
export type MaterialType = z.infer<typeof materialTypeSchema>;

export const surfaceFinishSchema = z.enum(['GLOSS', 'MATTE', 'BRUSHED', 'HAMMERED']);
export type SurfaceFinish = z.infer<typeof surfaceFinishSchema>;

export const stoneTypeSchema = z.enum(['NATURAL_DIAMOND', 'LAB_DIAMOND', 'CZ']);
export type StoneType = z.infer<typeof stoneTypeSchema>;

export const stoneShapeSchema = z.enum(['ROUND', 'PRINCESS', 'EMERALD', 'HEART']);
export type StoneShape = z.infer<typeof stoneShapeSchema>;

export const patternKindSchema = z.enum([
  'CLASSIC',
  'HONEYCOMB',
  'BAGUETTE',
  'FLOODED',
  'ICED',
  'SNAKE',
  'FLAME',
  'CUSTOM_ENGRAVING',
]);
export type PatternKind = z.infer<typeof patternKindSchema>;

export const grillzSetTypeSchema = z.enum([
  'SINGLE',
  'DUO',
  'QUAD',
  'SIX',
  'EIGHT',
  'UPPER',
  'LOWER',
  'FULL_SET',
]);
export type GrillzSetType = z.infer<typeof grillzSetTypeSchema>;

export const grillzStatusSchema = z.enum([
  'DRAFT',
  'PRICED',
  'LOCKED',
  'IN_PRODUCTION',
  'COMPLETED',
]);
export type GrillzStatus = z.infer<typeof grillzStatusSchema>;

export const orderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'PAID',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentStatusSchema = z.enum([
  'REQUIRES_ACTION',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const productionStageSchema = z.enum([
  'QUEUED',
  'CAD_REVIEW',
  'PRINTING',
  'CASTING',
  'STONE_SETTING',
  'POLISHING',
  'QUALITY_CONTROL',
  'SHIPPED',
]);
export type ProductionStage = z.infer<typeof productionStageSchema>;

export const renderJobTypeSchema = z.enum([
  'THUMBNAIL',
  'TURNTABLE',
  'EXPORT_STL',
  'EXPORT_OBJ',
  'EXPORT_GLTF',
  'PRODUCTION_PDF',
]);
export type RenderJobType = z.infer<typeof renderJobTypeSchema>;

export const notificationTypeSchema = z.enum([
  'SCAN_READY',
  'SCAN_FAILED',
  'QUOTE_READY',
  'ORDER_STATUS',
  'PRODUCTION_UPDATE',
  'SYSTEM',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;
