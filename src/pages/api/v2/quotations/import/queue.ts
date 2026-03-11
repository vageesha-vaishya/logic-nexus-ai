import { logger } from '@/lib/logger';
import { processQuotationImportJob, type ImportPayload } from './processor';

type ImportJobData = {
  importId: string;
  tenantId: string;
  userId: string;
  payload: ImportPayload;
  correlationId: string;
};

type QueueRuntime = {
  queue: any;
};

let runtimePromise: Promise<QueueRuntime | null> | null = null;

function isQueueEnabled(): boolean {
  const enabled = String(process.env.IMPORT_QUEUE_ENABLED || 'true').toLowerCase();
  return enabled !== 'false' && Boolean(process.env.REDIS_URL);
}

async function buildRuntime(): Promise<QueueRuntime | null> {
  if (!isQueueEnabled()) return null;

  const redisUrl = String(process.env.REDIS_URL || '').trim();
  const { Queue, Worker } = await import('bullmq');
  const parsedUrl = new URL(redisUrl);
  const connection = {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 6379),
    username: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    db: parsedUrl.pathname ? Number(parsedUrl.pathname.replace('/', '') || 0) : 0,
    maxRetriesPerRequest: null as any,
  };

  const queueName = process.env.IMPORT_QUEUE_NAME || 'quotation-import-v2';
  const concurrency = Number(process.env.IMPORT_QUEUE_CONCURRENCY || 2);

  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });

  const worker = new Worker(
    queueName,
    async (job: any) => {
      await processQuotationImportJob(job.data as ImportJobData);
    },
    { connection, concurrency }
  );

  worker.on('failed', (job: any, error: Error) => {
    logger.error('[QuotationImportQueue] job failed', {
      importId: job?.id,
      message: error?.message || 'unknown',
    });
  });

  worker.on('completed', (job: any) => {
    logger.info('[QuotationImportQueue] job completed', { importId: job?.id });
  });

  return { queue };
}

async function getRuntime(): Promise<QueueRuntime | null> {
  if (!runtimePromise) {
    runtimePromise = buildRuntime().catch((error) => {
      logger.error('[QuotationImportQueue] runtime init failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      runtimePromise = null;
      return null;
    });
  }
  return runtimePromise;
}

export async function enqueueQuotationImportJob(jobData: ImportJobData): Promise<boolean> {
  const runtime = await getRuntime();
  if (!runtime) return false;

  const existing = await runtime.queue.getJob(jobData.importId);
  if (existing) return true;

  await runtime.queue.add('process-import', jobData, { jobId: jobData.importId });
  return true;
}

export async function cancelQueuedQuotationImportJob(importId: string): Promise<boolean> {
  const runtime = await getRuntime();
  if (!runtime) return false;

  const job = await runtime.queue.getJob(importId);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'waiting' || state === 'delayed' || state === 'prioritized' || state === 'paused') {
    await job.remove();
    return true;
  }

  return false;
}
