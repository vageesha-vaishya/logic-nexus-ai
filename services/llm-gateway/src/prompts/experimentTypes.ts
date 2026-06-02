// Types for the A/B-promotion layer. Per design §5.6.

export type ExperimentStatus = 'active' | 'paused' | 'completed' | 'rolled_back';
export type ExperimentSignal = 'accept_rate' | 'cost_usd' | 'latency_ms' | 'quality_score';

export interface PromptExperiment {
  id: string;
  prompt_key: string;
  variant_a_version_id: string;
  variant_b_version_id: string;
  traffic_split: number;          // 0..1 fraction routed to B
  status: ExperimentStatus;
  started_at: string;
  ended_at?: string | null;
  target_invocations?: number | null;
  target_signal?: ExperimentSignal | null;
  winner_version_id?: string | null;
  notes?: string | null;
}

/** One pick result from the experiment picker. */
export interface ExperimentPick {
  experiment_id: string;
  variant_label: 'a' | 'b';
  variant_version_id: string;
  bucket: number;        // 0..99 randomized bucket the seed landed in
  threshold: number;     // traffic_split * 100; bucket < threshold ⇒ variant_b
}
