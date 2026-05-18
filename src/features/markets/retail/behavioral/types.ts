// src/features/markets/retail/behavioral/types.ts

export type StressLevel = 'low' | 'medium' | 'high';

export interface MarketStress {
  nifty_change_pct: number;
  vix_current: number;
  vix_prev: number;
  stress_level: StressLevel;
  nifty_ltp: number | null;
}

export type AlertTier = 'yellow' | 'orange' | 'red' | null;

export interface DrawdownState {
  currentNav: number;
  peakNav: number;
  drawdownPct: number;
  alertTier: AlertTier;
}

export type BehavioralEventType =
  | 'yellow_alert'
  | 'orange_alert'
  | 'red_alert'
  | 'cooling_off'
  | 'education_shown'
  | 'panic_sell_intercepted'
  | 'cooling_off_waited';

export interface BehavioralEvent {
  id: string;
  user_id: string;
  event_type: BehavioralEventType;
  severity: 'info' | 'warning' | 'critical';
  metadata: Record<string, unknown>;
  acknowledged_at: string | null;
  created_at: string;
}

export type EducationId =
  | 'low_liquidity'
  | 'mf_comparison'
  | 'first_stop_loss'
  | 'fo_enable'
  | 'concentration_warning'
  | 'first_intraday'
  | 'high_conviction_signal'
  | 'high_vix_execution'
  | 'first_sip'
  | 'green_day_check'
  | 'enable_autonomous'
  | 'approaching_trade_limit';

export interface EducationContent {
  id: EducationId;
  title: string;
  beginner: string;
  casual: string;
  self_directed?: string;
}
