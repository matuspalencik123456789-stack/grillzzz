import { describe, expect, it } from 'vitest';
import { defaultGrillzConfig, type PriceQuoteInput } from '@grillz/shared-types';
import { computePhysicals, computeQuote, estimateFacialAreaMm2, quoteMatches } from './compute';
import { DEFAULT_PRICE_BOOK } from './price-book';

function baseInput(overrides: Partial<PriceQuoteInput> = {}): PriceQuoteInput {
  const config = defaultGrillzConfig([11, 12, 21, 22, 13, 23]);
  config.setType = 'SIX';
  return {
    config,
    facialSurfaceAreaMm2: estimateFacialAreaMm2(6),
    countryCode: 'US',
    expedited: false,
    ...overrides,
  };
}

describe('computePhysicals', () => {
  it('derives sane weight for a 6-tooth 14K set', () => {
    const p = computePhysicals(baseInput(), DEFAULT_PRICE_BOOK);
    // 570 mm^2 × ~0.85 mm wall ≈ 480 mm^3 → ~6 g of 14K — typical real-world range
    expect(p.metalWeightGrams).toBeGreaterThan(3);
    expect(p.metalWeightGrams).toBeLessThan(12);
    expect(p.stoneCount).toBe(0);
    expect(p.laborHours).toBeGreaterThan(3);
  });

  it('platinum weighs more than silver for identical geometry', () => {
    const silver = baseInput();
    silver.config = { ...silver.config, material: 'SILVER' };
    const platinum = baseInput();
    platinum.config = { ...platinum.config, material: 'PLATINUM' };
    const ws = computePhysicals(silver, DEFAULT_PRICE_BOOK).metalWeightGrams;
    const wp = computePhysicals(platinum, DEFAULT_PRICE_BOOK).metalWeightGrams;
    expect(wp).toBeGreaterThan(ws * 1.8);
  });

  it('stone count grows with density and shrinks with spacing', () => {
    const dense = baseInput();
    dense.config = {
      ...dense.config,
      diamonds: { ...dense.config.diamonds, enabled: true, density: 0.9, spacingMm: 0.3 },
    };
    const sparse = baseInput();
    sparse.config = {
      ...sparse.config,
      diamonds: { ...sparse.config.diamonds, enabled: true, density: 0.3, spacingMm: 1.5 },
    };
    const nDense = computePhysicals(dense, DEFAULT_PRICE_BOOK).stoneCount;
    const nSparse = computePhysicals(sparse, DEFAULT_PRICE_BOOK).stoneCount;
    expect(nDense).toBeGreaterThan(nSparse);
    expect(nSparse).toBeGreaterThan(0);
  });

  it('thicker walls yield more metal', () => {
    const thin = baseInput();
    thin.config = { ...thin.config, geometry: { ...thin.config.geometry, thicknessMm: 0.5 } };
    const thick = baseInput();
    thick.config = { ...thick.config, geometry: { ...thick.config.geometry, thicknessMm: 2.0 } };
    expect(computePhysicals(thick, DEFAULT_PRICE_BOOK).metalVolumeMm3).toBeGreaterThan(
      computePhysicals(thin, DEFAULT_PRICE_BOOK).metalVolumeMm3 * 2,
    );
  });
});

describe('computeQuote', () => {
  it('line items sum to totals', () => {
    const q = computeQuote(baseInput(), DEFAULT_PRICE_BOOK);
    const sum = q.lineItems.reduce((s, li) => s + li.amountMinor, 0);
    expect(sum).toBe(q.subtotalMinor + q.shippingMinor + q.taxMinor);
    expect(q.totalMinor).toBe(q.subtotalMinor + q.shippingMinor + q.taxMinor);
    expect(q.totalMinor).toBeGreaterThan(0);
  });

  it('natural diamonds cost dramatically more than CZ', () => {
    const cz = baseInput();
    cz.config = { ...cz.config, diamonds: { ...cz.config.diamonds, enabled: true } };
    const nat = baseInput();
    nat.config = {
      ...nat.config,
      diamonds: { ...nat.config.diamonds, enabled: true, stoneType: 'NATURAL_DIAMOND' },
    };
    expect(computeQuote(nat, DEFAULT_PRICE_BOOK).totalMinor).toBeGreaterThan(
      computeQuote(cz, DEFAULT_PRICE_BOOK).totalMinor * 1.5,
    );
  });

  it('international + expedited shipping is applied and taxed per-country', () => {
    const gb = computeQuote(baseInput({ countryCode: 'GB', expedited: true }), DEFAULT_PRICE_BOOK);
    expect(gb.shippingMinor).toBe(
      DEFAULT_PRICE_BOOK.shipping.internationalMinor +
        DEFAULT_PRICE_BOOK.shipping.expeditedSurchargeMinor,
    );
    expect(gb.taxMinor).toBe(Math.round((gb.subtotalMinor + gb.shippingMinor) * 0.2));
  });

  it('unknown country falls back to default tax rate', () => {
    const q = computeQuote(baseInput({ countryCode: 'JP' }), DEFAULT_PRICE_BOOK);
    expect(q.taxMinor).toBe(0);
  });

  it('is deterministic', () => {
    const at = new Date('2026-07-14T00:00:00Z');
    const a = computeQuote(baseInput(), DEFAULT_PRICE_BOOK, at);
    const b = computeQuote(baseInput(), DEFAULT_PRICE_BOOK, at);
    expect(a).toEqual(b);
  });
});

describe('quoteMatches', () => {
  it('accepts an untampered quote', () => {
    const q = computeQuote(baseInput(), DEFAULT_PRICE_BOOK);
    expect(quoteMatches(q, DEFAULT_PRICE_BOOK)).toBe(true);
  });

  it('rejects a tampered total', () => {
    const q = computeQuote(baseInput(), DEFAULT_PRICE_BOOK);
    expect(quoteMatches({ ...q, totalMinor: q.totalMinor - 5000 }, DEFAULT_PRICE_BOOK)).toBe(false);
  });

  it('rejects a stale price-book version', () => {
    const q = computeQuote(baseInput(), DEFAULT_PRICE_BOOK);
    expect(
      quoteMatches({ ...q, priceBookVersion: '2020-01.0' }, DEFAULT_PRICE_BOOK),
    ).toBe(false);
  });
});
