import { describe, expect, it } from 'vitest';
import {
  ALL_FDI_NUMBERS,
  archOrder,
  fdiDisplayName,
  fdiNumberSchema,
  isLower,
  isUpper,
  quadrant,
} from './fdi';

describe('FDI numbering', () => {
  it('enumerates 32 teeth', () => {
    expect(ALL_FDI_NUMBERS).toHaveLength(32);
  });

  it('validates real numbers and rejects fakes', () => {
    expect(fdiNumberSchema.safeParse(11).success).toBe(true);
    expect(fdiNumberSchema.safeParse(48).success).toBe(true);
    expect(fdiNumberSchema.safeParse(19).success).toBe(false);
    expect(fdiNumberSchema.safeParse(50).success).toBe(false);
    expect(fdiNumberSchema.safeParse(0).success).toBe(false);
  });

  it('classifies jaws', () => {
    expect(isUpper(11)).toBe(true);
    expect(isUpper(28)).toBe(true);
    expect(isLower(31)).toBe(true);
    expect(isLower(48)).toBe(true);
    expect(isUpper(31)).toBe(false);
  });

  it('quadrants and names', () => {
    expect(quadrant(23)).toBe(2);
    expect(fdiDisplayName(11)).toBe('Upper Right Central Incisor (11)');
    expect(fdiDisplayName(36)).toBe('Lower Left First Molar (36)');
  });

  it('arch order walks right to left with 16 teeth', () => {
    const upper = archOrder('UPPER');
    expect(upper).toHaveLength(16);
    expect(upper[0]).toBe(18);
    expect(upper[15]).toBe(28);
    expect(archOrder('LOWER')[0]).toBe(48);
  });
});
