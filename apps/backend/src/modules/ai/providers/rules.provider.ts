import { Injectable } from '@nestjs/common';
import {
  defaultGrillzConfig,
  type AiDesignRequest,
  type AiValidationIssue,
  type GrillzConfig,
  type MaterialType,
  type PatternKind,
  type StoneShape,
  type StoneType,
  type SurfaceFinish,
  GEOMETRY_LIMITS,
  isUpper,
  isLower,
} from '@grillz/shared-types';
import type {
  AiProvider,
  DiamondRecommendation,
  MaterialRecommendation,
  RawDesignSuggestion,
  RecommendationContext,
} from '../provider.interface';

interface StyleAttributes {
  material?: MaterialType;
  finish?: SurfaceFinish;
  pattern?: PatternKind;
  stoneType?: StoneType;
  shape?: StoneShape;
  diamonds?: boolean;
  density?: number;
}

interface StyleSignal extends StyleAttributes {
  keywords: string[];
}

/**
 * Deterministic design generator. Extracts style signals from the prompt with
 * a keyword lexicon and composes three coherent presets (statement / balanced
 * / essential). This is the always-available fallback when no LLM key is
 * configured — and the reference behavior the LLM output is judged against
 * in tests.
 */
const STYLE_SIGNALS: StyleSignal[] = [
  { keywords: ['miami', 'flashy', 'flooded', 'bust down', 'bussdown'], pattern: 'FLOODED', diamonds: true, density: 0.9 },
  { keywords: ['iced', 'ice', 'frosty', 'vvs'], pattern: 'ICED', diamonds: true, density: 0.75 },
  { keywords: ['luxury', 'luxe', 'premium', 'high end'], material: 'GOLD_18K', finish: 'GLOSS' },
  { keywords: ['classic', 'clean', 'simple', 'minimal'], pattern: 'CLASSIC', diamonds: false },
  { keywords: ['rose', 'pink'], material: 'ROSE_GOLD' },
  { keywords: ['white gold', 'silver look', 'chrome'], material: 'WHITE_GOLD' },
  { keywords: ['platinum'], material: 'PLATINUM' },
  { keywords: ['silver', 'budget', 'affordable', 'cheap', 'starter'], material: 'SILVER', stoneType: 'CZ' },
  { keywords: ['matte', 'stealth', 'subtle'], finish: 'MATTE' },
  { keywords: ['brushed', 'industrial'], finish: 'BRUSHED' },
  { keywords: ['hammered', 'organic', 'artisan'], finish: 'HAMMERED' },
  { keywords: ['honeycomb', 'hex'], pattern: 'HONEYCOMB' },
  { keywords: ['baguette'], pattern: 'BAGUETTE', diamonds: true, shape: 'EMERALD' },
  { keywords: ['snake', 'serpent', 'scale'], pattern: 'SNAKE' },
  { keywords: ['flame', 'fire'], pattern: 'FLAME' },
  { keywords: ['heart', 'love', 'romantic'], shape: 'HEART', diamonds: true },
  { keywords: ['princess'], shape: 'PRINCESS', diamonds: true },
  { keywords: ['emerald cut'], shape: 'EMERALD', diamonds: true },
  { keywords: ['natural diamond', 'real diamond'], stoneType: 'NATURAL_DIAMOND', diamonds: true },
  { keywords: ['lab diamond', 'lab grown', 'lab-grown'], stoneType: 'LAB_DIAMOND', diamonds: true },
];

@Injectable()
export class RulesAiProvider implements AiProvider {
  readonly name = 'rules' as const;

