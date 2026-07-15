import { z } from 'zod';
import {
  grillzSetTypeSchema,
  jawKindSchema,
  orderStatusSchema,
  productionStageSchema,
  projectStatusSchema,
  scanFormatSchema,
} from './enums';
import { grillzConfigSchema } from './grillz-config';
import { priceQuoteSchema } from './pricing';

// ── auth ────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  name: z.string().min(1).max(80),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const federatedLoginSchema = z.object({
  provider: z.literal('google'),
  providerAccountId: z.string().min(1),
  email: z.string().email(),
  name: z.string().max(80).optional(),
  image: z.string().url().optional(),
});
export type FederatedLoginDto = z.infer<typeof federatedLoginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
export type RefreshDto = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().email() });
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(10).max(128),
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

// ── projects ────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});
export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema
  .partial()
  .extend({ status: projectStatusSchema.optional() });
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

// ── scans ───────────────────────────────────────────────────────────────────

export const MAX_SCAN_BYTES = 250 * 1024 * 1024;

export const createScanUploadSchema = z.object({
  projectId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  format: scanFormatSchema,
  fileSizeBytes: z.number().int().positive().max(MAX_SCAN_BYTES),
  jawHint: jawKindSchema.optional(),
});
export type CreateScanUploadDto = z.infer<typeof createScanUploadSchema>;

export const scanUploadTicketSchema = z.object({
  scanId: z.string(),
  uploadUrl: z.string().url(),
  fileKey: z.string(),
  expiresInSeconds: z.number().int(),
});
export type ScanUploadTicket = z.infer<typeof scanUploadTicketSchema>;

export const completeScanUploadSchema = z.object({ scanId: z.string().min(1) });
export type CompleteScanUploadDto = z.infer<typeof completeScanUploadSchema>;

// ── grillz ──────────────────────────────────────────────────────────────────

export const createGrillzSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  setType: grillzSetTypeSchema,
  config: grillzConfigSchema,
});
export type CreateGrillzDto = z.infer<typeof createGrillzSchema>;

export const updateGrillzSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: grillzConfigSchema.optional(),
});
export type UpdateGrillzDto = z.infer<typeof updateGrillzSchema>;

// ── orders ──────────────────────────────────────────────────────────────────

export const shippingAddressSchema = z.object({
  fullName: z.string().min(1).max(120),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1).max(20),
  countryCode: z.string().length(2),
  phone: z.string().max(30).optional(),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const placeOrderSchema = z.object({
  grillzId: z.string().min(1),
  quote: priceQuoteSchema,
  shippingAddress: shippingAddressSchema,
});
export type PlaceOrderDto = z.infer<typeof placeOrderSchema>;

export const updateOrderStatusSchema = z.object({ status: orderStatusSchema });
export const updateProductionStageSchema = z.object({
  stage: productionStageSchema,
  notes: z.string().max(2000).optional(),
});

// ── pagination ──────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationDto = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
