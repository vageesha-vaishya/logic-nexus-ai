// Phase 7 UIM Step 4b.14 follow-up — DB-backed ETL persistence adapter.
//
// The 4b.14 in-memory queue did not survive process restarts. This
// module provides the UimEtlPersistenceAdapter implementation that
// upserts each save into uim.etl_runs and loads existing rows on
// startup. Wire by calling setUimEtlPersistenceAdapter() during
// boot — see uim-api/src/index.ts.
//
// All columns mirror the in-memory UimEtlRun fields verbatim;
// status / trigger / max_attempts CHECK constraints in the DB
// enforce shape parity with the legacy enum.

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';
import type { UimEtlRun } from './etl-scheduler.js';

export function createSupabaseEtlPersistenceAdapter(supabase: SupabaseClient) {
  return {
    async upsertRun(run: UimEtlRun): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .schema('uim')
        .from('etl_runs')
        .upsert(
          {
            run_id: run.run_id,
            tenant_id: run.tenant_id,
            franchise_id: run.franchise_id,
            source: run.source,
            window_start: run.window_start,
            window_end: run.window_end,
            trigger: run.trigger,
            status: run.status,
            attempts: run.attempts,
            max_attempts: run.max_attempts,
            next_attempt_at: run.next_attempt_at,
            queued_at: run.queued_at,
            started_at: run.started_at ?? null,
            completed_at: run.completed_at ?? null,
            duration_ms: run.duration_ms ?? null,
            records_extracted: run.records_extracted ?? null,
            records_transformed: run.records_transformed ?? null,
            records_loaded: run.records_loaded ?? null,
            last_error: run.last_error ?? null,
          },
          { onConflict: 'run_id' },
        );
      if (error) {
        // Log + swallow — the in-memory map is still authoritative
        // for the current process lifetime. Surfacing the error here
        // would break the ETL processing loop on a transient DB blip.
        logger.warn('etl-persistence upsert failed', {
          run_id: run.run_id,
          error: error.message,
        });
      }
    },

    async loadRuns(): Promise<UimEtlRun[]> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema('uim')
        .from('etl_runs')
        .select('*')
        // Only resurrect non-terminal runs into memory — completed +
        // failed terminals stay in DB for telemetry/history reads but
        // don't need to occupy the live queue.
        .in('status', ['queued', 'running', 'retry_scheduled']);
      if (error) {
        logger.warn('etl-persistence loadRuns failed', { error: error.message });
        return [];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data || []) as any[]).map((row): UimEtlRun => ({
        run_id: String(row.run_id),
        tenant_id: String(row.tenant_id),
        franchise_id: row.franchise_id ? String(row.franchise_id) : null,
        source: String(row.source),
        window_start: String(row.window_start),
        window_end: String(row.window_end),
        trigger: row.trigger === 'scheduled' ? 'scheduled' : 'manual',
        status: row.status,
        attempts: Number(row.attempts || 0),
        max_attempts: Number(row.max_attempts || 4),
        next_attempt_at: Number(row.next_attempt_at || 0),
        queued_at: String(row.queued_at),
        started_at: row.started_at ? String(row.started_at) : undefined,
        completed_at: row.completed_at ? String(row.completed_at) : undefined,
        duration_ms: row.duration_ms != null ? Number(row.duration_ms) : undefined,
        records_extracted: row.records_extracted != null ? Number(row.records_extracted) : undefined,
        records_transformed: row.records_transformed != null ? Number(row.records_transformed) : undefined,
        records_loaded: row.records_loaded != null ? Number(row.records_loaded) : undefined,
        last_error: row.last_error ? String(row.last_error) : undefined,
      }));
    },
  };
}
