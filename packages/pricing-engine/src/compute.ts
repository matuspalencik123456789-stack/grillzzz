import type {
  GrillzConfig,
  PriceLineItem,
  PriceQuote,
  PriceQuoteInput,
} from '@grillz/shared-types';
import type { PriceBook } from './price-book';

/**
 * Deterministic physical + commercial model.
 *
 * Metal volume: the grillz shell is the covered facial/incisal surface extruded
 * by wall thickness, plus edge features. volume ≈ area × thickness is the
 * standard first-order estimate used for casting quotes; chamfer and edge
 * radius trims are subtracted as perimeter terms.
 *
 * Stones: pavé packing on the fraction of facial surface given by `density`.
 * Each stone (with its setting seat) occupies a square of (size + spacing)^2.
 */

export interface ComputedPhysicals {
  metalVolumeMm3: number;
  metalWeightGrams: number;
  stoneCount: number;
  laborHours: number;
}

/** Fraction of a tooth's total segmented surface that is facially visible/pavable. */
const FACIAL_FRACTION = 0.45;
/** Perimeter estimate per tooth (mm) used for chamfer/edge-radius volume trims. */
const PERIMETER_PER_TOOTH_MM = 24;

export function computePhysicals(input: PriceQuoteInput, book: PriceBook): ComputedPhysicals {
  const { config, facialSurfaceAreaMm2 } = input;
  const teeth = config.toothNumbers.length;
  const g = config.geometry;

  // shell volume: covered area × (thickness + offset growth), minus edge trims
  const coveredAreaMm2 = facialSurfaceAreaMm2;
  const wallMm = g.thicknessMm + g.offsetMm;
  const grossVolume = coveredAreaMm2 * wallMm;
  // chamfer removes ~half a chamfer^2 wedge along perimeters; edge radius similar
  const perimeterMm = teeth * PERIMETER_PER_TOOTH_MM;
  const chamferTrim = 0.5 * g.chamferMm * g.chamferMm * perimeterMm;
  const radiusTrim = (1 - Math.PI / 4) * g.edgeRadiusMm * g.edgeRadiusMm * perimeterMm;
  const metalVolumeMm3 = Math.max(0, grossVolume - chamferTrim - radiusTrim);

  const material = book.materials[config.material];
  // mm^3 → cm^3 is ÷1000
  const metalWeightGrams = (metalVolumeMm3 / 1000) * material.densityGCm3;

  // stones
  let stoneCount = 0;
  if (config.diamonds.enabled) {
    const pavableAreaMm2 = coveredAreaMm2 * FACIAL_FRACTION * config.diamonds.density;
    const cell = config.diamonds.stoneSizeMm + config.diamonds.spacingMm;
    stoneCount = Math.floor(pavableAreaMm2 / (cell * cell));
  }

  // labor
  const patternFactor = book.patternLaborFactor[config.pattern];
  const baseHours = teeth * book.labor.baseHoursPerTooth * material.laborFactor * patternFactor;
  const stoneHours = stoneCount * book.labor.hoursPerStone;
  const engravingHours =
    config.pattern === 'CUSTOM_ENGRAVING' || config.engravingText ? book.labor.engravingHours : 0;
  const laborHours = round2(baseHours + stoneHours + engravingHours);

  return { metalVolumeMm3: round2(metalVolumeMm3), metalWeightGrams: round2(metalWeightGrams), stoneCount, laborHours };
}

export function computeQuote(
  input: PriceQuoteInput,
  book: PriceBook,
  now: Date = new Date(),
): PriceQuote {
  const physicals = computePhysicals(input, book);
  const { config } = input;
  const material = book.materials[config.material];

  const metalMinor = Math.round(physicals.metalWeightGrams * material.pricePerGramMinor);

  const stoneUnitMinor = Math.round(
    book.stoneBaseMinor[config.diamonds.stoneType] *
      book.stoneShapeFactor[config.diamonds.shape] *
      // stone price scales ~quadratically with linear size relative to 1.5 mm reference
      Math.pow(config.diamonds.stoneSizeMm / 1.5, 2),
  );
  const stonesMinor = physicals.stoneCount * stoneUnitMinor;

  const laborMinor = Math.round(physicals.laborHours * book.labor.ratePerHourMinor);

  const manufacturingMinor =
    book.manufacturing.setupMinor + config.toothNumbers.length * book.manufacturing.perToothMinor;

  const lineItems: PriceLineItem[] = [
    {
      code: 'METAL',
      label: 'Precious metal',
      detail: `${physicals.metalWeightGrams.toFixed(2)} g ${config.material}`,
      amountMinor: metalMinor,
    },
  ];
  if (physicals.stoneCount > 0) {
    lineItems.push({
      code: 'STONES',
      label: 'Stones & setting',
      detail: `${physicals.stoneCount} × ${config.diamonds.shape.toLowerCase()} ${config.diamonds.stoneType.replace('_', ' ').toLowerCase()}`,
      amountMinor: stonesMinor,
    });
  }
  lineItems.push(
    {
      code: 'LABOR',
      label: 'Craftsmanship',
      detail: `${physicals.laborHours.toFixed(2)} h`,
      amountMinor: laborMinor,
    },
    {
      code: 'MANUFACTURING',
      label: 'Manufacturing & finishing',
      detail: `${config.toothNumbers.length} teeth`,
      amountMinor: manufacturingMinor,
    },
  );

  const subtotalMinor = lineItems.reduce((s, li) => s + li.amountMinor, 0);

  const domestic = input.countryCode === book.shipping.domesticCountry;
  let shippingMinor = domestic ? book.shipping.domesticMinor : book.shipping.internationalMinor;
  if (input.expedited) shippingMinor += book.shipping.expeditedSurchargeMinor;
  lineItems.push({
    code: 'SHIPPING',
    label: input.expedited ? 'Expedited insured shipping' : 'Insured shipping',
    amountMinor: shippingMinor,
  });

  const taxRate = book.taxRates[input.countryCode] ?? book.defaultTaxRate;
  const taxMinor = Math.round((subtotalMinor + shippingMinor) * taxRate);
  lineItems.push({
    code: 'TAX',
    label: 'Tax',
    detail: `${(taxRate * 100).toFixed(2)}%`,
    amountMinor: taxMinor,
  });

  return {
    priceBookVersion: book.version,
    currency: 'USD',
    input,
    computed: physicals,
    lineItems,
    subtotalMinor,
    taxMinor,
    shippingMinor,
    totalMinor: subtotalMinor + shippingMinor + taxMinor,
    computedAt: now.toISOString(),
  };
}

/**
 * Order placement re-check: recompute against the current book and compare
 * totals. A quote is acceptable if the book version still matches, or the
 * recomputed total is within tolerance (protects against float drift, catches
 * price-book changes and tampered payloads).
 */
export function quoteMatches(
  quote: PriceQuote,
  book: PriceBook,
  toleranceMinor = 1,
): boolean {
  if (quote.priceBookVersion !== book.version) return false;
  const fresh = computeQuote(quote.input, book, new Date(quote.computedAt));
  return Math.abs(fresh.totalMinor - quote.totalMinor) <= toleranceMinor;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Estimate facial surface area (mm^2) when a scan is not yet segmented. */
export function estimateFacialAreaMm2(toothCount: number): number {
  // average anterior tooth facial+incisal wrap area used for pre-scan quotes
  return toothCount * 95;
}
