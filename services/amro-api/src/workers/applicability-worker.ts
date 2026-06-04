/**
 * Directive Applicability S3 — polling batch worker.
 *
 * Drains amro.applicability_eval_jobs by claiming pending rows in
 * batches, fanning out per-aircraft or per-directive evaluation
 * pairs to the llm-directive-applicability Edge Function, and
 * persisting verdicts into amro.directive_applicability.
 *
 * Polling pattern matches the Phase 8d outbox poller:
 *   - setInterval-based, configurable via env
 *   - Single-flight via `running` guard
 *   - Stuck-job recovery every Nth tick
 *
 * No BullMQ / Redis dependency. Reuses the existing amro-api
 * infrastructure.
 *
 * Wire from services/amro-api/src/index.ts via
 * startApplicabilityWorker() — same shape as startAmroOutboxPoller.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

type JsonRecord = Record<string, unknown>;

interface JobRow {
  id: string;
  tenant_id: string;
  directive_id: string | null;
  aircraft_id: string | null;
  trigger_kind: string;
  attempts: number;
  max_attempts: number;
}

const PER_JOB_PAIR_CAP = 50;  // Hard ceiling on pairs to evaluate per job
const RECOVERY_EVERY_N_TICKS = 20;  // Reset stuck jobs every 20 ticks
const STUCK_DEADLINE_MINUTES = 15;

export interface RunWorkerTickInput {
  supabase: SupabaseClient;
  gatewayUrl: string;
  serviceToken: string | null;
  platformId: string;
  workerId: string;
  jobLimit: number;
  /** Pass true on Nth tick to also run the stuck-job recovery sweep. */
  runRecovery?: boolean;
}

export interface RunWorkerTickResult {
  claimed: number;
  pairsProcessed: number;
  verdictsPersisted: number;
  jobsFailed: number;
  recoveryReset: number;
  errors: string[];
}

/**
 * Builds the LLM input for one (directive, aircraft) pair.
 * Mirrors services/amro-api/src/routes/directive-applicability.routes.ts
 * buildLlmInput — kept in sync.
 */
async function buildLlmInput(
  supabase: SupabaseClient,
  directiveId: string,
  aircraftId: string,
): Promise<{ input: JsonRecord; directiveSnapshot: JsonRecord; aircraftSnapshot: JsonRecord } | { error: string }> {
  const { data: directive, error: dErr } = await supabase
    .from('directives')
    .select(
      'id, directive_no, code_form_no, description, ata_code, applicability, ' +
      'method_of_compliance, effective_date, issuing_authority, kind, relevant_ata_chapters',
    )
    .eq('id', directiveId)
    .maybeSingle();
  if (dErr) return { error: `Failed to load directive: ${dErr.message}` };
  if (!directive) return { error: `Directive ${directiveId} not found` };

  const { data: aircraft, error: aErr } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, serial_number')
    .eq('id', aircraftId)
    .maybeSingle();
  if (aErr) return { error: `Failed to load aircraft: ${aErr.message}` };
  if (!aircraft) return { error: `Aircraft ${aircraftId} not found` };

  const d = directive as unknown as JsonRecord;
  const a = aircraft as unknown as JsonRecord;

  return {
    input: {
      directive: {
        issuing_authority: String(d.issuing_authority ?? 'OTHER'),
        directive_id: String(d.directive_no ?? d.code_form_no ?? d.id ?? ''),
        kind: String(d.kind ?? 'OTHER'),
        title: String(d.description ?? ''),
        effective_date: String(d.effective_date ?? ''),
        applies_to: String(d.applicability ?? ''),
        compliance_action: String(d.method_of_compliance ?? ''),
        relevant_ata_chapters: Array.isArray(d.relevant_ata_chapters)
          ? d.relevant_ata_chapters
          : (typeof d.ata_code === 'string' && d.ata_code ? [d.ata_code] : []),
      },
      aircraft: {
        manufacturer: String(a.manufacturer ?? 'Unknown'),
        model: String(a.model ?? 'Unknown'),
        serial_number: String(a.serial_number ?? 'Unknown'),
        registration: String(a.registration ?? 'Unknown'),
        engines: [],
        configurations: [],
        hours_since_new: null,
        cycles_since_new: null,
      },
    },
    directiveSnapshot: d,
    aircraftSnapshot: a,
  };
}

