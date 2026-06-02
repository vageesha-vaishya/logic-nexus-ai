// Pure function — given an active experiment + a per-call seed, returns
// which variant to use. Per design §5.6.
//
// Algorithm: SHA-256(experiment_id + ':' + seed) → take low 8 hex chars →
// modulo 100 = bucket. bucket < (traffic_split * 100) routes to B; else A.
// The bucket is recorded so admins can audit fairness (uniform distribution
// across buckets across a sample is the easiest sanity check).

import { createHash } from 'crypto';
import type { ExperimentPick, PromptExperiment } from './experimentTypes.js';

export function pickVariant(experiment: PromptExperiment, seed: string): ExperimentPick {
  const hash = createHash('sha256').update(`${experiment.id}:${seed}`).digest('hex');
  // Take the leading 8 hex chars → 32-bit integer → modulo 100.
  const bucket = parseInt(hash.slice(0, 8), 16) % 100;
  const threshold = Math.round(experiment.traffic_split * 100);

  const isB = bucket < threshold;
  return {
    experiment_id: experiment.id,
    variant_label: isB ? 'b' : 'a',
    variant_version_id: isB ? experiment.variant_b_version_id : experiment.variant_a_version_id,
    bucket,
    threshold,
  };
}

/** Format an audit-trail warning for an experiment pick. */
export function experimentWarning(pick: ExperimentPick): string {
  return `experiment:${pick.experiment_id}:variant_${pick.variant_label}:bucket=${pick.bucket}/${pick.threshold}`;
}
