import { describe, expect, it } from 'vitest';
import { buildUimMroSeedItems, normalizeSeedCount, UIM_MRO_SEED_LIMITS } from './uimMroSeedService';

describe('uimMroSeedService', () => {
  it('normalizes seed count to valid bounds', () => {
    expect(normalizeSeedCount(undefined)).toBe(UIM_MRO_SEED_LIMITS.default);
    expect(normalizeSeedCount(100)).toBe(UIM_MRO_SEED_LIMITS.min);
    expect(normalizeSeedCount(2000)).toBe(UIM_MRO_SEED_LIMITS.max);
    expect(normalizeSeedCount(750)).toBe(750);
  });

  it('builds deterministic MRO seed items with required attributes', () => {
    const items = buildUimMroSeedItems(500);
    expect(items).toHaveLength(500);
    expect(items[0]?.sku).toBe('UIM-MRO-000001');
    expect(items[0]?.part_number).toContain('MRO-PN-');
    expect(items.some((item) => item.maintenance_category === 'emergency-spare')).toBe(true);
    expect(items.every((item) => Boolean(item.ata_chapter_code))).toBe(true);
  });
});
