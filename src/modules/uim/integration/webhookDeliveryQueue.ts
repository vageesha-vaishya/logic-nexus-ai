export type UimWebhookAdapter = {
  adapter_id: string;
  provider: string;
  target_url: string;
  secret_ref: string;
  subscribed_events: string[];
  active: boolean;
  created_at: string;
};

export type UimWebhookJob = {
  job_id: string;
  adapter_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'queued' | 'delivered' | 'retry_scheduled' | 'failed_dlq';
  attempts: number;
  max_attempts: number;
  next_attempt_at: number;
  last_error?: string;
  queued_at: string;
  delivered_at?: string;
};

type DeliveryExecutor = (adapter: UimWebhookAdapter, job: UimWebhookJob) => Promise<void>;

const adapters = new Map<string, UimWebhookAdapter>();
const jobs = new Map<string, UimWebhookJob>();
const dlq = new Map<string, UimWebhookJob>();

let deliveryExecutor: DeliveryExecutor = async (adapter, job) => {
  const response = await fetch(adapter.target_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: job.event_type,
      payload: job.payload,
      adapter_id: adapter.adapter_id,
      job_id: job.job_id,
    }),
  });
  if (!response.ok) throw new Error(`Delivery HTTP ${response.status}`);
};

const BASE_BACKOFF_MS = 500;
const MAX_ATTEMPTS = 5;
let workerTimer: ReturnType<typeof setInterval> | null = null;

function nowMs(): number {
  return Date.now();
}

export function setWebhookDeliveryExecutor(executor: DeliveryExecutor): void {
  deliveryExecutor = executor;
}

export function resetWebhookDeliveryExecutor(): void {
  deliveryExecutor = async (adapter, job) => {
    const response = await fetch(adapter.target_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: job.event_type,
        payload: job.payload,
        adapter_id: adapter.adapter_id,
        job_id: job.job_id,
      }),
    });
    if (!response.ok) throw new Error(`Delivery HTTP ${response.status}`);
  };
}

export function registerWebhookAdapter(adapter: UimWebhookAdapter): void {
  adapters.set(adapter.adapter_id, adapter);
}

export function deactivateWebhookAdapter(adapterId: string): UimWebhookAdapter | null {
  const existing = adapters.get(adapterId);
  if (!existing) return null;
  const updated: UimWebhookAdapter = {
    ...existing,
    active: false,
  };
  adapters.set(adapterId, updated);
  return updated;
}

export function listWebhookAdapters(): UimWebhookAdapter[] {
  return [...adapters.values()];
}

export function enqueueWebhookDelivery(input: {
  adapter_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  max_attempts?: number;
}): UimWebhookJob {
  const adapter = adapters.get(input.adapter_id);
  if (!adapter || !adapter.active) throw new Error('adapter_id is not registered/active');
  if (!adapter.subscribed_events.includes(input.event_type)) {
    throw new Error('adapter is not subscribed to event_type');
  }
  const jobId = `${input.adapter_id}-${nowMs()}-${Math.random().toString(36).slice(2, 10)}`;
  const job: UimWebhookJob = {
    job_id: jobId,
    adapter_id: input.adapter_id,
    event_type: input.event_type,
    payload: input.payload,
    status: 'queued',
    attempts: 0,
    max_attempts: Math.max(1, Number(input.max_attempts || MAX_ATTEMPTS)),
    next_attempt_at: nowMs(),
    queued_at: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  return job;
}

export async function processWebhookQueue(referenceNow = nowMs()): Promise<void> {
  const dueJobs = [...jobs.values()].filter((job) => job.status !== 'delivered' && job.next_attempt_at <= referenceNow);
  for (const job of dueJobs) {
    const adapter = adapters.get(job.adapter_id);
    if (!adapter || !adapter.active) {
      const failed = {
        ...job,
        status: 'failed_dlq' as const,
        last_error: 'adapter missing or inactive',
      };
      dlq.set(job.job_id, failed);
      jobs.delete(job.job_id);
      continue;
    }
    try {
      await deliveryExecutor(adapter, job);
      const delivered: UimWebhookJob = {
        ...job,
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      };
      jobs.set(job.job_id, delivered);
    } catch (error) {
      const attempts = job.attempts + 1;
      if (attempts >= job.max_attempts) {
        const failed: UimWebhookJob = {
          ...job,
          attempts,
          status: 'failed_dlq',
          last_error: error instanceof Error ? error.message : String(error),
        };
        dlq.set(job.job_id, failed);
        jobs.delete(job.job_id);
      } else {
        const backoff = BASE_BACKOFF_MS * (2 ** Math.max(0, attempts - 1));
        const retryScheduled: UimWebhookJob = {
          ...job,
          attempts,
          status: 'retry_scheduled',
          next_attempt_at: referenceNow + backoff,
          last_error: error instanceof Error ? error.message : String(error),
        };
        jobs.set(job.job_id, retryScheduled);
      }
    }
  }
}

export function startWebhookWorker(intervalMs = 250): void {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    void processWebhookQueue();
  }, intervalMs);
}

export function stopWebhookWorker(): void {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
}

export function getWebhookQueueStats(): {
  queued: number;
  delivered: number;
  retryScheduled: number;
  dlq: number;
} {
  const list = [...jobs.values()];
  return {
    queued: list.filter((job) => job.status === 'queued').length,
    delivered: list.filter((job) => job.status === 'delivered').length,
    retryScheduled: list.filter((job) => job.status === 'retry_scheduled').length,
    dlq: dlq.size,
  };
}

export function listDlqJobs(): UimWebhookJob[] {
  return [...dlq.values()];
}

export function resetWebhookDeliveryState(): void {
  stopWebhookWorker();
  adapters.clear();
  jobs.clear();
  dlq.clear();
  resetWebhookDeliveryExecutor();
}