/**
 * Resolves the list of (directive_id, aircraft_id) pairs to evaluate
 * for one job row based on which scope fields are set.
 *
 *   directive_id + aircraft_id  → 1 pair (one-shot)
 *   directive_id only           → directive × all active aircraft for tenant
 *   aircraft_id only            → aircraft × all directives for tenant
 *
 * Capped at PER_JOB_PAIR_CAP to defend against runaway costs on a
 * tenant with a massive directive corpus.
 */
async function resolvePairs(
  supabase: SupabaseClient,
  job: JobRow,
): Promise<Array<{ directive_id: string; aircraft_id: string }>> {
  if (job.directive_id && job.aircraft_id) {
    return [{ directive_id: job.directive_id, aircraft_id: job.aircraft_id }];
  }
  if (job.directive_id) {
    const { data, error } = await supabase
      .from('aircraft')
      .select('id')
      .eq('tenant_id', job.tenant_id)
      .limit(PER_JOB_PAIR_CAP);
    if (error || !data) return [];
    return data.map((r) => ({
      directive_id: job.directive_id as string,
      aircraft_id: String((r as JsonRecord).id),
    }));
  }
  if (job.aircraft_id) {
    const { data, error } = await supabase
      .from('directives')
      .select('id')
      .eq('tenant_id', job.tenant_id)
      .limit(PER_JOB_PAIR_CAP);
    if (error || !data) return [];
    return data.map((r) => ({
      directive_id: String((r as JsonRecord).id),
      aircraft_id: job.aircraft_id as string,
    }));
  }
  return [];
}

/**
 * Process ONE job: resolve pairs, call LLM for each, persist
 * verdicts. Returns the count of successful + failed verdicts.
 */
async function processJob(
  supabase: SupabaseClient,
  job: JobRow,
  gatewayUrl: string,
  serviceToken: string | null,
  platformId: string,
): Promise<{ created: number; failed: number; error?: string }> {
  const pairs = await resolvePairs(supabase, job);
  if (pairs.length === 0) {
    return { created: 0, failed: 0, error: 'No pairs resolved for job' };
  }

  let created = 0;
  let failed = 0;

  for (const pair of pairs) {
    const built = await buildLlmInput(supabase, pair.directive_id, pair.aircraft_id);
    if ('error' in built) {
      failed += 1;
      continue;
    }

    // Direct gateway call (the Edge Function relays to the same endpoint
    // but we skip the extra hop here since we're already server-side).
    const callRes = await fetch(`${gatewayUrl.replace(/\/$/, '')}/v1/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
        'X-Platform-Id': platformId,
        'X-Correlation-Id': `applicability-worker-${job.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        tenant_id: job.tenant_id,
        module: 'amro',
        feature: 'directive.applicability',
        prompt_key: 'amro.directive.applicability',
        variables: built.input,
        subject: { type: 'directive_applicability_eval', id: `${pair.directive_id}-${pair.aircraft_id}` },
        required_capabilities: ['json_mode'],
      }),
    });
    const llmBody = await callRes.json().catch(() => ({}));
    if (!callRes.ok) {
      failed += 1;
      continue;
    }

    const result = llmBody as { invocation_id?: string; output?: JsonRecord };
    const output = (result.output ?? {}) as JsonRecord;

    // Persist verdict — INSERT into amro.directive_applicability via the
    // public-schema PostgREST endpoint with X-Schema header. Service-role
    // client bypasses RLS.
    const { error: insertErr } = await (supabase as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }>;
        };
      };
    })
      .schema('amro')
      .from('directive_applicability')
      .insert([
        {
          tenant_id: job.tenant_id,
          directive_id: pair.directive_id,
          aircraft_id: pair.aircraft_id,
          applies: Boolean(output.applies),
          confidence: Number(output.confidence ?? 0),
          reasoning: typeof output.reasoning === 'string' ? output.reasoning : null,
          matched_criteria: Array.isArray(output.matched_criteria)
            ? output.matched_criteria
            : [],
          unmatched_criteria: Array.isArray(output.unmatched_criteria)
            ? output.unmatched_criteria
            : [],
          ata_chapters_touched: Array.isArray(output.ata_chapters_touched)
            ? output.ata_chapters_touched
            : [],
          recommended_followup:
            typeof output.recommended_followup === 'string'
              ? output.recommended_followup
              : null,
          invocation_id: result.invocation_id ?? null,
          aircraft_snapshot_jsonb: built.aircraftSnapshot,
          directive_snapshot_jsonb: built.directiveSnapshot,
          status: 'awaiting_review',
        },
      ]);

    if (insertErr) {
      failed += 1;
    } else {
      created += 1;
    }
  }

  return { created, failed };
}

