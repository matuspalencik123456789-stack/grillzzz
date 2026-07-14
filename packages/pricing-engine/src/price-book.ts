import type { MaterialType, PatternKind, StoneShape, StoneType } from '@grillz/shared-types';

/**
 * The price book is the single versioned input to the pricing engine.
 * Server loads overrides from the Material/Pattern tables and merges them over
 * these defaults; the version string is embedded in every quote so an order
 * can prove which book it was priced against.
 */

export interface MaterialPricing {
  densityGCm3: number;
  pricePerGramMinor: number;
  /** casting difficulty multiplier applied to labor */
  laborFactor: number;
}

export interface PriceBook {
  version: string;
  currency: 'USD';
  materials: Record<MaterialType, MaterialPricing>;
  /** price per stone by type, at 1.5 mm reference size */
  stoneBaseMinor: Record<StoneType, number>;
  /** shape premium multipliers (fancy cuts cost more per stone + setting) */
  stoneShapeFactor: Record<StoneShape, number>;
  patternLaborFactor: Record<PatternKind, number>;
  labor: {
    ratePerHourMinor: number;
    baseHoursPerTooth: number;
    hoursPerStone: number;
    engravingHours: number;
  };
  manufacturing: {
    /** fixed setup: mold, sprue, cleanup */
    setupMinor: number;
    /** per-tooth finishing */
    perToothMinor: number;
  };
  shipping: {
    domesticMinor: number;
    internationalMinor: number;
    expeditedSurchargeMinor: number;
    domesticCountry: string;
  };
  /** sales-tax rate by ISO country (extend with regional providers post-v1) */
  taxRates: Record<string, number>;
  defaultTaxRate: number;
}

export const DEFAULT_PRICE_BOOK: PriceBook = {
  version: '2026-07.1',
  currency: 'USD',
  materials: {
    GOLD_10K: { densityGCm3: 11.6, pricePerGramMinor: 3450, laborFactor: 1 },
    GOLD_14K: { densityGCm3: 13.1, pricePerGramMinor: 4780, laborFactor: 1 },
    GOLD_18K: { densityGCm3: 15.6, pricePerGramMinor: 6120, laborFactor: 1.05 },
    WHITE_GOLD: { densityGCm3: 14.0, pricePerGramMinor: 5150, laborFactor: 1.1 },
    ROSE_GOLD: { densityGCm3: 13.0, pricePerGramMinor: 4890, laborFactor: 1.05 },
    SILVER: { densityGCm3: 10.36, pricePerGramMinor: 210, laborFactor: 0.9 },
    PLATINUM: { densityGCm3: 21.45, pricePerGramMinor: 6890, laborFactor: 1.4 },
  },
  stoneBaseMinor: {
    NATURAL_DIAMOND: 9500,
    LAB_DIAMOND: 3200,
    CZ: 180,
  },
  stoneShapeFactor: {
    ROUND: 1,
    PRINCESS: 1.15,
    EMERALD: 1.3,
    HEART: 1.45,
  },
  patternLaborFactor: {
    CLASSIC: 1,
    HONEYCOMB: 1.35,
    BAGUETTE: 1.6,
    FLOODED: 1.9,
    ICED: 1.7,
    SNAKE: 1.45,
    FLAME: 1.5,
    CUSTOM_ENGRAVING: 1.4,
  },
  labor: {
    ratePerHourMinor: 8500,
    baseHoursPerTooth: 0.75,
    hoursPerStone: 0.05,
    engravingHours: 1.5,
  },
  manufacturing: {
    setupMinor: 4500,
    perToothMinor: 1200,
  },
  shipping: {
    domesticMinor: 1500,
    internationalMinor: 6500,
    expeditedSurchargeMinor: 3500,
    domesticCountry: 'US',
  },
  taxRates: {
    US: 0.0725,
    CA: 0.13,
    GB: 0.2,
    DE: 0.19,
    FR: 0.2,
    AE: 0.05,
  },
  defaultTaxRate: 0,
};
