import { supabase } from '@/integrations/supabase/client';
import { JournalEntry, JournalEntryInsert } from './types';
import { MockERPConnector } from './MockERPConnector';

type GLReferenceType = 'INVOICE' | 'PAYMENT';
type GLConnectorInput = {
  journalEntryId: string;
  tenantId: string;
  referenceId: string;
  type: GLReferenceType;
};
type GLConnectorResult = {
  externalId: string;
};
type GLConnector = (input: GLConnectorInput) => Promise<GLConnectorResult>;
type QueueRuntime = {
  queue: any;
};

export class GLSyncService {
  private static queueRuntimePromise: Promise<QueueRuntime | null> | null = null;
  private static connector: GLConnector = MockERPConnector.syncJournalEntry;

  static setConnector(connector: GLConnector): void {
    this.connector = connector;
  }

  static resetConnector(): void {
    this.connector = MockERPConnector.syncJournalEntry;
  }

  static async enqueueTransactionSync(
    tenantId: string,
    referenceId: string,
    type: GLReferenceType
  ): Promise<{ queued: true; mode: 'bullmq' | 'in_process'; jobId: string }> {
    const jobId = `gl-sync:${tenantId}:${type}:${referenceId}`;
    const runtime = await this.getQueueRuntime();

    if (runtime) {
      const existing = await runtime.queue.getJob(jobId);
      if (!existing) {
        await runtime.queue.add(
          'sync-transaction',
          { tenantId, referenceId, type },
          { jobId }
        );
      }

      return { queued: true, mode: 'bullmq', jobId };
    }

    setTimeout(() => {
      void this.syncTransaction(tenantId, referenceId, type);
    }, 0);

    return { queued: true, mode: 'in_process', jobId };
  }

  static async syncTransaction(tenantId: string, referenceId: string, type: GLReferenceType): Promise<void> {
    console.log(`Syncing ${type} ${referenceId} for tenant ${tenantId} to GL...`);
    
    const entry: JournalEntryInsert = {
      tenant_id: tenantId,
      reference_id: referenceId,
      reference_type: type,
      sync_status: 'PENDING',
      retry_count: 0
    };

    const { data: journalEntry, error: insertError } = await supabase
      .schema('finance')
      .from('journal_entries')
      .insert(entry)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create journal entry record', insertError);
      throw insertError;
    }

    try {
      const connectorResult = await this.connector({
        journalEntryId: journalEntry.id,
        tenantId,
        referenceId,
        type,
      });

      const { error: updateError } = await supabase
        .schema('finance')
        .from('journal_entries')
        .update({
          sync_status: 'SYNCED',
          synced_at: new Date().toISOString(),
          external_id: connectorResult.externalId
        })
        .eq('id', journalEntry.id);

      if (updateError) throw updateError;
      console.log(`Successfully synced ${type} ${referenceId} to GL.`);

    } catch (err: unknown) {
      console.error('GL Sync failed', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      
      await supabase
        .schema('finance')
        .from('journal_entries')
        .update({
          sync_status: 'FAILED',
          error_message: message
        })
        .eq('id', journalEntry.id);
        
      throw err;
    }
  }

  private static async isQueueEnabled(): Promise<boolean> {
    const flag = String(process.env.GL_QUEUE_ENABLED || 'true').toLowerCase();
    return flag !== 'false' && Boolean(process.env.REDIS_URL);
  }

  private static async buildQueueRuntime(): Promise<QueueRuntime | null> {
    if (!(await this.isQueueEnabled())) return null;

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

    const queueName = process.env.GL_QUEUE_NAME || 'finance-gl-sync';
    const concurrency = Number(process.env.GL_QUEUE_CONCURRENCY || 2);

    const queue = new Queue(queueName, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });

    const worker = new Worker(
      queueName,
      async (job: any) => {
        const payload = job.data as { tenantId: string; referenceId: string; type: GLReferenceType };
        await this.syncTransaction(payload.tenantId, payload.referenceId, payload.type);
      },
      { connection, concurrency }
    );

    worker.on('failed', (_job: any, error: Error) => {
      console.error('GL queue job failed', error.message);
    });

    return { queue };
  }

  private static async getQueueRuntime(): Promise<QueueRuntime | null> {
    if (!this.queueRuntimePromise) {
      this.queueRuntimePromise = this.buildQueueRuntime().catch((error) => {
        console.error('GL queue runtime init failed', error);
        this.queueRuntimePromise = null;
        return null;
      });
    }

    return this.queueRuntimePromise;
  }
  
  static async getSyncStatus(referenceId: string): Promise<JournalEntry | null> {
    const { data, error } = await supabase
        .schema('finance')
        .from('journal_entries')
        .select('*')
        .eq('reference_id', referenceId)
        .maybeSingle();
        
    if (error) throw error;
    return data;
  }
}
