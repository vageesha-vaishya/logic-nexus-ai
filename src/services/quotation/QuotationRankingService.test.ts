import { describe, it, expect } from 'vitest';
import { QuotationRankingService } from './QuotationRankingService';
import type { RankableOption } from './QuotationRankingService';

describe('QuotationRankingService', () => {
  it('ranks options with normalized reliability scales', () => {
    const ranked = QuotationRankingService.rankOptions<RankableOption>([
      { id: 'a', total_amount: 1500, transit_time_days: 10, reliability_score: 0.92 },
      { id: 'b', total_amount: 1200, transit_time_days: 12, reliability_score: 92 },
      { id: 'c', total_amount: 1000, transit_time_days: 15, reliability_score: 80 },
    ], { cost: 0.4, transit_time: 0.3, reliability: 0.3 });

    expect(ranked).toHaveLength(3);
    expect(ranked[0].is_recommended).toBe(true);
    expect(ranked[0].rank_score).toBeGreaterThanOrEqual(ranked[1].rank_score || 0);
    expect(ranked[0].rank_details?.reliability_score).toBeGreaterThanOrEqual(0);
    expect(ranked[0].rank_details?.reliability_score).toBeLessThanOrEqual(100);
  });

  it('sanitizes invalid amounts, transit, and reliability', () => {
    const ranked = QuotationRankingService.rankOptions<RankableOption>([
      { id: 'a', total_amount: Number.NaN, transit_time_days: null, reliability_score: Number.NaN },
      { id: 'b', total_amount: -1200, transit_time_days: -2, reliability_score: -1 },
      { id: 'c', total_amount: 3000, transit_time_days: 20, reliability_score: 120 },
    ], { cost: 0.5, transit_time: 0.5, reliability: 0 });

    expect(ranked).toHaveLength(3);
    ranked.forEach((option) => {
      expect(Number.isFinite(option.rank_score)).toBe(true);
      expect(option.rank_score).toBeGreaterThanOrEqual(0);
      expect(option.rank_score).toBeLessThanOrEqual(100);
    });
  });

  it('falls back to default criteria when all weights are zero', () => {
    const ranked = QuotationRankingService.rankOptions<RankableOption>([
      { id: 'fast', total_amount: 2000, transit_time_days: 5, reliability_score: 0.7 },
      { id: 'cheap', total_amount: 1000, transit_time_days: 12, reliability_score: 0.6 },
    ], { cost: 0, transit_time: 0, reliability: 0 });

    expect(ranked[0].rank_score).toBeGreaterThan(ranked[1].rank_score || 0);
    expect(ranked[0].is_recommended).toBe(true);
    expect(typeof ranked[0].recommendation_reason).toBe('string');
  });

  it('marks single option as recommended', () => {
    const ranked = QuotationRankingService.rankOptions<RankableOption>([
      { id: 'only', total_amount: 1000, transit_time_days: 9, reliability_score: 0.9 },
    ]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].rank_score).toBe(100);
    expect(ranked[0].is_recommended).toBe(true);
    expect(ranked[0].recommendation_reason).toBe('Only available option');
  });
});
