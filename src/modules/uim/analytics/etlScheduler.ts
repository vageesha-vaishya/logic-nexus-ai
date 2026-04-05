export type UimEtlRunStatus = 'queued' | 'running' | 'completed' | 'retry_scheduled' | 'failed';

export type UimEtlRun = {
  run_id: string;
  tenant_id: string;
  franchise_id: string | null;
  source: string;
  window_start: string;
  window_end: string;
  trigger: 'manual' | 'scheduled';
  status: UimEtlRunStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: number;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  records_extracted?: number;
  records_transformed?: number;
  records_loaded?: number;
  last_error?: string;
};

export type UimEtlQueueFilter = {
  tenantId?: string;
  franchiseId?: string;
};

export type UimEtlQueueStats = {
  queued: number;
  running: number;
  retryScheduled: number;
  completed: number;
  failed: number;
};

export type UimEtlTelemetrySummary = {
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  retry_scheduled_runs: number;
  retry_events: number;
  average_duration_ms: number;
  success_rate: number;
  latest_completed_at: string | null;
  last_error: string | null;
};

type UimEtlExecutorOutput = {
  extracted: number;
  transformed: number;
  loaded: number;
};

type UimEtlExecutor = (run: UimEtlRun) => Promise<UimEtlExecutorOutput>;

type UimEtlPersistenceAdapter = {
  upsertRun: (run: UimEtlRun) => Promise<void> | void;
  loadRuns: () => Promise<UimEtlRun[]> | UimEtlRun[];
};

const BASE_RETRY_BACKOFF_MS = 1000;
const DEFAULT_MAX_ATTEMPTS = 4;
const runs = new Map<string, UimEtlRun>();

const memoryPersistence = new Map<string, UimEtlRun>();
let persistenceAdapter: UimEtlPersistenceAdapter = {
  upsertRun(run) {
    memoryPersistence.set(run.run_id, { ...run });
  },
  loadRuns() {
    return [...memoryPersistence.values()].map((run) => ({ ...run }));
  },
};

let etlExecutor: UimEtlExecutor = async () => ({
  extracted: 0,
  transformed: 0,
  loaded: 0,
});

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerIntervalMs = 30000;

function nowMs(): number {
  return Date.now();
}

function isInScope(run: UimEtlRun, filter?: UimEtlQueueFilter): boolean {
  if (!filter) return true;
  if (filter.tenantId && run.tenant_id !== filter.tenantId) return false;
  if (filter.franchiseId && (run.franchise_id || '') !== filter.franchiseId) return false;
  return true;
}

async function saveRun(run: UimEtlRun): Promise<void> {
  runs.set(run.run_id, run);
  await persistenceAdapter.upsertRun(run);
}

export async function restoreUimEtlRunsFromPersistence(): Promise<void> {
  if (runs.size > 0) return;
  const loadedRuns = await persistenceAdapter.loadRuns();
  for (const run of loadedRuns || []) {
    runs.set(run.run_id, { ...run });
  }
}

export function setUimEtlPersistenceAdapter(adapter: UimEtlPersistenceAdapter): void {
  persistenceAdapter = adapter;
}

export function resetUimEtlPersistenceAdapter(): void {
  persistenceAdapter = {
    upsertRun(run) {
      memoryPersistence.set(run.run_id, { ...run });
    },
    loadRuns() {
      return [...memoryPersistence.values()].map((run) => ({ ...run }));
    },
  };
}

export function setUimEtlExecutor(executor: UimEtlExecutor): void {
  etlExecutor = executor;
}

export function resetUimEtlExecutor(): void {
  etlExecutor = async () => ({
    extracted: 0,
    transformed: 0,
    loaded: 0,
  });
}

export async function enqueueUimEtlRun(input: {
  tenant_id: string;
  franchise_id?: string | null;
  source: string;
  window_start?: string;
  window_end?: string;
  trigger?: 'manual' | 'scheduled';
  max_attempts?: number;
}): Promise<UimEtlRun> {
  const source = String(input.source || '').trim();
  if (!source) throw new Error('source is required');
  const runId = `etl-${input.tenant_id}-${nowMs()}-${Math.random().toString(36).slice(2, 10)}`;
  const run: UimEtlRun = {
    run_id: runId,
    tenant_id: String(input.tenant_id || '').trim(),
    franchise_id: input.franchise_id ? String(input.franchise_id) : null,
    source,
    window_start: input.window_start || new Date(nowMs() - 60 * 60 * 1000).toISOString(),
    window_end: input.window_end || new Date().toISOString(),
    trigger: input.trigger || 'manual',
    status: 'queued',
    attempts: 0,
    max_attempts: Math.max(1, Number(input.max_attempts || DEFAULT_MAX_ATTEMPTS)),
    next_attempt_at: nowMs(),
    queued_at: new Date().toISOString(),
  };
  if (!run.tenant_id) throw new Error('tenant_id is required');
  await saveRun(run);
  return run;
}