  async generateDesigns(request: AiDesignRequest): Promise<RawDesignSuggestion[]> {
    const prompt = request.prompt.toLowerCase();
    const matched = STYLE_SIGNALS.filter((s) => s.keywords.some((k) => prompt.includes(k)));

    const merged: StyleAttributes = {};
    for (const { keywords: _keywords, ...attributes } of matched) Object.assign(merged, attributes);

    const budgetTight =
      request.budgetMinor !== undefined && request.budgetMinor < 150_000; // < $1,500

    const base = this.applySignals(defaultGrillzConfig(request.toothNumbers), merged, request);

    const statement: GrillzConfig = {
      ...base,
      material: budgetTight ? base.material : merged.material ?? 'GOLD_18K',
      pattern: merged.pattern ?? (merged.diamonds === false ? 'CLASSIC' : 'ICED'),
      diamonds: {
        ...base.diamonds,
        enabled: merged.diamonds ?? true,
        density: merged.density ?? 0.75,
        stoneType: merged.stoneType ?? (budgetTight ? 'CZ' : 'LAB_DIAMOND'),
      },
    };
    const balanced: GrillzConfig = {
      ...base,
      pattern: merged.pattern ?? 'CLASSIC',
      diamonds: {
        ...base.diamonds,
        enabled: merged.diamonds ?? false,
        density: Math.min(0.5, merged.density ?? 0.5),
        stoneType: merged.stoneType ?? 'CZ',
      },
    };
    const essential: GrillzConfig = {
      ...base,
      material: budgetTight ? 'SILVER' : 'GOLD_10K',
      finish: merged.finish ?? 'GLOSS',
      pattern: 'CLASSIC',
      diamonds: { ...base.diamonds, enabled: false },
    };

    return [
      {
        name: this.title(merged, 'Statement'),
        rationale: this.rationale(merged, 'maximum presence: full coverage styling with the boldest stone work the prompt supports'),
        config: statement,
      },
      {
        name: this.title(merged, 'Signature'),
        rationale: this.rationale(merged, 'balanced daily-wear take on the same style cues'),
        config: balanced,
      },
      {
        name: this.title(merged, 'Essential'),
        rationale: this.rationale(merged, 'entry point that keeps the look while minimizing metal and stone cost'),
        config: essential,
      },
    ];
  }

  async validateDesign(config: GrillzConfig): Promise<AiValidationIssue[]> {
    const issues: AiValidationIssue[] = [];
    const g = config.geometry;
    const L = GEOMETRY_LIMITS;

    if (g.thicknessMm < 0.6) {
      issues.push({
        severity: 'WARNING',
        code: 'THIN_WALL',
        message: `Wall thickness ${g.thicknessMm.toFixed(2)} mm is castable but fragile for daily wear; 0.8 mm+ recommended`,
        field: 'geometry.thicknessMm',
      });
    }
    if (g.thicknessMm > 1.8) {
      issues.push({
        severity: 'WARNING',
        code: 'HEAVY_WALL',
        message: 'Walls above 1.8 mm add weight and bite interference',
        field: 'geometry.thicknessMm',
      });
    }
    if (g.fitToleranceMm < 0.05) {
      issues.push({
        severity: 'WARNING',
        code: 'TIGHT_FIT',
        message: 'Fit tolerance below 0.05 mm frequently requires manual refitting',
        field: 'geometry.fitToleranceMm',
      });
    }
    if (config.diamonds.enabled) {
      const seat = config.diamonds.stoneSizeMm * 0.6; // pavilion depth ≈ 60% of diameter
      if (seat > g.thicknessMm + g.offsetMm) {
        issues.push({
          severity: 'BLOCKER',
          code: 'STONE_SEAT_DEPTH',
          message: `${config.diamonds.stoneSizeMm.toFixed(1)} mm stones need ~${seat.toFixed(2)} mm seats — deeper than the ${(g.thicknessMm + g.offsetMm).toFixed(2)} mm wall. Increase thickness or reduce stone size`,
          field: 'diamonds.stoneSizeMm',
        });
      }
      if (config.diamonds.spacingMm < 0.3 && config.diamonds.stoneType !== 'CZ') {
        issues.push({
          severity: 'WARNING',
          code: 'DENSE_PAVE',
          message: 'Sub-0.3 mm spacing on diamond pavé raises setting-loss risk; expect longer lead time',
          field: 'diamonds.spacingMm',
        });
      }
    }
    if (config.pattern === 'CUSTOM_ENGRAVING' && !config.engravingText) {
      issues.push({
        severity: 'BLOCKER',
        code: 'MISSING_ENGRAVING_TEXT',
        message: 'Custom engraving selected but no engraving text provided',
        field: 'engravingText',
      });
    }
    if (config.engravingText && config.toothNumbers.length < 2) {
      issues.push({
        severity: 'INFO',
        code: 'ENGRAVING_SPACE',
        message: 'Engravings on a single tooth are limited to ~6 characters of legible height',
        field: 'engravingText',
      });
    }
    const mixesJaws =
      config.toothNumbers.some((n) => isUpper(n)) && config.toothNumbers.some((n) => isLower(n));
    if (mixesJaws && config.setType !== 'FULL_SET') {
      issues.push({
        severity: 'BLOCKER',
        code: 'MIXED_JAWS',
        message: 'Selection spans both jaws — a single piece cannot bridge jaws; use a Full Set (two pieces)',
        field: 'toothNumbers',
      });
    }
    if (g.chamferMm > L.chamferMm.max * 0.8 && config.finish === 'HAMMERED') {
      issues.push({
        severity: 'INFO',
        code: 'CHAMFER_FINISH',
        message: 'Large chamfers soften hammered texture at the margins',
        field: 'geometry.chamferMm',
      });
    }
    return issues;
  }

