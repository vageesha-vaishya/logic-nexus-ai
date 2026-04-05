import { afterEach, describe, expect, it } from 'vitest';
import {
  enqueueWebhookDelivery,
  getWebhookQueueStats,
  listDlqJobs,
  processWebhookQueue,
  registerWebhookAdapter,
  resetWebhookDeliveryState,
  setWebhookDeliveryExecutor,
} from './webhookDeliveryQueue';

describe('webhookDeliveryQueue', () => {
  afterEach(() => {
    resetWebhookDeliveryState();
  });

  it('moves failed deliveries to DLQ after max attempts', async () => {
    registerWebhookAdapter({
      adapter_id: 'adapter-1',
      provider: 'amro',
      target_url: 'https://example.com/hook',
      secret_ref: 'vault://uim/adapter-1',
      subscribed_events: ['uim.command.applied.v1'],
      active: true,
      created_at: new Date().toISOString(),
    });

    setWebhookDeliveryExecutor(async () => {
      throw new Error('delivery failed');
    });

    enqueueWebhookDelivery({
      adapter_id: 'adapter-1',
      event_type: 'uim.command.applied.v1',
      payload: { command_id: 'cmd-1' },
      max_attempts: 3,
    });

    await processWebhookQueue(1000);
    await processWebhookQueue(2000);
    await processWebhookQueue(5000);

    const stats = getWebhookQueueStats();
    expect(stats.dlq).toBe(1);
    expect(listDlqJobs()[0]?.status).toBe('failed_dlq');
  });
});
