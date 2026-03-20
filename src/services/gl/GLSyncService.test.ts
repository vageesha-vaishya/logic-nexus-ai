import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GLSyncService } from './GLSyncService';

// Mock functions
const mockSchema = vi.fn();
const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

// Mock the supabase client module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    schema: (schema: string) => mockSchema(schema)
  }
}));

describe('GLSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    GLSyncService.resetConnector();

    mockSchema.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ 
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect
    });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ 
        single: mockSingle,
        eq: mockEq,
        maybeSingle: mockMaybeSingle
    });
    mockSingle.mockReturnValue({ data: {}, error: null });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it('should create a pending journal entry and sync it', async () => {
    const tenantId = 'tenant-123';
    const referenceId = 'inv-123';
    
    // Mock insert response
    const mockEntry = {
      id: 'entry-123',
      tenant_id: tenantId,
      reference_id: referenceId,
      sync_status: 'PENDING'
    };
    
    mockSingle.mockResolvedValueOnce({ data: mockEntry, error: null }); // For insert
    
    // Mock update response
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    await GLSyncService.syncTransaction(tenantId, referenceId, 'INVOICE');

    // Verify insert
    expect(mockSchema).toHaveBeenCalledWith('finance');
    expect(mockFrom).toHaveBeenCalledWith('journal_entries');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: tenantId,
      reference_id: referenceId,
      reference_type: 'INVOICE',
      sync_status: 'PENDING'
    }));

    // Verify update (after "mock" sync)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      sync_status: 'SYNCED'
    }));
  });

  it('should handle sync errors and update status to FAILED', async () => {
     const tenantId = 'tenant-123';
    const referenceId = 'inv-fail';
    
    // Mock insert response
    const mockEntry = {
      id: 'entry-fail',
      tenant_id: tenantId,
      reference_id: referenceId,
      sync_status: 'PENDING'
    };
    
    mockSingle.mockResolvedValueOnce({ data: mockEntry, error: null });

    // Mock external sync failure (by spying on the private method or just making update fail? 
    // Since I can't easily spy on private method without casting, 
    // I'll simulate an error in the "process" part if I could, but here the process is just a timeout.
    // However, I can mock the update call to fail or throw error inside the try block if I could control it.
    // Actually, checking the code:
    /*
      try {
        await this.mockExternalSync(journalEntry.id);
        const { error: updateError } = await supabase...update(...)
    */
    // If I want to test the catch block, I can make the update fail, or the mockExternalSync fail.
    // Since mockExternalSync is private and hardcoded, I can't easily make it fail.
    // BUT, I can make the *first* update fail? No, the update happens after sync.
    // I will skip this test case for now as it requires modifying the service to be more testable (dependency injection) or using advanced spies.
    // Alternatively, I can mock the database update to fail, which triggers the catch block? 
    // No, if the update fails, it throws, then catch block catches it and tries to update again (to FAILED).
    
    // Let's try making the update throw an error.
    mockUpdate.mockReturnValue({ eq: vi.fn().mockRejectedValueOnce(new Error('Update failed')) });

    // This should cause the catch block to run, which attempts another update to set status to FAILED.
    // However, since the catch block re-throws, we expect the method to reject.
    
    await expect(GLSyncService.syncTransaction(tenantId, referenceId, 'INVOICE')).rejects.toThrow('Update failed');
    
    // Check that we attempted to update to FAILED
    // The first update failed, so the catch block runs. 
    // The catch block calls update again with status FAILED.
    // So update should be called twice.
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
        sync_status: 'FAILED'
    }));
  });

  it('falls back to in-process async posting when queue is disabled', async () => {
    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: TimerHandler) => {
        if (typeof fn === 'function') fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);
    const syncSpy = vi.spyOn(GLSyncService, 'syncTransaction').mockResolvedValue(undefined);

    const previousFlag = process.env.GL_QUEUE_ENABLED;
    const previousRedis = process.env.REDIS_URL;
    process.env.GL_QUEUE_ENABLED = 'false';
    process.env.REDIS_URL = '';

    const result = await GLSyncService.enqueueTransactionSync('tenant-1', 'invoice-1', 'INVOICE');

    expect(result.mode).toBe('in_process');
    expect(result.queued).toBe(true);
    expect(syncSpy).toHaveBeenCalledWith('tenant-1', 'invoice-1', 'INVOICE');

    process.env.GL_QUEUE_ENABLED = previousFlag;
    process.env.REDIS_URL = previousRedis;
    syncSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('applies configured connector during enqueue in in-process mode', async () => {
    const setTimeoutSpy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation(((fn: TimerHandler) => {
        if (typeof fn === 'function') fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    const previousFlag = process.env.GL_QUEUE_ENABLED;
    const previousRedis = process.env.REDIS_URL;
    process.env.GL_QUEUE_ENABLED = 'false';
    process.env.REDIS_URL = '';

    const mockEntry = {
      id: 'entry-enqueue',
      tenant_id: 'tenant-2',
      reference_id: 'invoice-2',
      sync_status: 'PENDING',
    };
    mockSingle.mockResolvedValueOnce({ data: mockEntry, error: null });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const connectorSpy = vi.fn().mockResolvedValue({
      externalId: 'ERP-tenant-2-INVOICE-invoice-2-entry-enqueue',
    });
    GLSyncService.setConnector(connectorSpy);

    const result = await GLSyncService.enqueueTransactionSync('tenant-2', 'invoice-2', 'INVOICE');
    await Promise.resolve();
    await Promise.resolve();

    expect(result.mode).toBe('in_process');
    expect(result.queued).toBe(true);
    expect(connectorSpy).toHaveBeenCalledWith({
      journalEntryId: 'entry-enqueue',
      tenantId: 'tenant-2',
      referenceId: 'invoice-2',
      type: 'INVOICE',
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_status: 'SYNCED',
        external_id: 'ERP-tenant-2-INVOICE-invoice-2-entry-enqueue',
      })
    );

    process.env.GL_QUEUE_ENABLED = previousFlag;
    process.env.REDIS_URL = previousRedis;
    GLSyncService.resetConnector();
    setTimeoutSpy.mockRestore();
  });
});