  async recommend(context: RecommendationContext): Promise<{
    materials: MaterialRecommendation[];
    diamonds: DiamondRecommendation[];
  }> {
    const prompt = context.prompt.toLowerCase();
    const budgetTight = context.budgetMinor !== undefined && context.budgetMinor < 150_000;

    const materials: MaterialRecommendation[] = [];
    if (budgetTight) {
      materials.push(
        { material: 'SILVER', reason: 'Delivers the look within a tight budget; rhodium plating available' },
        { material: 'GOLD_10K', reason: 'Lowest-cost real gold; hardest alloy, most scratch resistant' },
      );
    } else if (prompt.includes('luxury') || prompt.includes('premium')) {
      materials.push(
        { material: 'GOLD_18K', reason: 'Richest color and the traditional luxury standard for grillz' },
        { material: 'PLATINUM', reason: 'Heaviest, most prestigious white metal; hypoallergenic' },
      );
    } else {
      materials.push(
        { material: 'GOLD_14K', reason: 'The best balance of color, durability and price for daily wear' },
        { material: 'GOLD_18K', reason: 'Step-up option with deeper color if budget allows' },
      );
    }
    if (prompt.includes('rose') || prompt.includes('pink')) {
      materials.unshift({ material: 'ROSE_GOLD', reason: 'Matches the requested rose/pink direction' });
    }

    const diamonds: DiamondRecommendation[] = budgetTight
      ? [
          { stoneType: 'CZ', shape: 'ROUND', reason: 'Full iced look at a fraction of stone cost' },
          { stoneType: 'LAB_DIAMOND', shape: 'ROUND', reason: 'Real diamond brilliance ~65% below natural pricing' },
        ]
      : [
          { stoneType: 'LAB_DIAMOND', shape: 'ROUND', reason: 'Identical optics to natural at far better value; round maximizes sparkle in pavé' },
          { stoneType: 'NATURAL_DIAMOND', shape: 'ROUND', reason: 'For provenance-first buyers; certificates available per stone' },
        ];
    if (prompt.includes('baguette')) {
      diamonds.unshift({ stoneType: 'LAB_DIAMOND', shape: 'EMERALD', reason: 'Emerald cuts read as baguette channels on the facial surface' });
    }

    return { materials: materials.slice(0, 3), diamonds: diamonds.slice(0, 3) };
  }

  private applySignals(base: GrillzConfig, merged: StyleAttributes, request: AiDesignRequest): GrillzConfig {
    return {
      ...base,
      setType: this.setTypeFor(request.toothNumbers),
      material: merged.material ?? base.material,
      finish: merged.finish ?? base.finish,
      pattern: merged.pattern ?? base.pattern,
      diamonds: {
        ...base.diamonds,
        enabled: merged.diamonds ?? base.diamonds.enabled,
        stoneType: merged.stoneType ?? base.diamonds.stoneType,
        shape: merged.shape ?? base.diamonds.shape,
        density: merged.density ?? base.diamonds.density,
      },
    };
  }

  private setTypeFor(teeth: number[]): GrillzConfig['setType'] {
    const uppers = teeth.filter((n) => isUpper(n)).length;
    const lowers = teeth.filter((n) => isLower(n)).length;
    if (uppers > 0 && lowers > 0) return 'FULL_SET';
    const count = teeth.length;
    if (count === 1) return 'SINGLE';
    if (count === 2) return 'DUO';
    if (count <= 4) return 'QUAD';
    if (count <= 6) return 'SIX';
    if (count <= 8) return 'EIGHT';
    return uppers > 0 ? 'UPPER' : 'LOWER';
  }

  private title(merged: StyleAttributes, tier: string): string {
    const material = merged.material?.replace('GOLD_', '').replace('_', ' ') ?? '14K';
    const pattern = merged.pattern ? ` ${titleCase(merged.pattern)}` : '';
    return `${tier}${pattern} · ${titleCase(material)}`;
  }

  private rationale(merged: StyleAttributes, tierNote: string): string {
    const cues: string[] = [];
    if (merged.pattern) cues.push(`${titleCase(merged.pattern)} pattern`);
    if (merged.material) cues.push(titleCase(merged.material.replace('_', ' ')));
    if (merged.finish) cues.push(`${titleCase(merged.finish)} finish`);
    const cueText = cues.length > 0 ? `Built around ${cues.join(', ')}. ` : '';
    return `${cueText}This preset is the ${tierNote}.`;
  }
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
