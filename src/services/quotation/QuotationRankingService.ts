import { QuotationConfiguration } from './QuotationConfigurationService';

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
  reliability_score?: number; // 0-1 or 0-100
  rank_score?: number;
  rank_details?: Record<string, number>;
  is_recommended?: boolean;
  recommendation_reason?: string;
}

export class QuotationRankingService {
  /**
   * Rank a list of quotation options based on weighted criteria.
   * Returns a new array with ranking fields populated.
   */
  static rankOptions<T extends RankableOption>(
    options: T[],
    criteria: RankingCriteria = { cost: 0.4, transit_time: 0.3, reliability: 0.3 }
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

    // 1. Extract values for normalization
    const costs = options.map(o => o.total_amount);
    const times = options.map(o => o.transit_time_days || 999); // Penalty for missing time
    const reliabilities = options.map(o => o.reliability_score || 0.5); // Default to neutral

    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const minRel = Math.min(...reliabilities);
    const maxRel = Math.max(...reliabilities);

    // 2. Calculate scores
    const rankedOptions = options.map(opt => {
      const cost = opt.total_amount;
      const time = opt.transit_time_days || 999;
      const rel = opt.reliability_score || 0.5;

      // Normalize (0 to 1)
      // Cost: Lower is better
      const costScore = maxCost === minCost ? 1 : 1 - ((cost - minCost) / (maxCost - minCost));
      
      // Time: Lower is better
      const timeScore = maxTime === minTime ? 1 : 1 - ((time - minTime) / (maxTime - minTime));
      
      // Reliability: Higher is better
      const relScore = maxRel === minRel ? 1 : (rel - minRel) / (maxRel - minRel);

      // Weighted Sum
      const rawScore = (
        (costScore * (criteria.cost || 0)) +
        (timeScore * (criteria.transit_time || 0)) +
        (relScore * (criteria.reliability || 0))
      );
      
      // Scale to 0-100
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

    // 3. Sort by score descending
    rankedOptions.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));

    // 4. Mark recommended
    if (rankedOptions.length > 0) {
      rankedOptions[0].is_recommended = true;
      
      // Generate reason
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
