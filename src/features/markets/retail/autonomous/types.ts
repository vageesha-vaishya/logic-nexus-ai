export type AutonomyPhase = 'paper' | 'micro' | 'pilot' | 'full';
export type KillSwitchLevel = 'none' | 'strategy_pause' | 'all_pause' | 'flatten_positions' | 'revoke_api_key';

export interface AutonomyProgress {
  current_phase: AutonomyPhase;
  paper_trades_done: number;
  micro_trades_done: number;
  kill_switch_level: KillSwitchLevel;
}

export interface PhaseProgress {
  canAdvance: boolean;
  done: number;
  required: number;
  label: string;
}

export interface ExecutionRule {
  id: string;
  name: string;
  description: string;
  asset_class: string;
  signal_type: 'buy' | 'sell' | 'both';
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  product: 'CNC' | 'MIS' | 'NRML';
  max_order_value: number;
  algo_id: string | null;
  is_active: boolean;
  created_at: string;
}

export const PHASE_LABELS: Record<AutonomyPhase, string> = {
  paper: 'Paper Trading',
  micro: 'Micro-Live (2% cap)',
  pilot: 'Pilot (25% cap)',
  full: 'Full Autonomy',
};

export const PHASE_ORDER: AutonomyPhase[] = ['paper', 'micro', 'pilot', 'full'];

export function computePhaseProgress(progress: AutonomyProgress): PhaseProgress {
  const { current_phase, paper_trades_done, micro_trades_done } = progress;
  if (current_phase === 'paper') {
    return { canAdvance: paper_trades_done >= 10, done: paper_trades_done, required: 10, label: 'paper trades' };
  }
  if (current_phase === 'micro') {
    return { canAdvance: micro_trades_done >= 5, done: micro_trades_done, required: 5, label: 'micro-live trades' };
  }
  if (current_phase === 'pilot') {
    return { canAdvance: true, done: 0, required: 0, label: 'request Full Autonomy manually' };
  }
  return { canAdvance: false, done: 0, required: 0, label: 'fully autonomous' };
}
