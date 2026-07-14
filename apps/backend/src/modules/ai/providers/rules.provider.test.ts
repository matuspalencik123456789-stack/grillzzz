import { describe, expect, it } from 'vitest';
import { defaultGrillzConfig, grillzConfigSchema } from '@grillz/shared-types';
import { RulesAiProvider } from './rules.provider';

const provider = new RulesAiProvider();
const FRONT_SIX = [13, 12, 11, 21, 22, 23];

describe('RulesAiProvider.generateDesigns', () => {
  it('produces 3 schema-valid presets for a style prompt', async () => {
    const suggestions = await provider.generateDesigns({
      prompt: 'Luxury Miami grillz',
      toothNumbers: FRONT_SIX,
    });
    expect(suggestions).toHaveLength(3);
    for (const s of suggestions) {
      expect(grillzConfigSchema.safeParse(s.config).success).toBe(true);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.rationale.length).toBeGreaterThan(0);
    }
    // "miami" → flooded statement piece with stones
    expect(suggestions[0]!.config.pattern).toBe('FLOODED');
    expect(suggestions[0]!.config.diamonds.enabled).toBe(true);
  });

  it('respects tight budgets with cheaper defaults', async () => {
    const suggestions = await provider.generateDesigns({
      prompt: 'iced out but affordable',
      toothNumbers: FRONT_SIX,
      budgetMinor: 80_000,
    });
    const essential = suggestions[2]!;
    expect(['SILVER', 'GOLD_10K']).toContain(essential.config.material);
    expect(suggestions[0]!.config.diamonds.stoneType).toBe('CZ');
  });

  it('derives set type from teeth', async () => {
    const single = await provider.generateDesigns({ prompt: 'classic', toothNumbers: [11] });
    expect(single[0]!.config.setType).toBe('SINGLE');
    const mixed = await provider.generateDesigns({
      prompt: 'classic',
      toothNumbers: [11, 41],
    });
    expect(mixed[0]!.config.setType).toBe('FULL_SET');
  });
});

describe('RulesAiProvider.validateDesign', () => {
  it('blocks stone seats deeper than the wall', async () => {
    const config = defaultGrillzConfig(FRONT_SIX);
    config.diamonds = { ...config.diamonds, enabled: true, stoneSizeMm: 3.0 };
    config.geometry = { ...config.geometry, thicknessMm: 0.5, offsetMm: 0 };
    const issues = await provider.validateDesign(config);
    expect(issues.some((i) => i.code === 'STONE_SEAT_DEPTH' && i.severity === 'BLOCKER')).toBe(true);
  });

  it('blocks single-piece designs spanning both jaws', async () => {
    const config = defaultGrillzConfig([11, 41]);
    config.setType = 'DUO';
    const issues = await provider.validateDesign(config);
    expect(issues.some((i) => i.code === 'MIXED_JAWS')).toBe(true);
  });

  it('blocks engraving pattern without text', async () => {
    const config = defaultGrillzConfig(FRONT_SIX);
    config.pattern = 'CUSTOM_ENGRAVING';
    const issues = await provider.validateDesign(config);
    expect(issues.some((i) => i.code === 'MISSING_ENGRAVING_TEXT')).toBe(true);
  });

  it('passes a sane default design', async () => {
    const issues = await provider.validateDesign(defaultGrillzConfig(FRONT_SIX));
    expect(issues.filter((i) => i.severity === 'BLOCKER')).toHaveLength(0);
  });
});

describe('RulesAiProvider.recommend', () => {
  it('recommends budget stones under tight budgets', async () => {
    const rec = await provider.recommend({ prompt: 'iced grillz', budgetMinor: 50_000 });
    expect(rec.diamonds[0]!.stoneType).toBe('CZ');
    expect(rec.materials.length).toBeGreaterThan(0);
  });

  it('recommends premium metals for luxury prompts', async () => {
    const rec = await provider.recommend({ prompt: 'ultra luxury statement piece' });
    expect(rec.materials.map((m) => m.material)).toContain('GOLD_18K');
  });
});
