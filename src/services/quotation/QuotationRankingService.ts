export interface RankingCriteria {
  cost: number;
  transit_time: number;
  reliability: number;
  [key: string]: number;
}

export interface RankableOption {
  id: string;
  total_amount: number;
  transit_time_days: number | null;
  reliability_score?: number;
  rank_score?: number;
  rank_details?: Record<string, number>;
  is_recommended?: boolean;
  recommendation_reason?: string;
}

const DEFAULT_CRITERIA: RankingCriteria = { cost: 0.4, transit_time: 0.3, reliability: 0.3 };
const FALLBACK_TRANSIT_DAYS = 999;
const FALLBACK_RELIABILITY = 0.5;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const normalizeReliability = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return FALLBACK_RELIABILITY;
  if (value > 1) return clamp01(value / 100);
  return clamp01(value);
};

const normalizeCost = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value < 0) return 0;
  return value;
};

const normalizeTransitDays = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) return FALLBACK_TRANSIT_DAYS;
  return value;
};

const normalizeCriteria = (criteria: RankingCriteria): RankingCriteria => {
  const safeCost = Math.max(0, Number(criteria.cost || 0));
  const safeTime = Math.max(0, Number(criteria.transit_time || 0));
  const safeReliability = Math.max(0, Number(criteria.reliability || 0));
  const total = safeCost + safeTime + safeReliability;
  if (total <= 0) {
    return DEFAULT_CRITERIA;
  }
  return {
    cost: safeCost / total,
    transit_time: safeTime / total,
    reliability: safeReliability / total,
  };
};

export class QuotationRankingService {
  /**
   * Rank a list of quotation options based on weighted criteria.
   * Returns a new array with ranking fields populated.
   */
  static rankOptions<T extends RankableOption>(
    options: T[],
    criteria: RankingCriteria = DEFAULT_CRITERIA
  ): T[] {
    if (!options || options.length === 0) return [];
    if (options.length === 1) {
      return [{
        ...options[0],
        rank_score: 100,
        is_recommended: true,
        recommendation_reason: 'Only available option'
      }];
    }

    const normalizedCriteria = normalizeCriteria(criteria);
    const normalizedOptions = options.map((option) => ({
      ...option,
      total_amount: normalizeCost(option.total_amount),
      transit_time_days: normalizeTransitDays(option.transit_time_days),
      reliability_score: normalizeReliability(option.reliability_score),
    }));

    const costs = normalizedOptions.map(o => o.total_amount);
    const times = normalizedOptions.map(o => normalizeTransitDays(o.transit_time_days));
    const reliabilities = normalizedOptions.map(o => normalizeReliability(o.reliability_score));

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const minRel = Math.min(...reliabilities);
    const maxRel = Math.max(...reliabilities);

    const rankedOptions = normalizedOptions.map(opt => {
      const cost = normalizeCost(opt.total_amount);
      const time = normalizeTransitDays(opt.transit_time_days);
      const rel = normalizeReliability(opt.reliability_score);

      const costScore = maxCost === minCost ? 1 : 1 - ((cost - minCost) / (maxCost - minCost));
      const timeScore = maxTime === minTime ? 1 : 1 - ((time - minTime) / (maxTime - minTime));
      const relScore = maxRel === minRel ? 1 : (rel - minRel) / (maxRel - minRel);

      const rawScore = (
        (costScore * normalizedCriteria.cost) +
        (timeScore * normalizedCriteria.transit_time) +
        (relScore * normalizedCriteria.reliability)
      );
      const finalScore = Math.round(rawScore * 100);

      return {
        ...opt,
        rank_score: finalScore,
        rank_details: {
          cost_score: Math.round(costScore * 100),
          time_score: Math.round(timeScore * 100),
          reliability_score: Math.round(relScore * 100)
        }
      };
    });

    rankedOptions.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));

    if (rankedOptions.length > 0) {
      rankedOptions[0].is_recommended = true;
      const best = rankedOptions[0];
      const reasons: string[] = [];
      if (best.rank_details?.cost_score && best.rank_details.cost_score >= 90) reasons.push('Best Price');
      if (best.rank_details?.time_score && best.rank_details.time_score >= 90) reasons.push('Fastest Route');
      if (best.rank_details?.reliability_score && best.rank_details.reliability_score >= 90) reasons.push('High Reliability');
      
      if (reasons.length === 0) reasons.push('Overall Best Value');
      best.recommendation_reason = reasons.join(' & ');
    }

    return rankedOptions;
  }
}
