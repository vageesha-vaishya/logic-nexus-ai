// src/features/markets/retail/community/types.ts
export type BasketRiskLevel = 'low' | 'medium' | 'high';
export type RebalanceFreq = 'monthly' | 'quarterly' | 'yearly';

export interface CommunityBasket {
  id: string;
  creator_id: string;
  name: string;
  theme: string;
  description: string;
  risk_level: BasketRiskLevel;
  rebalance_freq: RebalanceFreq;
  follower_count: number;
  total_invested: number;
  created_at: string;
}

export interface BasketHolding {
  id: string;
  basket_id: string;
  weight_pct: number;
  instrument_id: string;
  instrument?: { symbol: string; exchange: string; instrument_type: string };
}

export interface MarketplaceStrategy {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  asset_class: string;
  backtest_summary: Record<string, unknown>;
  live_users: number;
  rating: number | null;
  paper_required_days: number;
  created_at: string;
}

export interface CreatorStatus {
  is_verified: boolean;
}

export const RISK_LEVEL_LABELS: Record<BasketRiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Moderate Risk',
  high: 'High Risk',
};

export const RISK_LEVEL_COLORS: Record<BasketRiskLevel, string> = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-red-600',
};

export function formatWeight(pct: number): string {
  return `${pct.toFixed(1)}%`;
}
