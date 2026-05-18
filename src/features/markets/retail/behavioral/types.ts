/**
 * Behavioral layer — type-only surface used by Stream 3 (inline education).
 *
 * Stream 2 (DB-backed drawdown alerts + cooling-off + market stress) will
 * extend this file with BehavioralEvent / DrawdownTier / MarketStress types.
 * Keep this Stream-3 slice self-contained so it can ship independently.
 */

/** Stable identifier for an education card. New entries must be added here AND in EDUCATION_CONTENT. */
export type EducationId =
  | 'high_conviction_signal'
  | 'first_sip'
  | 'first_stop_loss'
  | 'concentration_warning'
  | 'first_intraday'
  | 'high_vix_execution'
  | 'mf_comparison'
  | 'fo_enable'
  | 'approaching_trade_limit'
  | 'green_day_check'
  | 'enable_autonomous'
  | 'low_liquidity';

export interface EducationContent {
  id: EducationId;
  title: string;
  /** Mandatory: shown to beginner users and as fallback when other levels are absent. */
  beginner: string;
  /** Casual reading level — adds key numbers and a bit of mechanism. */
  casual: string;
  /** Self-directed — full technical detail (math, CI, sample sizes). */
  self_directed: string;
}

// ── Stream 2: market stress + drawdown alerts + DB-backed events ────────────

export type StressLevel = 'low' | 'medium' | 'high';

export interface MarketStress {
  nifty_change_pct: number;
  vix_current: number;
  vix_prev: number;
  stress_level: StressLevel;
  nifty_ltp: number | null;
}

/** null = no banner. yellow/orange render BehavioralAlertBanner; red triggers CoolingOffScreen. */
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

export type BehavioralSeverity = 'info' | 'warning' | 'critical';

export interface BehavioralEvent {
  id: string;
  user_id: string;
  event_type: BehavioralEventType;
  severity: BehavioralSeverity;
  metadata: Record<string, unknown>;
  acknowledged_at: string | null;
  created_at: string;
}