export async function processUimEtlQueue(referenceNow = nowMs()): Promise<void> {
  await restoreUimEtlRunsFromPersistence();
  const dueRuns = [...runs.values()].filter((run) => (
    (run.status === 'queued' || run.status === 'retry_scheduled') && run.next_attempt_at <= referenceNow
  ));

  for (const current of dueRuns) {
    const running: UimEtlRun = {
      ...current,
      attempts: current.attempts + 1,
      status: 'running',
      started_at: new Date().toISOString(),
    };
    await saveRun(running);
    const startedAtMs = referenceNow;

    try {
      const result = await etlExecutor(running);
      const completed: UimEtlRun = {
        ...running,
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: Math.max(0, nowMs() - startedAtMs),
        records_extracted: Number(result?.extracted || 0),
        records_transformed: Number(result?.transformed || 0),
        records_loaded: Number(result?.loaded || 0),
      };
      await saveRun(completed);
    } catch (error) {
      if (running.attempts >= running.max_attempts) {
        const failed: UimEtlRun = {
          ...running,
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: Math.max(0, nowMs() - startedAtMs),
          last_error: error instanceof Error ? error.message : String(error),
        };
        await saveRun(failed);
      } else {
        const retryDelay = BASE_RETRY_BACKOFF_MS * (2 ** Math.max(0, running.attempts - 1));
        const retryScheduled: UimEtlRun = {
          ...running,
          status: 'retry_scheduled',
          next_attempt_at: referenceNow + retryDelay,
          last_error: error instanceof Error ? error.message : String(error),
        };
        await saveRun(retryScheduled);
      }
    }
  }
}

export function startUimEtlScheduler(intervalMs = 30000): void {
  schedulerIntervalMs = Math.max(500, Number(intervalMs || 30000));
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    void processUimEtlQueue();
  }, schedulerIntervalMs);
}

export function stopUimEtlScheduler(): void {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
}

export function getUimEtlSchedulerState(): { running: boolean; interval_ms: number } {
  return {
    running: Boolean(schedulerTimer),
    interval_ms: schedulerIntervalMs,
  };
}

export function listUimEtlRuns(filter?: UimEtlQueueFilter): UimEtlRun[] {
  return [...runs.values()]
    .filter((run) => isInScope(run, filter))
    .sort((a, b) => String(b.queued_at).localeCompare(String(a.queued_at)));
}

export function getUimEtlQueueStats(filter?: UimEtlQueueFilter): UimEtlQueueStats {
  const scopedRuns = listUimEtlRuns(filter);
  return {
    queued: scopedRuns.filter((run) => run.status === 'queued').length,
    running: scopedRuns.filter((run) => run.status === 'running').length,
    retryScheduled: scopedRuns.filter((run) => run.status === 'retry_scheduled').length,
    completed: scopedRuns.filter((run) => run.status === 'completed').length,
    failed: scopedRuns.filter((run) => run.status === 'failed').length,
  };
}

export function getUimEtlTelemetrySummary(filter?: UimEtlQueueFilter): UimEtlTelemetrySummary {
  const scopedRuns = listUimEtlRuns(filter);
  const completedRuns = scopedRuns.filter((run) => run.status === 'completed');
  const failedRuns = scopedRuns.filter((run) => run.status === 'failed');
  const retryScheduledRuns = scopedRuns.filter((run) => run.status === 'retry_scheduled');
  const totalDuration = completedRuns.reduce((acc, run) => acc + Number(run.duration_ms || 0), 0);
  const retryEvents = scopedRuns.reduce((acc, run) => acc + Math.max(0, Number(run.attempts || 0) - 1), 0);
  const latestCompletedAt = completedRuns
    .map((run) => run.completed_at || '')
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const lastError = [...scopedRuns]
    .reverse()
    .find((run) => Boolean(run.last_error))
    ?.last_error || null;

  return {
    total_runs: scopedRuns.length,
    completed_runs: completedRuns.length,
    failed_runs: failedRuns.length,
    retry_scheduled_runs: retryScheduledRuns.length,
    retry_events: retryEvents,
    average_duration_ms: completedRuns.length > 0 ? Number((totalDuration / completedRuns.length).toFixed(2)) : 0,
    success_rate: Number((completedRuns.length / Math.max(1, completedRuns.length + failedRuns.length)).toFixed(4)),
    latest_completed_at: latestCompletedAt,
    last_error: lastError,
  };
}

export function resetUimEtlSchedulerState(): void {
  stopUimEtlScheduler();
  runs.clear();
  memoryPersistence.clear();
  resetUimEtlExecutor();
  resetUimEtlPersistenceAdapter();
}
