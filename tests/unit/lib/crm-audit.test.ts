import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CRMAuditService } from '@/lib/crm-audit';
import { createClient } from '@supabase/supabase-js';

describe('CRMAuditService', () => {
  let auditService: CRMAuditService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null })
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null
        })
      }
    };

    auditService = CRMAuditService.getInstance();
    auditService.initialize(mockSupabase);
  });

  it('should log lead creation', async () => {
    const leadData = { name: 'Test Lead', email: 'lead@example.com' };

    await auditService.logLeadCreated('lead-123', leadData, 'tenant-123');

    expect(mockSupabase.from).toHaveBeenCalledWith('crm_audit_logs');
    expect(mockSupabase.from().insert).toHaveBeenCalled();
  });

  it('should compute diff on update', async () => {
    const oldValues = { name: 'Old Name', email: 'old@example.com' };
    const newValues = { name: 'New Name', email: 'old@example.com' };

    await auditService.logLeadUpdated('lead-123', oldValues, newValues, 'tenant-123');

    const call = mockSupabase.from().insert.mock.calls[0][0];
    expect(call[0].changed_fields).toContain('name');
    expect(call[0].changed_fields).not.toContain('email');
  });

  it('should handle errors gracefully', async () => {
    mockSupabase.from().insert.mockResolvedValueOnce({
      data: null,
      error: new Error('Database error')
    });

    // Should not throw
    await expect(
      auditService.logLeadCreated('lead-123', {}, 'tenant-123')
    ).resolves.not.toThrow();
  });
});
