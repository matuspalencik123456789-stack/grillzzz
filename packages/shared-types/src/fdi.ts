import { z } from 'zod';

/**
 * FDI World Dental Federation two-digit notation.
 * First digit = quadrant (1 upper-right, 2 upper-left, 3 lower-left, 4 lower-right,
 * from the patient's perspective). Second digit = position 1 (central incisor)
 * through 8 (third molar).
 */

export const FDI_QUADRANTS = [1, 2, 3, 4] as const;
export const FDI_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const ALL_FDI_NUMBERS: readonly number[] = FDI_QUADRANTS.flatMap((q) =>
  FDI_POSITIONS.map((p) => q * 10 + p),
);

export const UPPER_FDI_NUMBERS: readonly number[] = ALL_FDI_NUMBERS.filter((n) => n < 30);
export const LOWER_FDI_NUMBERS: readonly number[] = ALL_FDI_NUMBERS.filter((n) => n >= 30);

/** Anterior "smile zone" typically covered by grillz: canines to canines. */
export const UPPER_FRONT_EIGHT = [14, 13, 12, 11, 21, 22, 23, 24] as const;
export const LOWER_FRONT_EIGHT = [44, 43, 42, 41, 31, 32, 33, 34] as const;

export const fdiNumberSchema = z
  .number()
  .int()
  .refine((n) => ALL_FDI_NUMBERS.includes(n), { message: 'Invalid FDI tooth number' });

export function isUpper(fdi: number): boolean {
  return fdi >= 11 && fdi <= 28;
}

export function isLower(fdi: number): boolean {
  return fdi >= 31 && fdi <= 48;
}

export function quadrant(fdi: number): 1 | 2 | 3 | 4 {
  const q = Math.floor(fdi / 10);
  if (q < 1 || q > 4) throw new RangeError(`Invalid FDI number ${fdi}`);
  return q as 1 | 2 | 3 | 4;
}

export function positionInQuadrant(fdi: number): number {
  return fdi % 10;
}

const POSITION_NAMES = [
  'Central Incisor',
  'Lateral Incisor',
  'Canine',
  'First Premolar',
  'Second Premolar',
  'First Molar',
  'Second Molar',
  'Third Molar',
] as const;

const QUADRANT_NAMES = ['Upper Right', 'Upper Left', 'Lower Left', 'Lower Right'] as const;

export function fdiDisplayName(fdi: number): string {
  const pos = positionInQuadrant(fdi);
  const q = quadrant(fdi);
  const posName = POSITION_NAMES[pos - 1];
  if (!posName) throw new RangeError(`Invalid FDI number ${fdi}`);
  return `${QUADRANT_NAMES[q - 1]} ${posName} (${fdi})`;
}

/**
 * Ordered walk across an arch from the patient's right to left, the order in
 * which teeth appear along the dental arch curve. Used by tooth segmentation
 * and by set-type expansion.
 */
export function archOrder(jaw: 'UPPER' | 'LOWER'): number[] {
  if (jaw === 'UPPER') {
    return [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  }
  return [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
}
