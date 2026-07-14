import { z } from 'zod';
import { grillzConfigSchema } from './grillz-config';

/** All money in integer minor units (cents). */

export const priceLineItemSchema = z.object({
  code: z.enum([
    'METAL',
    'STONES',
    'LABOR',
    'PATTERN',
    'ENGRAVING',
    'MANUFACTURING',
    'SHIPPING',
    'TAX',
  ]),
  label: z.string(),
  detail: z.string().optional(),
  amountMinor: z.number().int(),
});
export type PriceLineItem = z.infer<typeof priceLineItemSchema>;

export const priceQuoteInputSchema = z.object({
  config: grillzConfigSchema,
  /** total facial surface area of covered teeth, mm^2 (from scan segmentation) */
  facialSurfaceAreaMm2: z.number().positive(),
  /** destination country ISO-3166 alpha-2, drives tax + shipping */
  countryCode: z.string().length(2).default('US'),
  expedited: z.boolean().default(false),
});
export type PriceQuoteInput = z.infer<typeof priceQuoteInputSchema>;

export const priceQuoteSchema = z.object({
  /** version of the price book the quote was computed against */
  priceBookVersion: z.string(),
  currency: z.literal('USD'),
  input: priceQuoteInputSchema,
  computed: z.object({
    metalVolumeMm3: z.number(),
    metalWeightGrams: z.number(),
    stoneCount: z.number().int(),
    laborHours: z.number(),
  }),
  lineItems: z.array(priceLineItemSchema),
  subtotalMinor: z.number().int(),
  taxMinor: z.number().int(),
  shippingMinor: z.number().int(),
  totalMinor: z.number().int(),
  computedAt: z.string().datetime(),
});
export type PriceQuote = z.infer<typeof priceQuoteSchema>;