export async function runApplicabilityWorkerTick(
  input: RunWorkerTickInput,
): Promise<RunWorkerTickResult> {
  const {
    supabase,
    gatewayUrl,
    serviceToken,
    platformId,
    workerId,
    jobLimit,
    runRecovery = false,
  } = input;

  const result: RunWorkerTickResult = {
    claimed: 0,
    pairsProcessed: 0,
    verdictsPersisted: 0,
    jobsFailed: 0,
    recoveryReset: 0,
    errors: [],
  };

  // Recover stuck jobs occasionally
  if (runRecovery) {
    const { data: resetCount, error: recErr } = await supabase.rpc(
      'recover_stuck_applicability_eval_jobs' as never,
      { p_deadline_minutes: STUCK_DEADLINE_MINUTES } as never,
    );
    if (recErr) {
      result.errors.push(`Recovery failed: ${recErr.message}`);
    } else if (typeof resetCount === 'number') {
      result.recoveryReset = resetCount;
    }
  }

  // Claim a batch of jobs
  const { data: jobs, error: claimErr } = await supabase.rpc(
    'claim_applicability_eval_jobs' as never,
    { p_worker_id: workerId, p_limit: jobLimit } as never,
  );
  if (claimErr) {
    result.errors.push(`Claim failed: ${claimErr.message}`);
    return result;
  }
  const claimedJobs = (Array.isArray(jobs) ? jobs : []) as JobRow[];
  result.claimed = claimedJobs.length;

  // Process each claimed job sequentially
  for (const job of claimedJobs) {
    try {
      const outcome = await processJob(supabase, job, gatewayUrl, serviceToken, platformId);
      result.pairsProcessed += outcome.created + outcome.failed;
      result.verdictsPersisted += outcome.created;

      // Mark complete or failed
      const succeeded = !outcome.error && outcome.failed < (outcome.created + outcome.failed);
      const fullyFailed = outcome.created === 0 && outcome.failed > 0;

      await supabase
        .from('applicability_eval_jobs')
        .update({
          status: fullyFailed && job.attempts >= job.max_attempts
            ? 'failed'
            : fullyFailed
              ? 'pending'  // retry — claim will increment attempts again
              : 'completed',
          completed_at: !fullyFailed ? new Date().toISOString() : null,
          verdicts_created: outcome.created,
          verdicts_failed: outcome.failed,
          last_error: outcome.error ?? null,
        })
        .eq('id', job.id);

      if (fullyFailed) {
        result.jobsFailed += 1;
      }
    } catch (err) {
      result.errors.push(
        `Job ${job.id} crashed: ${err instanceof Error ? err.message : String(err)}`,
      );
      await supabase
        .from('applicability_eval_jobs')
        .update({
          status: job.attempts >= job.max_attempts ? 'failed' : 'pending',
          last_error: err instanceof Error ? err.message : String(err),
        })
        .eq('id', job.id);
      result.jobsFailed += 1;
    }
  }

  return result;
}
